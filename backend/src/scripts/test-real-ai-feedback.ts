/**
 * 실제 GitHub 저장소와 Claude API를 사용한 AI 피드백 테스트
 */

import { AIService } from '../services/AIService';
import { GitHubService } from '../services/GitHubService';
import { CacheService } from '../services/CacheService';
import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testRealAIFeedback() {
  console.log('🚀 실제 AI 피드백 테스트 시작...\n');

  // 서비스 초기화
  const cacheService = new CacheService();
  const aiService = new AIService(cacheService);
  const githubService = new GitHubService();

  // AI 서비스 가용성 확인
  const modelInfo = aiService.getModelInfo();
  console.log('📋 AI 모델 정보:', modelInfo);
  
  const isAIAvailable = await aiService.isAvailable();
  console.log('🤖 AI 서비스 상태:', isAIAvailable ? '✅ 사용 가능' : '❌ 사용 불가');
  
  if (!isAIAvailable) {
    console.error('❌ AI 서비스를 사용할 수 없습니다. API 키를 확인해주세요.');
    return;
  }

  try {
    // 1. GitHub에서 코드 가져오기
    console.log('\n📂 GitHub 저장소에서 코드 가져오기...');
    const repoUrl = 'https://github.com/mindongdong/cislab-web-study';
    const folderPath = 'frontend/assignments/week05_assignment/example';
    
    console.log(`📍 저장소: ${repoUrl}`);
    console.log(`📁 폴더: ${folderPath}`);
    
    const startFetch = Date.now();
    const repoContent = await githubService.fetchRepositoryContent(repoUrl, folderPath);
    const fetchTime = Date.now() - startFetch;
    
    console.log('✅ 코드 가져오기 완료!');
    console.log(`⏱️  소요 시간: ${fetchTime}ms`);
    console.log(`📄 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    console.log(`🔤 언어: ${Object.keys(repoContent.metadata.languages).join(', ')}`);
    
    // 파일 목록 출력
    console.log('\n📝 가져온 파일 목록:');
    repoContent.files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.path} (${file.language || 'unknown'})`);
    });
    
    // 2. 코드 내용 통합
    const codeContent = repoContent.files.map(file => 
      `## ${file.path}\n\n\`\`\`${file.language || 'text'}\n${file.content}\n\`\`\``
    ).join('\n\n');
    
    const fullContent = `# GitHub 저장소: ${repoUrl}\n\n` +
      `## 폴더: ${folderPath}\n\n` +
      `## 프로젝트 구조\n\`\`\`\n${repoContent.structure}\n\`\`\`\n\n` +
      `## 파일 내용\n\n${codeContent}`;
    
    // 3. AI 피드백 생성
    console.log('\n🤖 AI 피드백 생성 중...');
    
    const feedbackRequest = {
      assignment: {
        code: 'WEEK05',
        title: 'React.js 독서 기록장 만들기 (Week 5)',
        requirements: [
          'React 컴포넌트 구조 설계 (App, BookForm, BookList, BookItem)',
          'useState를 사용한 상태 관리',
          'useRef를 사용한 DOM 조작',
          'Props를 통한 컴포넌트 간 데이터 전달',
          '이벤트 처리 (추가, 삭제, 수정)',
          '폼 입력 처리 및 유효성 검사',
          '리스트 렌더링과 key 속성 활용',
          '컴포넌트 분리와 재사용성'
        ],
        recommendations: [
          '적절한 컴포넌트 구조와 역할 분담',
          '깔끔한 UI/UX 디자인',
          'React Hook의 올바른 사용',
          '코드 가독성과 유지보수성',
          '에러 처리와 예외 상황 대응',
          'CSS 스타일링과 반응형 디자인'
        ],
        category: 'programming' as const
      },
      submission: {
        type: 'code' as const,
        content: fullContent,
        url: `${repoUrl}/tree/main/${folderPath}`,
        title: 'React 독서 기록장 예제 구현',
        metadata: {
          github: {
            repoInfo: githubService.parseRepositoryUrl(repoUrl),
            folderPath: folderPath,
            totalFiles: repoContent.metadata.totalFiles,
            totalSize: repoContent.metadata.totalSize,
            languages: repoContent.metadata.languages,
            lastCommit: repoContent.metadata.lastCommit
          }
        }
      }
    };
    
    const startAI = Date.now();
    const feedback = await aiService.generateFeedback(feedbackRequest);
    const aiTime = Date.now() - startAI;
    
    console.log('✅ AI 피드백 생성 완료!');
    console.log(`⏱️  소요 시간: ${aiTime}ms`);
    console.log(`🔢 총점: ${feedback.score}/100`);
    
    // 4. 피드백 내용 출력
    console.log('\n' + '='.repeat(80));
    console.log('📊 AI 피드백 세부 점수');
    console.log('='.repeat(80));
    console.log(`• 요구사항 충족: ${feedback.criteria_scores.requirements_met}/40`);
    console.log(`• 코드 품질: ${feedback.criteria_scores.code_quality}/30`);
    console.log(`• 모범 사례: ${feedback.criteria_scores.best_practices}/20`);
    console.log(`• 창의성: ${feedback.criteria_scores.creativity}/10`);
    
    console.log('\n' + '='.repeat(80));
    console.log('💬 AI 피드백 내용');
    console.log('='.repeat(80));
    console.log(feedback.content);
    
    // 5. 모델 정보 출력
    console.log('\n' + '='.repeat(80));
    console.log('ℹ️  모델 정보');
    console.log('='.repeat(80));
    console.log(`• 모델: ${feedback.model_info.model}`);
    console.log(`• 토큰 사용량: ${feedback.model_info.tokens_used}`);
    console.log(`• 캐시 상태: ${feedback.cache_info.cached ? '캐시됨' : '새로 생성'}`);
    console.log(`• 응답 시간: ${feedback.cache_info.response_time_ms}ms`);
    
    // 6. 성능 메트릭 출력
    const metrics = aiService.getPerformanceMetrics();
    console.log('\n' + '='.repeat(80));
    console.log('📈 성능 메트릭');
    console.log('='.repeat(80));
    console.log(`• 평균 응답 시간: ${Math.round(metrics.avgResponseTime)}ms`);
    console.log(`• 캐시 히트율: ${Math.round(metrics.cacheHitRate * 100)}%`);
    console.log(`• 총 요청 수: ${metrics.totalRequests}`);
    
    console.log('\n✨ 테스트 완료!');
    
  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      
      // API 키 관련 오류 확인
      if (error.message.includes('API key') || error.message.includes('authentication')) {
        console.error('\n⚠️  API 키를 확인해주세요:');
        console.error('  - ANTHROPIC_API_KEY가 올바른지 확인');
        console.error('  - API 키에 충분한 권한이 있는지 확인');
      }
      
      // Rate limit 오류 확인
      if (error.message.includes('rate limit')) {
        console.error('\n⚠️  API 사용량 제한에 도달했습니다.');
        console.error('  잠시 후 다시 시도해주세요.');
      }
    }
  } finally {
    // Redis 연결 종료
    await cacheService.quit();
  }
}

// 스크립트 실행
if (require.main === module) {
  testRealAIFeedback()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testRealAIFeedback };