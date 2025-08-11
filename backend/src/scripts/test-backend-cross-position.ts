/**
 * 백엔드 과제로 프론트엔드 코드 평가 테스트
 * - backend_assignment.md 과제로 frontend 코드를 평가
 * - position은 backend로 설정
 * - 실제 GitHub 코드 가져와서 AI 피드백 생성
 */

import { AIService } from '../services/AIService';
import { GitHubService } from '../services/GitHubService';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 백엔드 과제 평가 기준 (backend_assignment.md 기반)
const backendEvaluationCriteria = [
  {
    title: '데이터베이스 모델링',
    points: 20,
    details: [
      'Book, Category 테이블 스키마 설계',
      'ORM 모델 클래스 구현',
      '관계 설정 및 제약조건 구현',
      '타임스탬프 자동 처리'
    ]
  },
  {
    title: 'API 엔드포인트 구현',
    points: 25,
    details: [
      '모든 필수 CRUD 엔드포인트 구현',
      'RESTful API 설계 원칙 준수',
      '적절한 HTTP 메서드와 상태 코드 사용',
      '일관된 응답 형식 구현'
    ]
  },
  {
    title: 'SQLAlchemy ORM 활용',
    points: 20,
    details: [
      '효율적인 쿼리 작성',
      '관계 데이터 조회 최적화 (N+1 문제 해결)',
      '트랜잭션 처리',
      '필터링, 정렬, 페이지네이션 구현'
    ]
  },
  {
    title: '유효성 검증 및 에러 처리',
    points: 15,
    details: [
      'Pydantic 스키마를 활용한 데이터 검증',
      '적절한 에러 메시지와 상태 코드 반환',
      '예외 상황 처리 (404, 400, 500 등)',
      '비즈니스 로직 검증'
    ]
  },
  {
    title: '검색 및 필터링 기능',
    points: 15,
    details: [
      '검색 기능의 정확성',
      '필터링 조건 조합 처리',
      '재고 관리 기능의 안정성',
      '페이지네이션 메타 정보 제공'
    ]
  },
  {
    title: '문서화 및 코드 품질',
    points: 5,
    details: [
      'README.md의 완성도',
      'API 문서의 명확성',
      '코드 구조화 및 모듈화',
      '타입 힌트 사용'
    ]
  }
];

async function testBackendCrossPosition() {
  console.log('🚀 백엔드 과제로 프론트엔드 코드 평가 테스트 시작...\n');
  console.log('📋 과제: FastAPI + SQLAlchemy 실습 과제 (backend_assignment.md)');
  console.log('💻 평가 대상: 프론트엔드 React 코드');
  console.log('🎯 Position: backend\n');

  // 서비스 초기화
  const aiService = new AIService();
  const githubService = new GitHubService();

  // 서비스 가용성 확인
  const isAIAvailable = await aiService.isAvailable();
  const isGitHubAvailable = await githubService.isAvailable();
  
  console.log('🤖 AI 서비스 상태:', isAIAvailable ? '✅ 사용 가능' : '❌ 사용 불가');
  console.log('🐙 GitHub 서비스 상태:', isGitHubAvailable ? '✅ 사용 가능' : '❌ 사용 불가');
  
  if (!isAIAvailable) {
    console.error('❌ AI 서비스를 사용할 수 없습니다.');
    return;
  }

  try {
    // 1. GitHub에서 프론트엔드 코드 가져오기
    console.log('\n📂 GitHub에서 프론트엔드 코드 가져오는 중...');
    let repoContent: any;
    let githubTime = 0;
    const repoUrl = 'https://github.com/mindongdong/cislab-web-study/tree/main/frontend/members/choi-seonmi/week5';
    
    if (isGitHubAvailable) {
      console.log(`🌐 GitHub URL: ${repoUrl}`);
      const startGitHub = Date.now();
      try {
        repoContent = await githubService.fetchRepositoryContent(repoUrl);
        githubTime = Date.now() - startGitHub;
      } catch (error) {
        console.log(`⚠️ GitHub 코드 가져오기 실패: ${error}`);
        console.log('📝 샘플 프론트엔드 코드 사용...');
        repoContent = getSampleFrontendCode();
      }
    } else {
      console.log('📝 GitHub API 사용 불가. 샘플 프론트엔드 코드 사용...');
      repoContent = getSampleFrontendCode();
    }
    
    console.log('✅ 코드 가져오기 완료!');
    console.log(`⏱️  처리 시간: ${githubTime}ms`);
    console.log(`📄 총 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    
    // 2. 코드 내용 통합
    console.log('\n📝 분석 대상 파일들:');
    const allFiles = repoContent.files;
    
    allFiles.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.path} (${file.language || 'text'})`);
    });
    
    // 코드 내용 통합
    let combinedCode = '# 프론트엔드 코드 (백엔드 과제로 평가)\n\n';
    combinedCode += '## 프로젝트 구조\n';
    combinedCode += '```\n' + repoContent.structure + '\n```\n\n';
    
    // 각 파일의 코드 추가
    for (const file of allFiles) {
      combinedCode += `## ${file.path}\n\n`;
      combinedCode += '```' + (file.language || 'text') + '\n';
      combinedCode += file.content;
      combinedCode += '\n```\n\n';
    }
    
    // 3. 백엔드 과제로 AI 피드백 생성
    console.log('\n🤖 백엔드 관점에서 AI 피드백 생성 중...');
    console.log('⚠️ 참고: 프론트엔드 코드를 백엔드 과제 기준으로 평가합니다.');
    
    const feedbackRequest = {
      assignment: {
        code: 'FASTAPI_CROSS_TEST',
        title: 'FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축',
        requirements: [
          '데이터베이스 모델링 (Book, Category 테이블 구현)',
          'RESTful API 엔드포인트 구현 (CRUD)',
          'SQLAlchemy ORM을 활용한 데이터 처리',
          '검색, 필터링, 페이지네이션 기능',
          '재고 관리 기능 구현',
          'Pydantic 스키마를 통한 유효성 검증',
          '적절한 에러 처리 및 응답 형식',
          'FastAPI 프레임워크 활용'
        ],
        recommendations: [
          'SQLAlchemy의 관계 설정 및 최적화',
          'FastAPI의 의존성 주입 활용',
          '비동기 처리 고려',
          '적절한 HTTP 상태 코드 사용',
          '트랜잭션 처리 및 예외 관리',
          'API 문서화 및 스키마 정의'
        ],
        category: 'backend' as const,
        position: 'backend', // 백엔드 position으로 설정
        evaluationCriteria: backendEvaluationCriteria,
        difficulty: 'intermediate' as const
      },
      submission: {
        type: 'code' as const,
        content: combinedCode,
        url: repoUrl,
        title: '프론트엔드 코드 (백엔드 과제로 평가)'
      },
      user_context: {
        previous_submissions: 2,
        average_score: 75,
        learning_level: 'intermediate' as const,
        preferred_feedback_style: 'detailed' as const,
        cultural_context: 'korean_academic' as const
      }
    };
    
    const startAI = Date.now();
    const feedback = await aiService.generateFeedback(feedbackRequest);
    const aiTime = Date.now() - startAI;
    
    console.log('✅ AI 피드백 생성 완료!');
    console.log(`⏱️  소요 시간: ${aiTime}ms`);
    console.log(`🔢 총점: ${feedback.score}/100`);
    console.log('📊 세부 점수:');
    console.log(`  - 요구사항 충족도: ${feedback.criteria_scores.requirements_met}/100`);
    console.log(`  - 코드 품질: ${feedback.criteria_scores.code_quality}/100`);
    console.log(`  - 모범 사례 적용: ${feedback.criteria_scores.best_practices}/100`);
    console.log(`  - 창의성: ${feedback.criteria_scores.creativity}/100`);
    
    // 4. 피드백 결과를 마크다운 파일로 저장
    console.log('\n📄 피드백 결과를 MD 파일로 저장 중...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputDir = path.resolve(__dirname, '../../feedback-results');
    const outputFile = path.join(outputDir, `backend-cross-position-feedback-${timestamp}.md`);
    
    // 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 마크다운 문서 생성
    let markdownContent = `# AI 피드백 보고서: 백엔드 과제로 프론트엔드 코드 평가\n\n`;
    markdownContent += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    markdownContent += `**과제 문서**: backend_assignment.md\n`;
    markdownContent += `**평가 코드**: 프론트엔드 React 코드\n`;
    markdownContent += `**GitHub URL**: ${repoUrl}\n`;
    markdownContent += `**Position**: backend\n`;
    markdownContent += `**총점**: ${feedback.score}/100\n\n`;
    
    markdownContent += `> ⚠️ **주의**: 이 테스트는 프론트엔드 코드를 백엔드 과제 기준으로 평가한 실험적 결과입니다.\n\n`;
    
    markdownContent += `---\n\n`;
    
    // 세부 점수
    markdownContent += `## 📊 평가 결과\n\n`;
    markdownContent += `### 세부 점수\n`;
    markdownContent += `- **요구사항 충족도**: ${feedback.criteria_scores.requirements_met}/100\n`;
    markdownContent += `- **코드 품질**: ${feedback.criteria_scores.code_quality}/100\n`;
    markdownContent += `- **모범 사례 적용**: ${feedback.criteria_scores.best_practices}/100\n`;
    markdownContent += `- **창의성**: ${feedback.criteria_scores.creativity}/100\n\n`;
    
    // 평가 기준별 점수
    markdownContent += `### 평가 기준별 점수 (백엔드 기준)\n\n`;
    backendEvaluationCriteria.forEach((criterion) => {
      markdownContent += `#### ${criterion.title} (${criterion.points}점)\n`;
      criterion.details.forEach(detail => {
        markdownContent += `- ${detail}\n`;
      });
      markdownContent += '\n';
    });
    
    markdownContent += `---\n\n`;
    
    // AI 피드백 내용
    markdownContent += `## 💬 상세 피드백\n\n`;
    markdownContent += feedback.content;
    markdownContent += `\n\n`;
    
    // 메타 정보
    markdownContent += `---\n\n`;
    markdownContent += `## ℹ️ 메타 정보\n\n`;
    markdownContent += `- **AI 모델**: ${feedback.model_info.model}\n`;
    markdownContent += `- **Provider**: ${feedback.model_info.provider}\n`;
    markdownContent += `- **응답 시간**: ${feedback.cache_info.response_time_ms}ms\n`;
    markdownContent += `- **캐시 사용**: ${feedback.cache_info.cache_hit ? '예' : '아니오'}\n`;
    markdownContent += `- **피드백 신뢰도**: ${feedback.feedback_quality.confidence_score}/100\n`;
    markdownContent += `- **실행 가능성**: ${feedback.feedback_quality.actionability}/100\n`;
    
    // 실험 정보 추가
    markdownContent += `\n### 🧪 실험 정보\n\n`;
    markdownContent += `- **실험 유형**: Cross-Position Testing\n`;
    markdownContent += `- **과제 유형**: Backend (FastAPI + SQLAlchemy)\n`;
    markdownContent += `- **코드 유형**: Frontend (React)\n`;
    markdownContent += `- **목적**: Position 설정이 AI 평가에 미치는 영향 분석\n`;
    
    // 분석된 파일 정보 추가
    if (feedback.analyzed_files) {
      markdownContent += `\n### 📁 분석된 파일 구조\n\n`;
      markdownContent += '```\n';
      markdownContent += feedback.analyzed_files.file_tree;
      markdownContent += '\n```\n';
      markdownContent += `- **분석 파일 수**: ${feedback.analyzed_files.file_count}개\n`;
      markdownContent += `- **총 코드 크기**: ${Math.round(feedback.analyzed_files.total_size / 1024)}KB\n`;
    }
    
    // 파일 저장
    await fs.writeFile(outputFile, markdownContent, 'utf-8');
    
    console.log(`✅ 피드백 결과가 저장되었습니다: ${outputFile}`);
    
    // 5. 성능 메트릭 출력
    console.log('\n📈 성능 메트릭');
    console.log('='.repeat(80));
    console.log(`• GitHub 코드 가져오기: ${githubTime}ms`);
    console.log(`• AI 피드백 생성: ${aiTime}ms`);
    console.log(`• 전체 처리 시간: ${githubTime + aiTime}ms`);
    
    console.log('\n🎯 실험 결론');
    console.log('='.repeat(80));
    console.log('• 이 테스트는 백엔드 과제로 프론트엔드 코드를 평가한 결과입니다.');
    console.log('• AI가 코드와 과제 요구사항의 불일치를 어떻게 해석하는지 확인할 수 있습니다.');
    console.log(`• 총점 ${feedback.score}점은 이러한 불일치를 반영한 결과로 해석됩니다.`);
    
    console.log('\n✨ 테스트 완료!');
    
  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
  }
}

// 샘플 프론트엔드 코드 생성 함수
function getSampleFrontendCode() {
  return {
    metadata: {
      totalFiles: 4,
      totalSize: 3072,
      lastCommit: null
    },
    structure: `frontend/members/choi-seonmi/week5/
├── App.js
├── components/
│   ├── BookForm.js
│   ├── BookList.js
│   └── BookItem.js
└── App.css`,
    files: [
      {
        path: 'App.js',
        content: `import React, { useState } from 'react';
import BookForm from './components/BookForm';
import BookList from './components/BookList';
import './App.css';

function App() {
  const [books, setBooks] = useState([]);

  const addBook = (book) => {
    const newBook = {
      ...book,
      id: Date.now()
    };
    setBooks([...books, newBook]);
  };

  const deleteBook = (id) => {
    setBooks(books.filter(book => book.id !== id));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📚 나의 독서 기록장</h1>
        <p>총 {books.length}권의 책을 읽었습니다</p>
      </header>
      
      <main className="App-main">
        <BookForm onAddBook={addBook} />
        <BookList books={books} onDeleteBook={deleteBook} />
      </main>
    </div>
  );
}

export default App;`,
        language: 'javascript',
        size: 800
      },
      {
        path: 'components/BookForm.js',
        content: `import React, { useState, useRef, useEffect } from 'react';

function BookForm({ onAddBook }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    rating: 5,
    memo: ''
  });
  
  const titleInputRef = useRef(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddBook(formData);
    setFormData({ title: '', author: '', rating: 5, memo: '' });
    titleInputRef.current?.focus();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="book-form">
      <h2>새 책 추가</h2>
      <input
        ref={titleInputRef}
        type="text"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="책 제목"
        required
      />
      <input
        type="text"
        name="author"
        value={formData.author}
        onChange={handleChange}
        placeholder="저자"
        required
      />
      <select name="rating" value={formData.rating} onChange={handleChange}>
        {[1, 2, 3, 4, 5].map(num => (
          <option key={num} value={num}>{num}점</option>
        ))}
      </select>
      <textarea
        name="memo"
        value={formData.memo}
        onChange={handleChange}
        placeholder="독서 메모"
      />
      <button type="submit">책 추가</button>
    </form>
  );
}

export default BookForm;`,
        language: 'javascript',
        size: 1200
      },
      {
        path: 'components/BookList.js',
        content: `import React from 'react';
import BookItem from './BookItem';

function BookList({ books, onDeleteBook }) {
  if (books.length === 0) {
    return (
      <div className="empty-state">
        <p>아직 등록된 책이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="book-list">
      <h2>독서 목록</h2>
      {books.map(book => (
        <BookItem
          key={book.id}
          book={book}
          onDelete={onDeleteBook}
        />
      ))}
    </div>
  );
}

export default BookList;`,
        language: 'javascript',
        size: 500
      },
      {
        path: 'components/BookItem.js',
        content: `import React from 'react';

function BookItem({ book, onDelete }) {
  const handleDelete = () => {
    if (window.confirm(\`"\${book.title}"을(를) 삭제하시겠습니까?\`)) {
      onDelete(book.id);
    }
  };

  return (
    <div className="book-item">
      <h3>{book.title}</h3>
      <p>저자: {book.author}</p>
      <div className="book-rating">
        평점: {'⭐'.repeat(book.rating)} ({book.rating}점)
      </div>
      {book.memo && <p className="book-memo">{book.memo}</p>}
      <button onClick={handleDelete} className="delete-button">
        🗑️ 삭제
      </button>
    </div>
  );
}

export default BookItem;`,
        language: 'javascript',
        size: 600
      }
    ]
  };
}

// 스크립트 실행
if (require.main === module) {
  testBackendCrossPosition()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testBackendCrossPosition };