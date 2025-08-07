/**
 * GitHub Integration Service
 * GitHub 저장소에서 코드를 가져오고 분석하는 서비스
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';

export interface GitHubRepository {
  owner: string;
  repo: string;
  ref?: string; // branch or commit
  folderPath?: string; // specific folder path
}

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
  type: string;
  language?: string;
}

export interface RepositoryContent {
  files: GitHubFile[];
  structure: string;
  metadata: {
    totalFiles: number;
    totalSize: number;
    languages: { [key: string]: number };
    lastCommit?: {
      sha: string;
      message: string;
      author: string;
      date: string;
    };
  };
}

export class GitHubService {
  private token?: string;
  private baseUrl = 'https://api.github.com';
  private rateLimitRemaining = 60; // GitHub API rate limit for unauthenticated requests
  
  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN;
    if (this.token) {
      logger.info('GitHub Service initialized with authentication');
    } else {
      logger.warn('GitHub Service initialized without authentication (rate limited)');
    }
  }

  /**
   * GitHub URL에서 저장소 정보 추출
   */
  parseRepositoryUrl(url: string): GitHubRepository {
    try {
      // GitHub URL 패턴들 지원:
      // https://github.com/username/repo
      // https://github.com/username/repo.git
      // https://github.com/username/repo/tree/branch
      // https://github.com/username/repo/tree/branch/folder/path
      // git@github.com:username/repo.git
      
      let cleanUrl = url.trim();
      
      // SSH URL 처리
      if (cleanUrl.startsWith('git@github.com:')) {
        cleanUrl = cleanUrl.replace('git@github.com:', 'https://github.com/');
      }
      
      // .git 제거
      cleanUrl = cleanUrl.replace(/\.git$/, '');
      
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      
      if (pathParts.length < 2) {
        throw new Error('Invalid GitHub URL: missing owner or repository');
      }
      
      const owner = pathParts[0];
      const repo = pathParts[1];
      let ref = 'main'; // default branch
      let folderPath: string | undefined;
      
      // /tree/branch-name/folder/path 패턴 처리
      if (pathParts.length >= 4 && pathParts[2] === 'tree') {
        ref = pathParts[3];
        
        // 브랜치 이후 경로가 있으면 폴더 경로로 인식
        if (pathParts.length > 4) {
          folderPath = pathParts.slice(4).join('/');
        }
      }
      
      return { owner, repo, ref, folderPath };
    } catch (error) {
      logger.error('Failed to parse GitHub URL:', { url, error });
      throw new ExternalServiceError('GitHub', `Invalid GitHub URL: ${url}`);
    }
  }

  /**
   * 저장소에서 모든 파일 가져오기
   */
  async fetchRepositoryContent(url: string, folderPath?: string): Promise<RepositoryContent> {
    const startTime = Date.now();
    
    try {
      const repoInfo = this.parseRepositoryUrl(url);
      
      // 매개변수로 전달된 폴더 경로가 있으면 우선 사용
      if (folderPath) {
        repoInfo.folderPath = folderPath;
      }
      
      logger.info('Fetching repository content:', repoInfo);
      
      // 1. 기본 정보 및 최신 커밋 정보 가져오기
      const repoData = await this.apiRequest(`/repos/${repoInfo.owner}/${repoInfo.repo}`);
      const defaultBranch = repoData.default_branch || 'main';
      const ref = repoInfo.ref || defaultBranch;
      
      // 2. 커밋 정보 가져오기
      const commitData = await this.apiRequest(`/repos/${repoInfo.owner}/${repoInfo.repo}/commits/${ref}`);
      
      // 3. 전체 파일 트리 가져오기
      const treeData = await this.apiRequest(
        `/repos/${repoInfo.owner}/${repoInfo.repo}/git/trees/${commitData.sha}?recursive=1`
      );
      
      // 4. 코드 파일들만 필터링 (폴더 경로가 지정된 경우 해당 폴더만)
      let codeFiles = treeData.tree.filter((item: any) => 
        item.type === 'blob' && this.isCodeFile(item.path)
      );
      
      // 폴더 경로가 지정된 경우 해당 폴더 내 파일들만 필터링
      if (repoInfo.folderPath) {
        const folderPrefix = repoInfo.folderPath.endsWith('/') 
          ? repoInfo.folderPath 
          : repoInfo.folderPath + '/';
        
        codeFiles = codeFiles.filter((file: any) => 
          file.path.startsWith(folderPrefix)
        );
        
        if (codeFiles.length === 0) {
          logger.warn(`No code files found in folder: ${repoInfo.folderPath}`);
        }
      }
      
      // 5. 파일 크기 제한 (총 10MB, 파일당 1MB)
      const filteredFiles = codeFiles.filter((file: any) => file.size <= 1024 * 1024);
      let totalSize = filteredFiles.reduce((sum: number, file: any) => sum + file.size, 0);
      
      if (totalSize > 10 * 1024 * 1024) {
        // 크기순 정렬해서 10MB 이내로 제한
        filteredFiles.sort((a: any, b: any) => a.size - b.size);
        const selectedFiles = [];
        totalSize = 0;
        
        for (const file of filteredFiles) {
          if (totalSize + file.size <= 10 * 1024 * 1024) {
            selectedFiles.push(file);
            totalSize += file.size;
          } else {
            break;
          }
        }
        filteredFiles.splice(0, filteredFiles.length, ...selectedFiles);
      }
      
      // 6. 파일 내용 가져오기 (병렬 처리)
      const fileContents = await Promise.all(
        filteredFiles.slice(0, 50).map(async (file: any) => { // 최대 50개 파일
          try {
            const content = await this.fetchFileContent(
              repoInfo.owner, 
              repoInfo.repo, 
              file.path, 
              ref
            );
            
            return {
              path: file.path,
              content: content,
              size: file.size,
              type: this.getFileType(file.path),
              language: this.detectLanguage(file.path)
            };
          } catch (error) {
            logger.warn(`Failed to fetch file content: ${file.path}`, error);
            return null;
          }
        })
      );
      
      const validFiles = fileContents.filter((file): file is GitHubFile => file !== null);
      
      // 7. 언어별 파일 수 계산
      const languages: { [key: string]: number } = {};
      validFiles.forEach(file => {
        if (file.language) {
          languages[file.language] = (languages[file.language] || 0) + 1;
        }
      });
      
      // 8. 폴더 구조 생성
      const structure = this.generateDirectoryStructure(validFiles.map(f => f.path));
      
      const result: RepositoryContent = {
        files: validFiles,
        structure,
        metadata: {
          totalFiles: validFiles.length,
          totalSize,
          languages,
          lastCommit: {
            sha: commitData.sha,
            message: commitData.commit.message,
            author: commitData.commit.author.name,
            date: commitData.commit.author.date
          }
        }
      };
      
      const processingTime = Date.now() - startTime;
      logger.info(`Repository content fetched successfully: ${validFiles.length} files (${Math.round(totalSize/1024)}KB) in ${processingTime}ms`);
      
      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Failed to fetch repository content:', { url, error, processingTime });
      
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      
      throw new ExternalServiceError('GitHub', `Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 개별 파일 내용 가져오기
   */
  private async fetchFileContent(owner: string, repo: string, path: string, ref: string): Promise<string> {
    const response = await this.apiRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);
    
    if (response.encoding === 'base64') {
      return Buffer.from(response.content, 'base64').toString('utf-8');
    }
    
    return response.content;
  }

  /**
   * GitHub API 요청
   */
  private async apiRequest(endpoint: string): Promise<any> {
    const headers: { [key: string]: string } = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AssignmentsFeedbackBot/1.0'
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        headers,
        timeout: 10000 // 10초 타임아웃
      });
      
      // Rate limit 정보 업데이트
      this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '60');
      
      if (this.rateLimitRemaining < 10) {
        logger.warn(`GitHub API rate limit low: ${this.rateLimitRemaining} requests remaining`);
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        
        if (status === 404) {
          throw new ExternalServiceError('GitHub', 'Repository not found or not accessible');
        } else if (status === 403) {
          throw new ExternalServiceError('GitHub', 'API rate limit exceeded or access denied');
        } else if (status === 401) {
          throw new ExternalServiceError('GitHub', 'Authentication failed');
        }
        
        throw new ExternalServiceError('GitHub', `GitHub API error: ${message}`);
      }
      
      throw error;
    }
  }

  /**
   * 코드 파일인지 확인
   */
  private isCodeFile(path: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', // JavaScript/TypeScript
      '.py', '.pyx', '.pyi',        // Python
      '.java', '.class',            // Java
      '.cpp', '.cc', '.cxx', '.c++', '.c', '.h', '.hpp', // C/C++
      '.cs',                        // C#
      '.php',                       // PHP
      '.rb',                        // Ruby
      '.go',                        // Go
      '.rs',                        // Rust
      '.swift',                     // Swift
      '.kt', '.kts',                // Kotlin
      '.scala',                     // Scala
      '.html', '.htm',              // HTML
      '.css', '.scss', '.sass',     // CSS
      '.vue',                       // Vue
      '.json', '.xml',              // Data formats
      '.md', '.txt',                // Documentation
      '.sql',                       // Database
      '.sh', '.bash',               // Shell scripts
      '.dockerfile', '.yml', '.yaml' // Config files
    ];
    
    const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
    return codeExtensions.includes(ext) || path.toLowerCase().includes('dockerfile');
  }

  /**
   * 파일 타입 감지
   */
  private getFileType(path: string): string {
    const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
    
    const typeMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.html': 'html',
      '.css': 'css',
      '.vue': 'vue',
      '.json': 'json',
      '.md': 'markdown'
    };
    
    return typeMap[ext] || 'text';
  }

  /**
   * 프로그래밍 언어 감지
   */
  private detectLanguage(path: string): string | undefined {
    const ext = path.toLowerCase().substring(path.lastIndexOf('.'));
    
    const languageMap: { [key: string]: string } = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.html': 'HTML',
      '.css': 'CSS',
      '.vue': 'Vue'
    };
    
    return languageMap[ext];
  }

  /**
   * 디렉토리 구조 생성
   */
  private generateDirectoryStructure(paths: string[]): string {
    const tree: { [key: string]: any } = {};
    
    paths.forEach(path => {
      const parts = path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // 파일
          current[part] = null;
        } else {
          // 디렉토리
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });
    
    return this.treeToString(tree, '');
  }

  /**
   * 트리 구조를 문자열로 변환
   */
  private treeToString(tree: any, prefix: string): string {
    const entries = Object.entries(tree);
    let result = '';
    
    entries.forEach(([name, children], index) => {
      const isLast = index === entries.length - 1;
      const currentPrefix = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      
      result += `${prefix}${currentPrefix}${name}\n`;
      
      if (children && typeof children === 'object') {
        result += this.treeToString(children, nextPrefix);
      }
    });
    
    return result;
  }

  /**
   * API 사용량 확인
   */
  getRateLimit(): { remaining: number; authenticated: boolean } {
    return {
      remaining: this.rateLimitRemaining,
      authenticated: !!this.token
    };
  }

  /**
   * 서비스 가용성 확인
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.apiRequest('/rate_limit');
      return true;
    } catch (error) {
      logger.error('GitHub service availability check failed:', error);
      return false;
    }
  }
}