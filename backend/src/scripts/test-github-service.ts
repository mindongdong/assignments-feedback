/**
 * GitHub 서비스 테스트 스크립트
 */

import { GitHubService } from '../services/GitHubService';

async function testGitHubService() {
  console.log('🐙 GitHub 서비스 테스트 시작...');

  const githubService = new GitHubService();

  // 1. 서비스 가용성 확인
  console.log('🌐 GitHub API 가용성 확인 중...');
  const isAvailable = await githubService.isAvailable();
  console.log('GitHub API 상태:', isAvailable ? '✅ 사용 가능' : '❌ 사용 불가');

  // 2. URL 파싱 테스트
  console.log('\n📝 GitHub URL 파싱 테스트...');
  
  const testUrls = [
    'https://github.com/microsoft/TypeScript',
    'https://github.com/facebook/react',
    'https://github.com/vercel/next.js/tree/canary',
    'https://github.com/vercel/next.js/tree/canary/packages/next',
    'git@github.com:nodejs/node.git'
  ];

  for (const url of testUrls) {
    try {
      const parsed = githubService.parseRepositoryUrl(url);
      console.log(`✅ ${url}`);
      console.log(`   → Owner: ${parsed.owner}, Repo: ${parsed.repo}, Ref: ${parsed.ref}, Folder: ${parsed.folderPath || 'none'}`);
    } catch (error) {
      console.log(`❌ ${url}`);
      console.log(`   → Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 3. 실제 저장소 콘텐츠 가져오기 테스트 (작은 저장소)
  console.log('\n📂 저장소 콘텐츠 가져오기 테스트...');
  
  try {
    // TypeScript의 작은 예제 저장소 사용
    const testRepoUrl = 'https://github.com/octocat/Hello-World';
    console.log(`저장소: ${testRepoUrl}`);
    
    const startTime = Date.now();
    const content = await githubService.fetchRepositoryContent(testRepoUrl);
    const endTime = Date.now();

    console.log('✅ 저장소 콘텐츠 가져오기 성공!');
    console.log(`⏱️  처리 시간: ${endTime - startTime}ms`);
    console.log(`📄 총 파일 수: ${content.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(content.metadata.totalSize / 1024)}KB`);
    console.log('🔤 감지된 언어들:', Object.keys(content.metadata.languages).join(', '));
    
    console.log('\n📁 프로젝트 구조:');
    console.log(content.structure.split('\n').slice(0, 20).join('\n'));
    
    console.log('\n📝 파일 샘플 (처음 3개):');
    content.files.slice(0, 3).forEach((file, index) => {
      console.log(`${index + 1}. ${file.path} (${file.language || 'unknown'}) - ${file.size} bytes`);
      console.log(`   내용: ${file.content.substring(0, 100)}...`);
    });

    if (content.metadata.lastCommit) {
      console.log('\n🔄 최근 커밋:');
      console.log(`   SHA: ${content.metadata.lastCommit.sha.substring(0, 8)}`);
      console.log(`   Message: ${content.metadata.lastCommit.message.split('\n')[0]}`);
      console.log(`   Author: ${content.metadata.lastCommit.author}`);
      console.log(`   Date: ${content.metadata.lastCommit.date}`);
    }

  } catch (error) {
    console.error('❌ 저장소 콘텐츠 가져오기 실패:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
    }
  }

  // 4. 폴더 경로 지정 테스트
  console.log('\\n📁 특정 폴더 콘텐츠 가져오기 테스트...');
  
  try {
    // 특정 폴더만 가져오기 테스트 - React 저장소의 packages/react 폴더 테스트
    const testRepoUrlWithFolder = 'https://github.com/facebook/react';
    const folderPath = 'packages/react/src'; // React 소스 폴더만 가져오기
    console.log(`저장소: ${testRepoUrlWithFolder}`);
    console.log(`폴더: ${folderPath}`);
    
    const startTime2 = Date.now();
    const folderContent = await githubService.fetchRepositoryContent(testRepoUrlWithFolder, folderPath);
    const endTime2 = Date.now();

    console.log('✅ 폴더 콘텐츠 가져오기 성공!');
    console.log(`⏱️  처리 시간: ${endTime2 - startTime2}ms`);
    console.log(`📄 폴더 내 파일 수: ${folderContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(folderContent.metadata.totalSize / 1024)}KB`);
    
    console.log('\\n📁 폴더 구조:');
    console.log(folderContent.structure);
    
    console.log('\\n📝 폴더 내 파일 목록:');
    folderContent.files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path} (${file.language || 'unknown'})`);
    });

  } catch (error) {
    console.error('❌ 폴더 콘텐츠 가져오기 실패:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
    }
  }

  // 5. Rate limit 정보 확인
  const rateLimit = githubService.getRateLimit();
  console.log('\n📊 GitHub API Rate Limit:');
  console.log(`   남은 요청 수: ${rateLimit.remaining}`);
  console.log(`   인증 상태: ${rateLimit.authenticated ? '✅ 인증됨' : '❌ 미인증'}`);

  console.log('\n🎉 GitHub 서비스 테스트 완료!');
}

if (require.main === module) {
  testGitHubService()
    .then(() => {
      console.log('테스트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testGitHubService };