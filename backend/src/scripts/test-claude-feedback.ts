/**
 * Claude API를 사용한 AI 피드백 테스트 (샘플 코드 사용)
 */

import { AIService } from '../services/AIService';
import { CacheService } from '../services/CacheService';
import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 테스트용 React 독서 기록장 코드
const sampleReactCode = `
# React 독서 기록장 구현

## App.js
\`\`\`javascript
import React, { useState } from 'react';
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

export default App;
\`\`\`

## components/BookForm.js
\`\`\`javascript
import React, { useState, useRef, useEffect } from 'react';
import './BookForm.css';

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

export default BookForm;
\`\`\`

## components/BookList.js
\`\`\`javascript
import React from 'react';
import BookItem from './BookItem';
import './BookList.css';

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

export default BookList;
\`\`\`

## components/BookItem.js
\`\`\`javascript
import React, { useState } from 'react';
import './BookItem.css';

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

export default BookItem;
\`\`\`
`;

async function testClaudeFeedback() {
  console.log('🚀 Claude API 피드백 테스트 시작...\n');

  // 서비스 초기화
  const cacheService = new CacheService();
  const aiService = new AIService(cacheService);

  // AI 서비스 가용성 확인
  const modelInfo = aiService.getModelInfo();
  console.log('📋 AI 모델 정보:', modelInfo);
  
  const isAIAvailable = await aiService.isAvailable();
  console.log('🤖 AI 서비스 상태:', isAIAvailable ? '✅ 사용 가능' : '❌ 사용 불가');
  
  if (!isAIAvailable) {
    console.error('❌ AI 서비스를 사용할 수 없습니다. API 키를 확인해주세요.');
    
    // 환경 변수 확인
    console.log('\n환경 변수 확인:');
    console.log('- ANTHROPIC_API_KEY 설정:', process.env.ANTHROPIC_API_KEY ? '✅' : '❌');
    console.log('- AI_CLAUDE_MODEL:', process.env.AI_CLAUDE_MODEL || '설정 안됨');
    console.log('- AI_MODEL_PREFERENCE:', process.env.AI_MODEL_PREFERENCE || '설정 안됨');
    return;
  }

  try {
    // AI 피드백 생성
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
        content: sampleReactCode,
        url: 'https://github.com/sample/react-reading-log',
        title: 'React 독서 기록장 샘플 구현'
      }
    };
    
    const startAI = Date.now();
    const feedback = await aiService.generateFeedback(feedbackRequest);
    const aiTime = Date.now() - startAI;
    
    console.log('✅ AI 피드백 생성 완료!');
    console.log(`⏱️  소요 시간: ${aiTime}ms`);
    console.log(`🔢 총점: ${feedback.score}/100`);
    
    // 피드백 내용 출력
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
    
    // 모델 정보 출력
    console.log('\n' + '='.repeat(80));
    console.log('ℹ️  모델 정보');
    console.log('='.repeat(80));
    console.log(`• 모델: ${feedback.model_info.model}`);
    console.log(`• 토큰 사용량: ${feedback.model_info.tokens_used}`);
    console.log(`• 캐시 상태: ${feedback.cache_info.cached ? '캐시됨' : '새로 생성'}`);
    console.log(`• 응답 시간: ${feedback.cache_info.response_time_ms}ms`);
    
    // 성능 메트릭 출력
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
  }
}

// 스크립트 실행
if (require.main === module) {
  testClaudeFeedback()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testClaudeFeedback };