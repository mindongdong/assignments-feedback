/**
 * 평가 기준 형식 테스트 스크립트
 */

import { AIService } from '../services/AIService';
import { CacheService } from '../services/CacheService';
import dotenv from 'dotenv';
import path from 'path';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 백엔드 과제 평가 기준 (backend_assignment.md 형식)
const backendEvaluationCriteria = [
  {
    title: '데이터베이스 모델링',
    points: 15,
    details: [
      '테이블 스키마 설계의 적절성',
      'ORM 모델 클래스 구현',
      '관계 설정 및 제약조건 구현',
      '타임스탬프 자동 처리'
    ]
  },
  {
    title: 'API 엔드포인트 구현',
    points: 20,
    details: [
      '모든 필수 CRUD 엔드포인트 구현',
      'RESTful API 설계 원칙 준수',
      '적절한 HTTP 메서드와 상태 코드 사용',
      '일관된 응답 형식 구현'
    ]
  },
  {
    title: 'SQLAlchemy ORM 활용',
    points: 15,
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
      '비즈니스 로직 검증 (재고 음수 방지 등)'
    ]
  },
  {
    title: '코드 구조 및 품질',
    points: 15,
    details: [
      '계층별 책임 분리 (라우터, 서비스, 모델)',
      '코드 재사용성과 모듈화',
      '명확한 함수/변수 네이밍',
      '타입 힌트 사용'
    ]
  },
  {
    title: '추가 기능 구현',
    points: 10,
    details: [
      '검색 기능의 정확성',
      '필터링 조건 조합 처리',
      '재고 관리 기능의 안정성',
      '페이지네이션 메타 정보 제공'
    ]
  },
  {
    title: '문서화',
    points: 10,
    details: [
      'README.md의 완성도',
      'API 문서의 명확성',
      '설치 및 실행 가이드',
      '예제 요청/응답 제공'
    ]
  }
];

// 샘플 FastAPI 코드
const sampleFastAPICode = `
from fastapi import FastAPI, HTTPException, Depends, Query
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker, relationship
from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional, List
import re

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./books.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
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
    isbn = Column(String(13), unique=True)
    price = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0)
    published_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    category_id = Column(Integer, ForeignKey("categories.id"))
    
    category = relationship("Category", back_populates="books")

Base.metadata.create_all(bind=engine)

# Pydantic schemas
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class BookBase(BaseModel):
    title: str
    author: str
    isbn: str
    price: int
    stock_quantity: int = 0
    published_date: Optional[datetime] = None
    category_id: Optional[int] = None
    
    @validator('isbn')
    def validate_isbn(cls, v):
        if not re.match(r'^\\d{13}$', v):
            raise ValueError('ISBN must be 13 digits')
        return v
    
    @validator('price')
    def validate_price(cls, v):
        if v < 0:
            raise ValueError('Price must be non-negative')
        return v

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    price: Optional[int] = None
    stock_quantity: Optional[int] = None
    category_id: Optional[int] = None

class BookResponse(BookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None
    
    class Config:
        orm_mode = True

class StockUpdate(BaseModel):
    quantity: int
    operation: str
    
    @validator('operation')
    def validate_operation(cls, v):
        if v not in ['add', 'subtract']:
            raise ValueError('Operation must be "add" or "subtract"')
        return v

class ApiResponse(BaseModel):
    status: str
    data: Optional[Any] = None
    message: str
    meta: Optional[dict] = None

# FastAPI app
app = FastAPI(title="Book Management API")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Routes
@app.post("/books", response_model=ApiResponse)
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    db_book = Book(**book.dict())
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return ApiResponse(
        status="success",
        data=BookResponse.from_orm(db_book),
        message="Book created successfully"
    )

@app.get("/books", response_model=ApiResponse)
def get_books(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Book)
    
    # Search
    if search:
        query = query.filter(
            (Book.title.contains(search)) | (Book.author.contains(search))
        )
    
    # Filters
    if category_id:
        query = query.filter(Book.category_id == category_id)
    if min_price is not None:
        query = query.filter(Book.price >= min_price)
    if max_price is not None:
        query = query.filter(Book.price <= max_price)
    
    # Pagination
    total = query.count()
    offset = (page - 1) * size
    books = query.offset(offset).limit(size).all()
    
    return ApiResponse(
        status="success",
        data=[BookResponse.from_orm(book) for book in books],
        message="Books retrieved successfully",
        meta={
            "page": page,
            "size": size,
            "total": total
        }
    )

@app.get("/books/{book_id}", response_model=ApiResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return ApiResponse(
        status="success",
        data=BookResponse.from_orm(book),
        message="Book retrieved successfully"
    )

@app.patch("/books/{book_id}", response_model=ApiResponse)
def update_book(book_id: int, book_update: BookUpdate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    for field, value in book_update.dict(exclude_unset=True).items():
        setattr(book, field, value)
    
    db.commit()
    db.refresh(book)
    return ApiResponse(
        status="success",
        data=BookResponse.from_orm(book),
        message="Book updated successfully"
    )

@app.delete("/books/{book_id}", response_model=ApiResponse)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    db.delete(book)
    db.commit()
    return ApiResponse(
        status="success",
        data=None,
        message="Book deleted successfully"
    )

@app.patch("/books/{book_id}/stock", response_model=ApiResponse)
def update_stock(book_id: int, stock_update: StockUpdate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if stock_update.operation == "add":
        book.stock_quantity += stock_update.quantity
    else:  # subtract
        if book.stock_quantity < stock_update.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock")
        book.stock_quantity -= stock_update.quantity
    
    db.commit()
    db.refresh(book)
    return ApiResponse(
        status="success",
        data=BookResponse.from_orm(book),
        message="Stock updated successfully"
    )

@app.post("/categories", response_model=ApiResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return ApiResponse(
        status="success",
        data=CategoryResponse.from_orm(db_category),
        message="Category created successfully"
    )

@app.get("/categories", response_model=ApiResponse)
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).all()
    return ApiResponse(
        status="success",
        data=[CategoryResponse.from_orm(cat) for cat in categories],
        message="Categories retrieved successfully"
    )
`;

async function testEvaluationCriteria() {
  console.log('🚀 평가 기준 형식 테스트 시작...\n');

  // 서비스 초기화
  const cacheService = new CacheService();
  const aiService = new AIService(cacheService);

  // AI 서비스 가용성 확인
  const isAIAvailable = await aiService.isAvailable();
  console.log('🤖 AI 서비스 상태:', isAIAvailable ? '✅ 사용 가능' : '❌ 사용 불가');
  
  if (!isAIAvailable) {
    console.error('❌ AI 서비스를 사용할 수 없습니다.');
    return;
  }

  try {
    // 구조화된 평가 기준을 포함한 피드백 요청
    const feedbackRequest = {
      assignment: {
        code: 'BACKEND01',
        title: 'FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축',
        requirements: [
          '데이터베이스 모델링 (Book, Category 테이블)',
          'CRUD API 엔드포인트 구현',
          '검색 및 필터링 기능',
          '페이지네이션 구현',
          '재고 관리 기능',
          'Pydantic을 활용한 데이터 검증',
          '적절한 에러 처리'
        ],
        recommendations: [
          'SQLAlchemy의 relationship 활용',
          'RESTful API 설계 원칙 준수',
          '일관된 응답 형식 사용',
          'Type hints 활용',
          'README.md 문서 작성'
        ],
        category: 'backend' as const,
        position: 'backend_fastapi',
        evaluationCriteria: backendEvaluationCriteria, // 구조화된 평가 기준
        difficulty: 'intermediate' as const
      },
      submission: {
        type: 'code' as const,
        content: sampleFastAPICode,
        url: 'https://github.com/sample/fastapi-book-api',
        title: 'FastAPI 도서 관리 시스템 구현'
      },
      user_context: {
        previous_submissions: 2,
        average_score: 80,
        learning_level: 'intermediate' as const,
        preferred_feedback_style: 'detailed' as const,
        cultural_context: 'korean_academic' as const
      }
    };
    
    console.log('\n📝 평가 기준 형식:');
    console.log('='.repeat(80));
    feedbackRequest.assignment.evaluationCriteria.forEach((criterion, idx) => {
      console.log(`${idx + 1}. ${criterion.title} (${criterion.points}점)`);
      criterion.details.forEach(detail => {
        console.log(`   - ${detail}`);
      });
      console.log();
    });
    
    console.log('🤖 AI 피드백 생성 중...');
    const startAI = Date.now();
    const feedback = await aiService.generateFeedback(feedbackRequest);
    const aiTime = Date.now() - startAI;
    
    console.log('✅ AI 피드백 생성 완료!');
    console.log(`⏱️  소요 시간: ${aiTime}ms`);
    console.log(`🔢 총점: ${feedback.score}/100`);
    
    // 피드백 내용 출력
    console.log('\n' + '='.repeat(80));
    console.log('💬 AI 피드백 내용');
    console.log('='.repeat(80));
    console.log(feedback.content);
    
    // 세부 점수 확인
    console.log('\n' + '='.repeat(80));
    console.log('📊 세부 점수');
    console.log('='.repeat(80));
    console.log(`• 요구사항 충족: ${feedback.criteria_scores.requirements_met}/100`);
    console.log(`• 코드 품질: ${feedback.criteria_scores.code_quality}/100`);
    console.log(`• 모범 사례: ${feedback.criteria_scores.best_practices}/100`);
    console.log(`• 창의성: ${feedback.criteria_scores.creativity}/100`);
    
    console.log('\n✨ 테스트 완료!');
    
  } catch (error) {
    console.error('\n❌ 테스트 중 오류 발생:', error);
    
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  testEvaluationCriteria()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testEvaluationCriteria };