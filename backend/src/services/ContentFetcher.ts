import axios from 'axios';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';
import { parseGitHubUrl, sanitizeContent, retryWithBackoff } from '../utils/helpers';

export interface NotionContent {
  content: string;
  title: string;
  lastModified: string;
}

export interface ScrapedContent {
  content: string;
  title: string;
  url: string;
  domain: string;
}

export interface RepoContent {
  files: FileContent[];
  structure: string;
  readme?: string;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  type: string;
}

export interface CloneOptions {
  branch?: string;
  specificFolder?: string;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
}

export class ContentFetcher {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
      headers: {
        'User-Agent': 'AssignmentBot/1.0',
      },
    });
  }

  /**
   * Fetch content from Notion page
   */
  async fetchNotionPage(url: string): Promise<NotionContent> {
    try {
      // Extract page ID from Notion URL
      const pageIdMatch = url.match(/([a-f0-9]{32})|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
      if (!pageIdMatch) {
        throw new Error('Invalid Notion URL format');
      }

      const pageId = pageIdMatch[0].replace(/-/g, '');

      // Note: This requires Notion API integration
      // For now, we'll use web scraping as fallback
      return await this.scrapeNotionPage(url);
    } catch (error) {
      logger.error('Notion content fetch failed:', error);
      throw new ExternalServiceError('Notion', '노션 페이지 내용을 가져올 수 없습니다.');
    }
  }

  /**
   * Scrape Notion page content (fallback method)
   */
  private async scrapeNotionPage(url: string): Promise<NotionContent> {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.axiosInstance.get(url);
      });

      const html = response.data;
      
      // Basic HTML parsing to extract content
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(' | Notion', '') : 'Untitled';

      // Extract main content (this is a simplified approach)
      const contentMatch = html.match(/<div[^>]*class="notion-page-content"[^>]*>([\s\S]*?)<\/div>/i);
      let content = contentMatch ? contentMatch[1] : '';

      // Clean up HTML and convert to markdown-like format
      content = content
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        content: sanitizeContent(content),
        title: title.trim(),
        lastModified: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Notion scraping failed:', error);
      throw new ExternalServiceError('Notion', '노션 페이지를 읽을 수 없습니다.');
    }
  }

  /**
   * Generic web content scraping
   */
  async scrapeWebContent(url: string): Promise<ScrapedContent> {
    try {
      const response = await retryWithBackoff(async () => {
        return await this.axiosInstance.get(url, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          },
        });
      });

      const html = response.data;
      const domain = new URL(url).hostname;

      // Extract title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

      // Extract main content based on common patterns
      let content = '';
      
      // Try various content selectors
      const contentSelectors = [
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<main[^>]*>([\s\S]*?)<\/main>/i,
        /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<body[^>]*>([\s\S]*?)<\/body>/i,
      ];

      for (const selector of contentSelectors) {
        const match = html.match(selector);
        if (match) {
          content = match[1];
          break;
        }
      }

      // Clean up HTML
      content = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
        .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        content: sanitizeContent(content),
        title: title,
        url: url,
        domain: domain,
      };
    } catch (error) {
      logger.error('Web scraping failed:', { url, error });
      throw new ExternalServiceError('WebScraper', '웹 페이지 내용을 가져올 수 없습니다.');
    }
  }

  /**
   * Clone and process GitHub repository
   */
  async cloneGitHubRepo(url: string, options: CloneOptions = {}): Promise<RepoContent> {
    try {
      const { branch = 'main', specificFolder, maxFiles = 20, maxFileSize = 1024 * 1024 } = options;
      
      const repoInfo = parseGitHubUrl(url);
      if (!repoInfo) {
        throw new Error('Invalid GitHub URL');
      }

      // Use GitHub API to fetch repository content
      const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/contents`;
      const targetUrl = specificFolder ? `${apiUrl}/${specificFolder}` : apiUrl;

      const headers: any = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AssignmentBot/1.0',
      };

      // Add GitHub token if available
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const response = await retryWithBackoff(async () => {
        return await this.axiosInstance.get(targetUrl, {
          headers,
          params: { ref: branch },
        });
      });

      const items = Array.isArray(response.data) ? response.data : [response.data];
      const files: FileContent[] = [];

      // Process files recursively
      await this.processGitHubItems(items, files, repoInfo, branch, maxFiles, maxFileSize, headers);

      // Get README if exists
      let readme: string | undefined;
      try {
        const readmeResponse = await this.axiosInstance.get(
          `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/readme`,
          { headers, params: { ref: branch } }
        );
        
        if (readmeResponse.data.content) {
          readme = Buffer.from(readmeResponse.data.content, 'base64').toString('utf-8');
        }
      } catch (error) {
        // README not found, ignore
      }

      // Generate structure overview
      const structure = this.generateStructureOverview(files);

      return {
        files,
        structure,
        readme,
      };
    } catch (error) {
      logger.error('GitHub repo cloning failed:', { url, error });
      throw new ExternalServiceError('GitHub', 'GitHub 저장소에 접근할 수 없습니다.');
    }
  }

  /**
   * Process GitHub API items recursively
   */
  private async processGitHubItems(
    items: any[],
    files: FileContent[],
    repoInfo: { owner: string; repo: string },
    branch: string,
    maxFiles: number,
    maxFileSize: number,
    headers: any,
    currentPath: string = ''
  ): Promise<void> {
    for (const item of items) {
      if (files.length >= maxFiles) {
        break;
      }

      if (item.type === 'file') {
        // Check file size
        if (item.size > maxFileSize) {
          logger.warn(`File too large, skipping: ${item.path} (${item.size} bytes)`);
          continue;
        }

        // Check if file type is relevant (code files)
        const relevantExtensions = [
          '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
          '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj',
          '.html', '.css', '.scss', '.less', '.vue', '.svelte',
          '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.env'
        ];

        const hasRelevantExtension = relevantExtensions.some(ext => 
          item.name.toLowerCase().endsWith(ext)
        );

        if (!hasRelevantExtension) {
          continue;
        }

        try {
          // Fetch file content
          const fileResponse = await this.axiosInstance.get(item.url, { headers });
          
          if (fileResponse.data.content) {
            const content = Buffer.from(fileResponse.data.content, 'base64').toString('utf-8');
            
            files.push({
              path: item.path,
              content: sanitizeContent(content),
              size: item.size,
              type: item.name.split('.').pop() || 'unknown',
            });
          }
        } catch (error) {
          logger.warn(`Failed to fetch file content: ${item.path}`, error);
        }
      } else if (item.type === 'dir' && files.length < maxFiles) {
        // Recursively process directory
        try {
          const dirResponse = await this.axiosInstance.get(item.url, { headers });
          await this.processGitHubItems(
            dirResponse.data,
            files,
            repoInfo,
            branch,
            maxFiles,
            maxFileSize,
            headers,
            item.path
          );
        } catch (error) {
          logger.warn(`Failed to process directory: ${item.path}`, error);
        }
      }
    }
  }

  /**
   * Generate structure overview from files
   */
  private generateStructureOverview(files: FileContent[]): string {
    const structure: { [key: string]: string[] } = {};
    
    files.forEach(file => {
      const pathParts = file.path.split('/');
      const dir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'root';
      
      if (!structure[dir]) {
        structure[dir] = [];
      }
      
      structure[dir].push(pathParts[pathParts.length - 1]);
    });

    let overview = '# Project Structure\n\n';
    
    Object.keys(structure).sort().forEach(dir => {
      overview += `## ${dir}\n`;
      structure[dir].sort().forEach(file => {
        overview += `- ${file}\n`;
      });
      overview += '\n';
    });

    return overview;
  }

  /**
   * Extract content from URL based on type
   */
  async extractContentFromUrl(url: string, type: 'notion' | 'blog'): Promise<{
    content: string;
    title: string;
    metadata?: any;
  }> {
    try {
      if (type === 'notion' || url.includes('notion.so')) {
        const notionContent = await this.fetchNotionPage(url);
        return {
          content: notionContent.content,
          title: notionContent.title,
          metadata: { lastModified: notionContent.lastModified },
        };
      } else {
        const webContent = await this.scrapeWebContent(url);
        return {
          content: webContent.content,
          title: webContent.title,
          metadata: { domain: webContent.domain },
        };
      }
    } catch (error) {
      logger.error('Content extraction failed:', { url, type, error });
      throw new ExternalServiceError('ContentFetcher', '내용을 가져올 수 없습니다.');
    }
  }
}