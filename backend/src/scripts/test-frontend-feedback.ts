/**
 * 프론트엔드(React.js) 과제 AI 피드백 테스트 스크립트
 */

import { AIService } from '../services/AIService';
import { GitHubService } from '../services/GitHubService';
import { CacheService } from '../services/CacheService';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 과제 평가 기준 (frontend_assignment.md 기반)
const frontendEvaluationCriteria = [
  {
    title: '컴포넌트 분리',
    points: 20,
    details: [
      '적절한 컴포넌트 구조와 역할 분담',
      'App, BookForm, BookList, BookItem 컴포넌트 구현',
      '컴포넌트별 책임 분리'
    ]
  },
  {
    title: 'Props 활용',
    points: 20,
    details: [
      '부모-자식 컴포넌트 간 데이터 전달',
      'Props를 통한 이벤트 핸들러 전달',
      'Props 타입 검증 (PropTypes 또는 TypeScript)'
    ]
  },
  {
    title: 'State 관리',
    points: 20,
    details: [
      '폼 입력값 관리',
      '책 목록 데이터 관리',
      'useState Hook의 올바른 사용'
    ]
  },
  {
    title: '이벤트 처리',
    points: 20,
    details: [
      '폼 제출 이벤트 처리',
      '삭제 버튼 이벤트 처리',
      '입력 필드 변경 이벤트 처리'
    ]
  },
  {
    title: 'useRef 활용',
    points: 10,
    details: [
      '책 추가 후 첫 번째 입력 필드에 자동 포커스',
      'useRef Hook의 적절한 사용'
    ]
  },
  {
    title: 'UI/UX',
    points: 10,
    details: [
      '깔끔한 UI 디자인',
      '사용자 친화적인 경험',
      '반응형 디자인 고려'
    ]
  }
];

async function testFrontendFeedback() {
  console.log('🚀 프론트엔드(React.js) AI 피드백 테스트 시작...\n');

  // 서비스 초기화
  const cacheService = new CacheService();
  const aiService = new AIService(cacheService);
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
    // 1. GitHub에서 코드 가져오기 (또는 샘플 코드 사용)
    console.log('\n📂 코드 준비 중...');
    let repoContent: any;
    let githubTime = 0;
    const repoUrl = 'https://github.com/mindongdong/cislab-web-study/tree/main/frontend/members/kim-dogyun/week5';
    
    if (isGitHubAvailable) {
      console.log(`GitHub에서 코드 가져오는 중: ${repoUrl}`);
      const startGitHub = Date.now();
      repoContent = await githubService.fetchRepositoryContent(repoUrl);
      githubTime = Date.now() - startGitHub;
    } else {
      console.log('GitHub API 사용 불가능. 샘플 코드 사용...');
      // 샘플 React 독서 기록장 코드
      repoContent = {
        metadata: {
          totalFiles: 5,
          totalSize: 2048,
          lastCommit: null
        },
        structure: `example/
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
      memo: '리액트의 기초부터 심화까지 잘 설명되어 있다.'
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

  const updateBook = (id, updatedBook) => {
    setBooks(books.map(book => 
      book.id === id ? { ...updatedBook, id } : book
    ));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📚 나의 독서 기록장</h1>
        <p className="book-count">총 {books.length}권의 책을 읽었습니다</p>
      </header>
      
      <main className="App-main">
        <BookForm onAddBook={addBook} />
        <BookList 
          books={books} 
          onDeleteBook={deleteBook}
          onUpdateBook={updateBook}
        />
      </main>
    </div>
  );
}

export default App;`,
            language: 'javascript',
            size: 1200
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
  
  const [errors, setErrors] = useState({});
  const titleInputRef = useRef(null);

  // 컴포넌트 마운트 시 첫 번째 입력 필드에 포커스
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = '제목은 필수 입력 사항입니다.';
    }
    
    if (!formData.author.trim()) {
      newErrors.author = '저자는 필수 입력 사항입니다.';
    }
    
    if (formData.title.length > 100) {
      newErrors.title = '제목은 100자 이내로 입력해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 입력 시 해당 필드의 에러 메시지 제거
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
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

  return (
    <div className="book-form-container">
      <h2>새 책 추가</h2>
      <form onSubmit={handleSubmit} className="book-form">
        <div className="form-group">
          <label htmlFor="title">
            제목 <span className="required">*</span>
          </label>
          <input
            ref={titleInputRef}
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="책 제목을 입력하세요"
            className={errors.title ? 'error' : ''}
          />
          {errors.title && <span className="error-message">{errors.title}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="author">
            저자 <span className="required">*</span>
          </label>
          <input
            type="text"
            id="author"
            name="author"
            value={formData.author}
            onChange={handleChange}
            placeholder="저자명을 입력하세요"
            className={errors.author ? 'error' : ''}
          />
          {errors.author && <span className="error-message">{errors.author}</span>}
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
            size: 3500
          },
          {
            path: 'src/components/BookList.js',
            content: `import React from 'react';
import BookItem from './BookItem';

function BookList({ books, onDeleteBook, onUpdateBook }) {
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
            onUpdate={onUpdateBook}
          />
        ))}
      </div>
    </div>
  );
}

export default BookList;`,
            language: 'javascript',
            size: 800
          },
          {
            path: 'src/components/BookItem.js',
            content: `import React, { useState } from 'react';

function BookItem({ book, onDelete, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(book);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(book.id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(book);
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDelete = () => {
    if (window.confirm(\`"\${book.title}"을(를) 삭제하시겠습니까?\`)) {
      onDelete(book.id);
    }
  };

  if (isEditing) {
    return (
      <div className="book-item editing">
        <input
          type="text"
          name="title"
          value={editData.title}
          onChange={handleChange}
          className="edit-input"
        />
        <input
          type="text"
          name="author"
          value={editData.author}
          onChange={handleChange}
          className="edit-input"
        />
        <select
          name="rating"
          value={editData.rating}
          onChange={handleChange}
          className="edit-select"
        >
          {[1, 2, 3, 4, 5].map(num => (
            <option key={num} value={num}>{num}점</option>
          ))}
        </select>
        <textarea
          name="memo"
          value={editData.memo}
          onChange={handleChange}
          className="edit-textarea"
          rows={3}
        />
        <div className="edit-buttons">
          <button onClick={handleSave} className="save-button">저장</button>
          <button onClick={handleCancel} className="cancel-button">취소</button>
        </div>
      </div>
    );
  }

  return (
    <div className="book-item">
      <div className="book-header">
        <h3>{book.title}</h3>
        <div className="book-actions">
          <button onClick={handleEdit} className="edit-button">✏️</button>
          <button onClick={handleDelete} className="delete-button">🗑️</button>
        </div>
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
            size: 2500
          }
        ]
      };
    }
    
    console.log('✅ 코드 가져오기 완료!');
    console.log(`⏱️  처리 시간: ${githubTime}ms`);
    console.log(`📄 총 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    
    // 2. 주요 코드 파일 통합
    console.log('\n📝 주요 React 컴포넌트 파일들:');
    const codeFiles = repoContent.files.filter(file => 
      (file.path.endsWith('.js') || file.path.endsWith('.jsx') || file.path.endsWith('.tsx')) &&
      !file.path.includes('node_modules') &&
      !file.path.includes('test')
    );
    
    codeFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
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
    const cssFiles = repoContent.files.filter(file => 
      file.path.endsWith('.css') && !file.path.includes('node_modules')
    );
    
    if (cssFiles.length > 0) {
      combinedCode += '## 스타일링 파일들\n\n';
      for (const file of cssFiles) {
        combinedCode += `### ${file.path}\n\n`;
        combinedCode += '```css\n';
        combinedCode += file.content;
        combinedCode += '\n```\n\n';
      }
    }
    
    // 3. AI 피드백 생성
    console.log('\n🤖 AI 피드백 생성 중...');
    
    const feedbackRequest = {
      assignment: {
        code: 'REACT05',
        title: 'React.js 실습 과제: 독서 기록장 만들기',
        requirements: [
          '컴포넌트 구조 설계 (App, BookForm, BookList, BookItem)',
          '책 정보 입력 폼 구현 (제목, 저자, 별점, 메모)',
          '책 목록 표시 기능',
          '책 추가 기능 구현',
          '책 삭제 기능 구현',
          '총 읽은 책 권수 표시',
          'useRef를 사용한 자동 포커스 기능'
        ],
        recommendations: [
          'Props를 통한 컴포넌트 간 통신',
          'useState를 사용한 상태 관리',
          '이벤트 처리 구현',
          '깔끔한 UI/UX 디자인',
          '컴포넌트 재사용성 고려'
        ],
        category: 'frontend' as const,
        position: 'frontend_react',
        evaluationCriteria: frontendEvaluationCriteria,
        difficulty: 'intermediate' as const
      },
      submission: {
        type: 'code' as const,
        content: combinedCode,
        url: repoUrl,
        title: 'React 독서 기록장 구현'
      },
      user_context: {
        previous_submissions: 4,
        average_score: 85,
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
    
    // 4. 피드백 결과를 마크다운 파일로 저장
    console.log('\n📄 피드백 결과를 MD 파일로 저장 중...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputDir = path.resolve(__dirname, '../../feedback-results');
    const outputFile = path.join(outputDir, `frontend-feedback-${timestamp}.md`);
    
    // 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 마크다운 문서 생성
    let markdownContent = `# AI 피드백 보고서: React.js 독서 기록장\n\n`;
    markdownContent += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    markdownContent += `**과제 코드**: ${feedbackRequest.assignment.code}\n`;
    markdownContent += `**GitHub URL**: ${repoUrl}\n`;
    markdownContent += `**총점**: ${feedback.score}/100\n\n`;
    
    markdownContent += `---\n\n`;
    
    // 세부 점수
    markdownContent += `## 📊 평가 결과\n\n`;
    markdownContent += `### 세부 점수\n`;
    markdownContent += `- **요구사항 충족도**: ${feedback.criteria_scores.requirements_met}/100\n`;
    markdownContent += `- **코드 품질**: ${feedback.criteria_scores.code_quality}/100\n`;
    markdownContent += `- **모범 사례 적용**: ${feedback.criteria_scores.best_practices}/100\n`;
    markdownContent += `- **창의성**: ${feedback.criteria_scores.creativity}/100\n\n`;
    
    // 평가 기준별 점수 (제공된 경우)
    markdownContent += `### 평가 기준별 점수\n\n`;
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
    
    // 개선 제안 섹션 제거됨 (사용자 요청에 따라)
    
    // 학습 리소스는 제거됨 (사용자 요청에 따라)
    
    // 메타 정보
    markdownContent += `---\n\n`;
    markdownContent += `## ℹ️ 메타 정보\n\n`;
    markdownContent += `- **AI 모델**: ${feedback.model_info.model}\n`;
    markdownContent += `- **Provider**: ${feedback.model_info.provider}\n`;
    markdownContent += `- **응답 시간**: ${feedback.cache_info.response_time_ms}ms\n`;
    markdownContent += `- **캐시 사용**: ${feedback.cache_info.cache_hit ? '예' : '아니오'}\n`;
    markdownContent += `- **피드백 신뢰도**: ${feedback.feedback_quality.confidence_score}/100\n`;
    markdownContent += `- **실행 가능성**: ${feedback.feedback_quality.actionability}/100\n`;
    
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
    const metrics = aiService.getPerformanceMetrics();
    console.log('\n📈 성능 메트릭');
    console.log('='.repeat(80));
    console.log(`• GitHub 코드 가져오기: ${githubTime}ms`);
    console.log(`• AI 피드백 생성: ${aiTime}ms`);
    console.log(`• 전체 처리 시간: ${githubTime + aiTime}ms`);
    console.log(`• 평균 AI 응답 시간: ${Math.round(metrics.avgResponseTime)}ms`);
    console.log(`• 캐시 히트율: ${Math.round(metrics.cacheHitRate * 100)}%`);
    
    console.log('\n✨ 테스트 완료!');
    
  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  testFrontendFeedback()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testFrontendFeedback };