/**
 * AI 피드백 기능 테스트 스크립트
 */

import { AIService } from '../services/AIService';
import { CacheService } from '../services/CacheService';

async function testAIFeedback() {
  console.log('🤖 AI 피드백 서비스 테스트 시작...');

  // Cache 서비스 초기화 (옵션)
  const cacheService = new CacheService();
  const aiService = new AIService(cacheService);

  // 모델 정보 확인
  const modelInfo = aiService.getModelInfo();
  console.log('📋 AI 모델 정보:', modelInfo);

  // 서비스 가용성 확인
  const isAvailable = await aiService.isAvailable();
  console.log('🌐 AI 서비스 가용성:', isAvailable ? '✅ 사용 가능' : '❌ 사용 불가');

  if (!isAvailable) {
    console.log('❌ AI 서비스를 사용할 수 없습니다. API 키를 확인해주세요.');
    return;
  }

  try {
    // 1. FastAPI 백엔드 과제에 대한 피드백 테스트
    console.log('\n📝 FastAPI 백엔드 과제 피드백 테스트...');
    
    const backendFeedbackRequest = {
      assignment: {
        code: 'ABC123',
        title: 'FastAPI + SQLAlchemy 도서 관리 시스템',
        requirements: [
          'Book 테이블 설계 (id, title, author, isbn, price, stock_quantity, published_date, created_at, updated_at)',
          'Category 테이블 설계 (id, name, description, created_at)',
          'Book과 Category 다대일 관계 설정',
          'POST /books - 새 도서 등록',
          'GET /books - 전체 도서 목록 조회',
          'SQLAlchemy ORM 활용',
          'Pydantic을 사용한 요청/응답 스키마 정의'
        ],
        recommendations: [
          'SQLAlchemy의 filter(), like(), and_(), or_() 활용',
          '페이지네이션은 offset()과 limit() 사용',
          '트랜잭션 처리를 위해 db.commit()과 db.rollback() 적절히 사용',
          '계층별 책임 분리 (라우터, 서비스, 모델)'
        ],
        category: 'programming' as const
      },
      submission: {
        type: 'code' as const,
        content: `# FastAPI + SQLAlchemy 도서 관리 시스템

## models/book.py
\`\`\`python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    books = relationship("Book", back_populates="category")

class Book(Base):
    __tablename__ = "books"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    author = Column(String(100), nullable=False)
    isbn = Column(String(13), unique=True, nullable=False)
    price = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0)
    published_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    category_id = Column(Integer, ForeignKey("categories.id"))
    
    category = relationship("Category", back_populates="books")
\`\`\`

## schemas/book.py
\`\`\`python
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=100)
    isbn: str = Field(..., min_length=13, max_length=13)
    price: int = Field(..., ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    published_date: Optional[datetime] = None
    category_id: int

class BookCreate(BookBase):
    pass

class BookResponse(BookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: CategoryResponse
    
    class Config:
        from_attributes = True
\`\`\`

## routers/books.py
\`\`\`python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from ..database import get_db
from ..models.book import Book, Category
from ..schemas.book import BookCreate, BookResponse

router = APIRouter(prefix="/books", tags=["books"])

@router.post("/", response_model=BookResponse)
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    # 카테고리 존재 확인
    category = db.query(Category).filter(Category.id == book.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다.")
    
    db_book = Book(**book.dict())
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    
    return db_book

@router.get("/", response_model=List[BookResponse])
def get_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    min_price: Optional[int] = Query(None, ge=0),
    max_price: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Book).options(joinedload(Book.category))
    
    if search:
        query = query.filter(
            (Book.title.like(f"%{search}%")) | 
            (Book.author.like(f"%{search}%"))
        )
    
    if category_id:
        query = query.filter(Book.category_id == category_id)
    
    if min_price is not None:
        query = query.filter(Book.price >= min_price)
    
    if max_price is not None:
        query = query.filter(Book.price <= max_price)
    
    books = query.offset(skip).limit(limit).all()
    return books

@router.get("/{book_id}", response_model=BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).options(joinedload(Book.category)).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다.")
    return book
\`\`\``,
        url: 'https://github.com/testuser/fastapi-bookstore',
        title: 'FastAPI 도서 관리 시스템 구현'
      }
    };

    const startTime = Date.now();
    const backendFeedback = await aiService.generateFeedback(backendFeedbackRequest);
    const endTime = Date.now();

    console.log('✅ 백엔드 과제 피드백 생성 완료!');
    console.log(`⏱️  처리 시간: ${endTime - startTime}ms`);
    console.log(`🔢 점수: ${backendFeedback.score}/100`);
    console.log('📝 피드백 내용:');
    console.log(backendFeedback.content.substring(0, 500) + '...');
    console.log('\n📊 세부 점수:');
    console.log('- 요구사항 충족:', backendFeedback.criteria_scores.requirements_met);
    console.log('- 코드 품질:', backendFeedback.criteria_scores.code_quality);
    console.log('- 모범 사례:', backendFeedback.criteria_scores.best_practices);
    console.log('- 창의성:', backendFeedback.criteria_scores.creativity);

    // 2. React 프론트엔드 과제에 대한 피드백 테스트
    console.log('\n📝 React 프론트엔드 과제 피드백 테스트...');
    
    const frontendFeedbackRequest = {
      assignment: {
        code: 'XYZ789',
        title: 'React.js 독서 기록장 만들기',
        requirements: [
          'App 메인 컴포넌트',
          'BookForm 책 정보 입력 폼',
          'BookList 책 목록 표시 컴포넌트',
          'BookItem 개별 책 정보 표시 컴포넌트',
          'useState를 사용한 폼 입력값 관리',
          'useRef를 사용하여 책 추가 후 첫 번째 입력 필드에 자동 포커스'
        ],
        recommendations: [
          '적절한 컴포넌트 구조와 역할 분담',
          '부모-자식 컴포넌트 간 Props를 통한 데이터 전달',
          '이벤트 처리 (폼 제출, 삭제 등)',
          '깔끔한 UI와 사용자 경험'
        ],
        category: 'programming' as const
      },
      submission: {
        type: 'code' as const,
        content: `# React.js 독서 기록장

## App.js
\`\`\`javascript
import React, { useState } from 'react';
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
    setBooks(prevBooks => [...prevBooks, newBook]);
  };

  const deleteBook = (id) => {
    setBooks(prevBooks => prevBooks.filter(book => book.id !== id));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>📚 나의 독서 기록장</h1>
        <p>읽은 책 권수: {books.length}권</p>
      </header>
      
      <div className="container">
        <BookForm onAddBook={addBook} />
        <BookList books={books} onDeleteBook={deleteBook} />
      </div>
    </div>
  );
}

export default App;
\`\`\`

## components/BookForm.js
\`\`\`javascript
import React, { useState, useRef } from 'react';

function BookForm({ onAddBook }) {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    rating: 5,
    memo: ''
  });

  const titleInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.author.trim()) {
      alert('제목과 저자는 필수 입력 사항입니다.');
      return;
    }

    onAddBook(formData);
    
    setFormData({
      title: '',
      author: '',
      rating: 5,
      memo: ''
    });

    // useRef를 사용한 포커스 이동
    titleInputRef.current?.focus();
  };

  return (
    <div className="book-form">
      <h2>새 책 추가</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>제목</label>
          <input
            ref={titleInputRef}
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="책 제목을 입력하세요"
          />
        </div>

        <div className="form-group">
          <label>저자</label>
          <input
            type="text"
            name="author"
            value={formData.author}
            onChange={handleChange}
            placeholder="저자명을 입력하세요"
          />
        </div>

        <div className="form-group">
          <label>별점</label>
          <select name="rating" value={formData.rating} onChange={handleChange}>
            <option value={1}>⭐ (1점)</option>
            <option value={2}>⭐⭐ (2점)</option>
            <option value={3}>⭐⭐⭐ (3점)</option>
            <option value={4}>⭐⭐⭐⭐ (4점)</option>
            <option value={5}>⭐⭐⭐⭐⭐ (5점)</option>
          </select>
        </div>

        <div className="form-group">
          <label>메모</label>
          <textarea
            name="memo"
            value={formData.memo}
            onChange={handleChange}
            placeholder="읽고 난 감상을 적어보세요"
            rows={3}
          />
        </div>

        <button type="submit">책 추가</button>
      </form>
    </div>
  );
}

export default BookForm;
\`\`\``,
        url: 'https://github.com/testuser/react-book-tracker',
        title: 'React 독서 기록장 구현'
      }
    };

    const startTime2 = Date.now();
    const frontendFeedback = await aiService.generateFeedback(frontendFeedbackRequest);
    const endTime2 = Date.now();

    console.log('✅ 프론트엔드 과제 피드백 생성 완료!');
    console.log(`⏱️  처리 시간: ${endTime2 - startTime2}ms`);
    console.log(`🔢 점수: ${frontendFeedback.score}/100`);
    console.log('📝 피드백 내용:');
    console.log(frontendFeedback.content.substring(0, 500) + '...');

    // 성능 메트릭 확인
    console.log('\n📊 AI 서비스 성능 메트릭:');
    const metrics = aiService.getPerformanceMetrics();
    console.log(`- 평균 응답 시간: ${Math.round(metrics.avgResponseTime)}ms`);
    console.log(`- 캐시 히트율: ${Math.round(metrics.cacheHitRate * 100)}%`);
    console.log(`- 총 요청 수: ${metrics.totalRequests}`);

    console.log('\n🎉 AI 피드백 기능 테스트 완료!');

  } catch (error) {
    console.error('❌ AI 피드백 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
  }
}

if (require.main === module) {
  testAIFeedback()
    .then(() => {
      console.log('테스트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testAIFeedback };