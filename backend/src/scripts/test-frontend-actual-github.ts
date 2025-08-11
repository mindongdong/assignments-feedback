/**
 * 프론트엔드 과제로 실제 GitHub 코드 평가 테스트
 * - frontend_assignment.md 과제로 실제 GitHub frontend 코드를 평가
 * - position은 frontend로 설정
 * - 실제 GitHub 코드 가져와서 AI 피드백 생성
 */

import { AIService } from '../services/AIService';
import { GitHubService } from '../services/GitHubService';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 프론트엔드 과제 평가 기준 (frontend_assignment.md 기반)
const frontendEvaluationCriteria = [
  {
    title: '컴포넌트 분리',
    points: 20,
    details: [
      'App - 메인 컴포넌트 구현',
      'BookForm - 책 정보 입력 폼 컴포넌트',
      'BookList - 책 목록 표시 컴포넌트',
      'BookItem - 개별 책 정보 표시 컴포넌트',
      '적절한 컴포넌트 구조와 역할 분담'
    ]
  },
  {
    title: 'Props 활용',
    points: 20,
    details: [
      '부모-자식 컴포넌트 간 데이터 전달',
      'Props를 통한 이벤트 핸들러 전달',
      '책 데이터 Props 전달 (BookList → BookItem)',
      '콜백 함수 Props 전달 (추가/삭제 기능)'
    ]
  },
  {
    title: 'State 관리',
    points: 20,
    details: [
      'useState를 활용한 책 목록 데이터 관리',
      '폼 입력값 관리 (제목, 저자, 별점, 메모)',
      '상태 업데이트 올바른 구현',
      '초기 상태 설정 적절성'
    ]
  },
  {
    title: '이벤트 처리',
    points: 20,
    details: [
      '폼 제출 이벤트 처리 (책 추가)',
      '삭제 버튼 이벤트 처리',
      '입력 필드 변경 이벤트 처리',
      '이벤트 핸들러 구현의 적절성'
    ]
  },
  {
    title: 'useRef 활용',
    points: 10,
    details: [
      '책 추가 후 첫 번째 입력 필드에 자동 포커스',
      'useRef Hook의 적절한 사용',
      'DOM 요소 접근 구현'
    ]
  },
  {
    title: 'UI/UX',
    points: 10,
    details: [
      '깔끔한 UI 디자인',
      '사용자 친화적인 경험',
      '총 읽은 책 권수 표시',
      '별점 표시 (⭐로 표시)',
      '빈 목록 처리 ("아직 등록된 책이 없습니다" 메시지)'
    ]
  }
];

async function testFrontendActualGitHub() {
  console.log('🚀 프론트엔드 과제로 실제 GitHub 코드 평가 테스트 시작...\n');
  console.log('📋 과제: React.js 실습 과제: 독서 기록장 만들기 (frontend_assignment.md)');
  console.log('💻 평가 대상: 실제 프론트엔드 React 코드');
  console.log('🎯 Position: frontend\n');

  // GitHub URL 입력 받기
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const repoUrl = await new Promise<string>((resolve) => {
    rl.question('🔗 GitHub 저장소 URL을 입력하세요: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!repoUrl) {
    console.error('❌ GitHub URL이 입력되지 않았습니다.');
    return;
  }

  console.log(`\n📂 분석할 GitHub 저장소: ${repoUrl}\n`);

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
    // 1. GitHub에서 실제 프론트엔드 코드 가져오기
    console.log('\n📂 GitHub에서 실제 프론트엔드 코드 가져오는 중...');
    let repoContent: any;
    let githubTime = 0;
    
    if (isGitHubAvailable) {
      console.log(`🌐 GitHub URL: ${repoUrl}`);
      const startGitHub = Date.now();
      try {
        repoContent = await githubService.fetchRepositoryContent(repoUrl);
        githubTime = Date.now() - startGitHub;
        console.log('✅ 실제 GitHub 코드 가져오기 성공!');
      } catch (error) {
        console.log(`⚠️ GitHub 코드 가져오기 실패: ${error}`);
        console.log('📝 샘플 프론트엔드 코드 사용...');
        repoContent = getSampleFrontendCode();
      }
    } else {
      console.log('📝 GitHub API 사용 불가. 샘플 프론트엔드 코드 사용...');
      repoContent = getSampleFrontendCode();
    }
    
    console.log(`⏱️  처리 시간: ${githubTime}ms`);
    console.log(`📄 총 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    
    // 2. 코드 내용 통합 및 분석
    console.log('\n📝 분석 대상 파일들:');
    const codeFiles = repoContent.files.filter((file: any) => 
      (file.path.endsWith('.js') || file.path.endsWith('.jsx') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) &&
      !file.path.includes('node_modules') &&
      !file.path.includes('test')
    );
    
    codeFiles.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.path} (${file.language || 'javascript'})`);
    });
    
    // 코드 내용 통합
    let combinedCode = '# React 독서 기록장 구현\n\n';
    combinedCode += '## 프로젝트 구조\n';
    combinedCode += '```\n' + repoContent.structure + '\n```\n\n';
    
    // 각 파일의 코드 추가
    for (const file of codeFiles) {
      combinedCode += `## ${file.path}\n\n`;
      combinedCode += '```' + (file.language || 'javascript') + '\n';
      combinedCode += file.content;
      combinedCode += '\n```\n\n';
    }
    
    // CSS 파일도 포함 (UI/UX 평가를 위해)
    const cssFiles = repoContent.files.filter((file: any) => 
      file.path.endsWith('.css') && !file.path.includes('node_modules')
    );
    
    if (cssFiles.length > 0) {
      combinedCode += '## 스타일링 파일들\n\n';
      for (const file of cssFiles) {
        combinedCode += `### ${file.path}\n\n`;
        combinedCode += '```css\n';
        combinedCode += file.content || '/* CSS 내용이 비어있거나 읽을 수 없습니다 */';
        combinedCode += '\n```\n\n';
      }
    }
    
    // 3. 프론트엔드 과제로 AI 피드백 생성
    console.log('\n🤖 프론트엔드 관점에서 AI 피드백 생성 중...');
    console.log('✅ 정확한 매칭: 프론트엔드 코드를 프론트엔드 과제 기준으로 평가합니다.');
    
    const feedbackRequest = {
      assignment: {
        code: 'REACT_ACTUAL_TEST',
        title: 'React.js 실습 과제: 독서 기록장 만들기',
        requirements: [
          'App - 메인 컴포넌트 구현',
          'BookForm - 책 정보 입력 폼 컴포넌트 구현',
          'BookList - 책 목록 표시 컴포넌트 구현',
          'BookItem - 개별 책 정보 표시 컴포넌트 구현',
          '제목 입력 필드 구현',
          '저자 입력 필드 구현',
          '별점 선택 기능 (1-5점, 라디오 버튼 또는 select)',
          '간단한 메모 입력 (textarea)',
          '책 추가 기능 구현',
          '책 삭제 기능 (각 BookItem에 삭제 버튼)',
          '총 읽은 책 권수 표시',
          'useRef를 사용하여 책 추가 후 첫 번째 입력 필드에 자동 포커스',
          '입력된 책들을 카드 형태로 표시',
          '각 책 정보에 제목, 저자, 별점(⭐로 표시), 메모 포함',
          '책이 없을 때 "아직 등록된 책이 없습니다" 메시지 표시',
          'useState를 활용한 상태 관리 (books, formData)',
          'Props를 통한 컴포넌트 간 데이터 전달'
        ],
        recommendations: [
          'React Hooks의 적절한 사용 (useState, useRef)',
          '컴포넌트 재사용성과 적절한 역할 분담',
          '이벤트 처리 구현 (폼 제출, 삭제, 입력 변경)',
          '깔끔한 UI/UX 디자인과 사용자 경험',
          '상태 관리 최적화와 Props 활용',
          '별점을 ⭐ 이모지로 시각적 표현',
          'JSX와 React 컴포넌트 구조의 올바른 사용'
        ],
        category: 'frontend' as const,
        position: 'frontend', // 프론트엔드 position으로 설정
        evaluationCriteria: frontendEvaluationCriteria,
        difficulty: 'beginner' as const
      },
      submission: {
        type: 'code' as const,
        content: combinedCode,
        url: repoUrl,
        title: 'React 독서 기록장 구현'
      },
      user_context: {
        previous_submissions: 3,
        average_score: 80,
        learning_level: 'beginner' as const,
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
    const outputFile = path.join(outputDir, `frontend-actual-github-feedback-${timestamp}.md`);
    
    // 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 마크다운 문서 생성
    let markdownContent = `# AI 피드백 보고서: React.js 독서 기록장 (실제 GitHub 코드)\n\n`;
    markdownContent += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    markdownContent += `**과제 문서**: frontend_assignment.md\n`;
    markdownContent += `**평가 코드**: 실제 GitHub 프론트엔드 코드\n`;
    markdownContent += `**GitHub URL**: ${repoUrl}\n`;
    markdownContent += `**Position**: frontend\n`;
    markdownContent += `**총점**: ${feedback.score}/100\n\n`;
    
    markdownContent += `> ✅ **정확한 매칭**: 프론트엔드 코드를 프론트엔드 과제 기준으로 평가한 정상적인 결과입니다.\n\n`;
    
    markdownContent += `---\n\n`;
    
    // 세부 점수
    markdownContent += `## 📊 평가 결과\n\n`;
    markdownContent += `### 세부 점수\n`;
    markdownContent += `- **요구사항 충족도**: ${feedback.criteria_scores.requirements_met}/100\n`;
    markdownContent += `- **코드 품질**: ${feedback.criteria_scores.code_quality}/100\n`;
    markdownContent += `- **모범 사례 적용**: ${feedback.criteria_scores.best_practices}/100\n`;
    markdownContent += `- **창의성**: ${feedback.criteria_scores.creativity}/100\n\n`;
    
    // 평가 기준별 점수
    markdownContent += `### 평가 기준별 점수 (프론트엔드 기준)\n\n`;
    frontendEvaluationCriteria.forEach((criterion) => {
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
    
    // 테스트 정보 추가
    markdownContent += `\n### 🎯 테스트 정보\n\n`;
    markdownContent += `- **테스트 유형**: Actual GitHub Code Testing\n`;
    markdownContent += `- **과제 유형**: Frontend (React.js)\n`;
    markdownContent += `- **코드 유형**: Frontend (React)\n`;
    markdownContent += `- **매칭 상태**: ✅ 정확한 매칭\n`;
    markdownContent += `- **GitHub 코드 사용**: ${isGitHubAvailable && githubTime > 0 ? '성공' : '실패 (샘플 코드 사용)'}\n`;
    
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
    
    console.log('\n🎯 테스트 결론');
    console.log('='.repeat(80));
    console.log('• 이 테스트는 프론트엔드 과제로 프론트엔드 코드를 평가한 정상적인 결과입니다.');
    console.log('• AI가 올바른 과제-코드 매칭에서 어떤 평가를 제공하는지 확인할 수 있습니다.');
    console.log(`• 총점 ${feedback.score}점은 실제 과제 요구사항 대비 코드 품질을 반영한 결과입니다.`);
    
    console.log('\n✨ 테스트 완료!');
    
  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
  }
}

// 샘플 프론트엔드 코드 생성 함수 (GitHub 실패 시 사용)
function getSampleFrontendCode() {
  return {
    metadata: {
      totalFiles: 5,
      totalSize: 4096,
      lastCommit: null
    },
    structure: `frontend/members/choi-seonmi/week5/
├── src/
│   ├── App.js
│   ├── components/
│   │   ├── BookForm.js
│   │   ├── BookList.js
│   │   └── BookItem.js
│   └── App.css
└── README.md`,
    files: [
      {
        path: 'src/App.js',
        content: `import React, { useState } from 'react';
import BookForm from './components/BookForm';
import BookList from './components/BookList';
import './App.css';

function App() {
  const [books, setBooks] = useState([
    {
      id: 1,
      title: '리액트를 다루는 기술',
      author: '김민준',
      rating: 5,
      memo: '리액트 기초부터 고급까지 잘 정리된 책입니다.'
    }
  ]);

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
        <p className="book-count">총 {books.length}권의 책을 읽었습니다</p>
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
        size: 1000
      },
      {
        path: 'src/components/BookForm.js',
        content: `import React, { useState, useRef, useEffect } from 'react';

function BookForm({ onAddBook }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    rating: 5,
    memo: ''
  });
  
  const titleInputRef = useRef(null);

  // 컴포넌트 마운트 시 첫 번째 입력 필드에 포커스
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.author.trim()) {
      alert('제목과 저자를 모두 입력해주세요.');
      return;
    }

    onAddBook(formData);
    
    // 폼 초기화
    setFormData({
      title: '',
      author: '',
      rating: 5,
      memo: ''
    });
    
    // 초기화 후 첫 번째 입력 필드에 포커스
    titleInputRef.current?.focus();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="book-form-container">
      <h2>새 책 추가</h2>
      <form onSubmit={handleSubmit} className="book-form">
        <div className="form-group">
          <label htmlFor="title">제목</label>
          <input
            ref={titleInputRef}
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="책 제목을 입력하세요"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="author">저자</label>
          <input
            type="text"
            id="author"
            name="author"
            value={formData.author}
            onChange={handleChange}
            placeholder="저자명을 입력하세요"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="rating">별점</label>
          <select 
            id="rating"
            name="rating" 
            value={formData.rating} 
            onChange={handleChange}
          >
            {[1, 2, 3, 4, 5].map(num => (
              <option key={num} value={num}>
                {'⭐'.repeat(num)} ({num}점)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="memo">독서 메모</label>
          <textarea
            id="memo"
            name="memo"
            value={formData.memo}
            onChange={handleChange}
            placeholder="읽고 난 감상을 자유롭게 적어보세요"
            rows={4}
          />
        </div>

        <button type="submit" className="submit-button">
          📖 책 추가하기
        </button>
      </form>
    </div>
  );
}

export default BookForm;`,
        language: 'javascript',
        size: 2000
      },
      {
        path: 'src/components/BookList.js',
        content: `import React from 'react';
import BookItem from './BookItem';

function BookList({ books, onDeleteBook }) {
  if (books.length === 0) {
    return (
      <div className="empty-state">
        <p>📚 아직 등록된 책이 없습니다.</p>
        <p>첫 번째 책을 추가해보세요!</p>
      </div>
    );
  }

  return (
    <div className="book-list-container">
      <h2>독서 목록</h2>
      <div className="book-list">
        {books.map(book => (
          <BookItem
            key={book.id}
            book={book}
            onDelete={onDeleteBook}
          />
        ))}
      </div>
    </div>
  );
}

export default BookList;`,
        language: 'javascript',
        size: 600
      },
      {
        path: 'src/components/BookItem.js',
        content: `import React from 'react';

function BookItem({ book, onDelete }) {
  const handleDelete = () => {
    if (window.confirm(\`"\${book.title}"을(를) 삭제하시겠습니까?\`)) {
      onDelete(book.id);
    }
  };

  return (
    <div className="book-item">
      <div className="book-header">
        <h3>{book.title}</h3>
        <button onClick={handleDelete} className="delete-button">
          🗑️
        </button>
      </div>
      <p className="book-author">저자: {book.author}</p>
      <div className="book-rating">
        평점: {'⭐'.repeat(book.rating)} ({book.rating}점)
      </div>
      {book.memo && (
        <div className="book-memo">
          <p>{book.memo}</p>
        </div>
      )}
    </div>
  );
}

export default BookItem;`,
        language: 'javascript',
        size: 800
      },
      {
        path: 'src/App.css',
        content: `.App {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.App-header {
  margin-bottom: 30px;
}

.App-header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
}

.book-count {
  color: #7f8c8d;
  font-size: 1.1em;
}

.book-form-container {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.book-form {
  max-width: 400px;
  margin: 0 auto;
}

.form-group {
  margin-bottom: 15px;
  text-align: left;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #34495e;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.submit-button {
  background: #3498db;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.submit-button:hover {
  background: #2980b9;
}

.book-list-container h2 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.book-list {
  display: grid;
  gap: 15px;
}

.book-item {
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 8px;
  padding: 15px;
  text-align: left;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.book-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.book-header h3 {
  margin: 0;
  color: #2c3e50;
}

.delete-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 5px;
}

.delete-button:hover {
  background: #f8f9fa;
  border-radius: 4px;
}

.book-author {
  color: #7f8c8d;
  margin-bottom: 8px;
}

.book-rating {
  color: #f39c12;
  margin-bottom: 10px;
  font-weight: bold;
}

.book-memo {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  border-left: 3px solid #3498db;
}

.empty-state {
  text-align: center;
  color: #7f8c8d;
  padding: 40px;
  background: #f8f9fa;
  border-radius: 8px;
}

.empty-state p {
  margin: 5px 0;
}`,
        language: 'css',
        size: 1200
      }
    ]
  };
}

// 스크립트 실행
if (require.main === module) {
  testFrontendActualGitHub()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testFrontendActualGitHub };