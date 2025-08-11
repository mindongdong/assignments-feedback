/**
 * 백엔드(FastAPI) 과제 AI 피드백 테스트 스크립트
 */

import { AIService } from '../services/AIService';
import { GitHubService } from '../services/GitHubService';
// import { CacheService } from '../services/CacheService'; // Cache removed
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

// 환경 변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 과제 평가 기준 (backend_assignment.md 기반)
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

async function testBackendFeedback() {
  console.log('🚀 백엔드(FastAPI) AI 피드백 테스트 시작...\n');

  // 서비스 초기화 - Cache system removed
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
    // 1. GitHub에서 코드 가져오기 (또는 샘플 코드 사용)
    console.log('\n📂 코드 준비 중...');
    let repoContent: any;
    let githubTime = 0;
    const repoUrl = 'https://github.com/mindongdong/cislab-web-study/tree/main/backend/assignments/week05_assignment/example';
    
    if (isGitHubAvailable) {
      console.log(`GitHub에서 코드 가져오는 중: ${repoUrl}`);
      const startGitHub = Date.now();
      repoContent = await githubService.fetchRepositoryContent(repoUrl);
      githubTime = Date.now() - startGitHub;
    } else {
      console.log('GitHub API 사용 불가능. 샘플 코드 사용...');
      // 샘플 FastAPI 도서 관리 시스템 코드 (실제 파일 구조 반영)
      repoContent = {
        metadata: {
          totalFiles: 20, // 20개로 증가
          totalSize: 8192,
          lastCommit: null
        },
        structure: `example/
├── README.md
├── database.py
├── main.py
├── models/
│   ├── book.py
│   └── category.py
├── routers/
│   ├── book.py
│   └── category.py
├── schemas/
│   ├── book.py
│   ├── category.py
│   └── common.py
├── services/
│   ├── book.py
│   └── category.py
└── utils/
    └── exceptions.py`,
        files: [
          {
            path: 'app/main.py',
            content: `from fastapi import FastAPI
from app.routers import books, categories
from app.database import engine, Base

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="도서 관리 시스템 API",
    description="FastAPI와 SQLAlchemy를 사용한 도서 관리 시스템",
    version="1.0.0"
)

# 라우터 등록
app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])

@app.get("/")
def read_root():
    return {
        "status": "success",
        "message": "도서 관리 시스템 API에 오신 것을 환영합니다!",
        "data": {
            "version": "1.0.0",
            "docs": "/docs"
        }
    }`,
            language: 'python',
            size: 600
          },
          {
            path: 'app/models/book.py',
            content: `from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Book(Base):
    __tablename__ = "books"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False, index=True)
    author = Column(String(100), nullable=False, index=True)
    isbn = Column(String(13), unique=True, nullable=False)
    price = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0)
    published_date = Column(Date)
    category_id = Column(Integer, ForeignKey("categories.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 관계 설정
    category = relationship("Category", back_populates="books")
    
    def __repr__(self):
        return f"<Book(id={self.id}, title='{self.title}', author='{self.author}')>"`,
            language: 'python',
            size: 900
          },
          {
            path: 'app/models/category.py',
            content: `from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    books = relationship("Book", back_populates="category")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"`,
            language: 'python',
            size: 500
          },
          {
            path: 'app/routers/books.py',
            content: `from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List, Optional
from app.database import get_db
from app.models.book import Book
from app.schemas.book import BookCreate, BookUpdate, BookResponse, BookStockUpdate
from app.schemas.common import StandardResponse, PaginatedResponse

router = APIRouter()

@router.post("/", response_model=StandardResponse)
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    """새 도서 등록"""
    try:
        # ISBN 중복 검사
        existing_book = db.query(Book).filter(Book.isbn == book.isbn).first()
        if existing_book:
            raise HTTPException(status_code=400, detail="이미 존재하는 ISBN입니다.")
        
        db_book = Book(**book.dict())
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        
        return StandardResponse(
            status="success",
            data=BookResponse.from_orm(db_book),
            message="도서가 성공적으로 등록되었습니다."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"도서 등록 중 오류 발생: {str(e)}")

@router.get("/", response_model=PaginatedResponse)
def get_books(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="검색 키워드"),
    category_id: Optional[int] = Query(None, description="카테고리 ID"),
    min_price: Optional[int] = Query(None, ge=0, description="최소 가격"),
    max_price: Optional[int] = Query(None, ge=0, description="최대 가격"),
    db: Session = Depends(get_db)
):
    """도서 목록 조회 (검색, 필터링, 페이지네이션 지원)"""
    query = db.query(Book).options(joinedload(Book.category))
    
    # 검색 조건 적용
    if search:
        search_filter = or_(
            Book.title.like(f"%{search}%"),
            Book.author.like(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    # 필터 조건 적용
    filters = []
    if category_id:
        filters.append(Book.category_id == category_id)
    if min_price is not None:
        filters.append(Book.price >= min_price)
    if max_price is not None:
        filters.append(Book.price <= max_price)
    
    if filters:
        query = query.filter(and_(*filters))
    
    # 전체 개수 계산
    total = query.count()
    
    # 페이지네이션 적용
    offset = (page - 1) * size
    books = query.offset(offset).limit(size).all()
    
    return PaginatedResponse(
        status="success",
        data=[BookResponse.from_orm(book) for book in books],
        message=f"도서 목록을 성공적으로 조회했습니다. (총 {total}권)",
        meta={
            "page": page,
            "size": size,
            "total": total
        }
    )

@router.get("/{book_id}", response_model=StandardResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    """특정 도서 상세 조회"""
    book = db.query(Book).options(joinedload(Book.category)).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다.")
    
    return StandardResponse(
        status="success",
        data=BookResponse.from_orm(book),
        message="도서 정보를 성공적으로 조회했습니다."
    )

@router.patch("/{book_id}", response_model=StandardResponse)
def update_book(book_id: int, book_update: BookUpdate, db: Session = Depends(get_db)):
    """도서 정보 수정"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다.")
    
    try:
        # ISBN 중복 검사 (기존 ISBN과 다른 경우만)
        if book_update.isbn and book_update.isbn != book.isbn:
            existing_book = db.query(Book).filter(Book.isbn == book_update.isbn).first()
            if existing_book:
                raise HTTPException(status_code=400, detail="이미 존재하는 ISBN입니다.")
        
        # 변경사항 적용
        for field, value in book_update.dict(exclude_unset=True).items():
            setattr(book, field, value)
        
        db.commit()
        db.refresh(book)
        
        return StandardResponse(
            status="success",
            data=BookResponse.from_orm(book),
            message="도서 정보가 성공적으로 수정되었습니다."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"도서 수정 중 오류 발생: {str(e)}")

@router.delete("/{book_id}", response_model=StandardResponse)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    """도서 삭제"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다.")
    
    try:
        db.delete(book)
        db.commit()
        
        return StandardResponse(
            status="success",
            data=None,
            message="도서가 성공적으로 삭제되었습니다."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"도서 삭제 중 오류 발생: {str(e)}")

@router.patch("/{book_id}/stock", response_model=StandardResponse)
def update_book_stock(
    book_id: int, 
    stock_update: BookStockUpdate, 
    db: Session = Depends(get_db)
):
    """도서 재고 관리"""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다.")
    
    try:
        if stock_update.operation == "add":
            book.stock_quantity += stock_update.quantity
        elif stock_update.operation == "subtract":
            if book.stock_quantity < stock_update.quantity:
                raise HTTPException(
                    status_code=400, 
                    detail=f"재고가 부족합니다. (현재 재고: {book.stock_quantity})"
                )
            book.stock_quantity -= stock_update.quantity
        else:
            raise HTTPException(status_code=400, detail="잘못된 operation입니다. (add 또는 subtract)")
        
        db.commit()
        db.refresh(book)
        
        return StandardResponse(
            status="success",
            data=BookResponse.from_orm(book),
            message=f"재고가 성공적으로 {stock_update.operation}되었습니다. (현재 재고: {book.stock_quantity})"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"재고 관리 중 오류 발생: {str(e)}")`,
            language: 'python',
            size: 4500
          },
          {
            path: 'app/schemas/book.py',
            content: `from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import date, datetime
from app.schemas.category import CategoryResponse

class BookBase(BaseModel):
    title: str = Field(..., max_length=200, description="도서 제목")
    author: str = Field(..., max_length=100, description="저자명")
    isbn: str = Field(..., regex=r"^\\d{13}$", description="ISBN 13자리")
    price: int = Field(..., ge=0, description="도서 가격")
    stock_quantity: int = Field(0, ge=0, description="재고 수량")
    published_date: Optional[date] = Field(None, description="출판일")
    category_id: Optional[int] = Field(None, description="카테고리 ID")

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200, description="도서 제목")
    author: Optional[str] = Field(None, max_length=100, description="저자명")
    isbn: Optional[str] = Field(None, regex=r"^\\d{13}$", description="ISBN 13자리")
    price: Optional[int] = Field(None, ge=0, description="도서 가격")
    stock_quantity: Optional[int] = Field(None, ge=0, description="재고 수량")
    published_date: Optional[date] = Field(None, description="출판일")
    category_id: Optional[int] = Field(None, description="카테고리 ID")

class BookStockUpdate(BaseModel):
    quantity: int = Field(..., gt=0, description="변경할 재고 수량")
    operation: str = Field(..., regex=r"^(add|subtract)$", description="add 또는 subtract")

class BookResponse(BaseModel):
    id: int
    title: str
    author: str
    isbn: str
    price: int
    stock_quantity: int
    published_date: Optional[date]
    category_id: Optional[int]
    category: Optional[CategoryResponse] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class BookListResponse(BaseModel):
    books: list[BookResponse]
    total: int`,
            language: 'python',
            size: 1800
          },
          {
            path: 'app/database.py',
            content: `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# SQLite 데이터베이스 URL
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./books.db")

# 데이터베이스 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 생성
Base = declarative_base()

def get_db():
    """데이터베이스 의존성 주입을 위한 제너레이터"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`,
            language: 'python',
            size: 700
          },
          // 추가 파일들 (20개로 확장)
          {
            path: 'README.md',
            content: `# FastAPI 도서 관리 시스템

이 프로젝트는 FastAPI와 SQLAlchemy를 사용하여 구현된 도서 관리 시스템입니다.

## 기능
- CRUD 기본 기능
- 검색 및 필터링
- 페이지네이션
- 재고 관리

## 설치 및 실행
1. pip install -r requirements.txt  
2. uvicorn main:app --reload`,
            language: 'markdown',
            size: 300
          },
          {
            path: 'database.py',
            content: `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./books.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`,
            language: 'python',
            size: 400
          },
          {
            path: 'models/book.py',
            content: `from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Book(Base):
    __tablename__ = "books"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)  
    author = Column(String(100), nullable=False, index=True)
    isbn = Column(String(13), unique=True, nullable=False)
    price = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0)
    published_date = Column(Date)
    category_id = Column(Integer, ForeignKey("categories.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    category = relationship("Category", back_populates="books")`,
            language: 'python',
            size: 800
          },
          {
            path: 'models/category.py',
            content: `from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    books = relationship("Book", back_populates="category")`,
            language: 'python',
            size: 500
          },
          {
            path: 'routers/book.py',
            content: `from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List, Optional
from database import get_db
from models.book import Book
from schemas.book import BookCreate, BookUpdate, BookResponse

router = APIRouter()

@router.post("/", response_model=dict)
def create_book(book: BookCreate, db: Session = Depends(get_db)):
    existing_book = db.query(Book).filter(Book.isbn == book.isbn).first()
    if existing_book:
        raise HTTPException(status_code=400, detail="이미 존재하는 ISBN입니다.")
    
    db_book = Book(**book.dict())
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return {"status": "success", "data": db_book}

@router.get("/", response_model=dict)
def get_books(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    min_price: Optional[int] = Query(None, ge=0),
    max_price: Optional[int] = Query(None, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Book).options(joinedload(Book.category))
    
    if search:
        search_filter = or_(
            Book.title.like(f"%{search}%"),
            Book.author.like(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    filters = []
    if category_id:
        filters.append(Book.category_id == category_id)
    if min_price is not None:
        filters.append(Book.price >= min_price)
    if max_price is not None:
        filters.append(Book.price <= max_price)
    
    if filters:
        query = query.filter(and_(*filters))
    
    total = query.count()
    offset = (page - 1) * size
    books = query.offset(offset).limit(size).all()
    
    return {
        "status": "success",
        "data": books,
        "meta": {"page": page, "size": size, "total": total}
    }`,
            language: 'python',
            size: 1500
          },
          {
            path: 'routers/category.py',
            content: `from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.category import Category
from schemas.category import CategoryCreate, CategoryResponse

router = APIRouter()

@router.get("/", response_model=list)
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@router.post("/", response_model=dict)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    db_category = Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return {"status": "success", "data": db_category}`,
            language: 'python',
            size: 600
          },
          {
            path: 'schemas/book.py',
            content: `from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

class BookBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=100)
    isbn: str = Field(..., regex=r"^\\d{13}$", description="ISBN 13자리")
    price: int = Field(..., ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    published_date: Optional[date] = None
    category_id: Optional[int] = None

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    author: Optional[str] = Field(None, min_length=1, max_length=100)
    isbn: Optional[str] = Field(None, regex=r"^\\d{13}$")
    price: Optional[int] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    published_date: Optional[date] = None
    category_id: Optional[int] = None

class BookResponse(BookBase):
    id: int
    created_at: date
    updated_at: date

    class Config:
        orm_mode = True`,
            language: 'python',
            size: 1000
          },
          {
            path: 'schemas/category.py',
            content: `from pydantic import BaseModel, Field
from typing import Optional

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = Field(None)

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int

    class Config:
        orm_mode = True`,
            language: 'python',
            size: 400
          },
          {
            path: 'schemas/common.py',
            content: `from pydantic import BaseModel
from typing import Any, Optional, List

class StandardResponse(BaseModel):
    status: str
    data: Any
    message: str

class PaginatedResponse(StandardResponse):
    meta: Optional[dict] = None`,
            language: 'python',
            size: 300
          },
          {
            path: 'services/book.py',
            content: `from sqlalchemy.orm import Session
from models.book import Book
from schemas.book import BookCreate, BookUpdate

class BookService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_book(self, book_data: BookCreate) -> Book:
        existing_book = self.db.query(Book).filter(Book.isbn == book_data.isbn).first()
        if existing_book:
            raise ValueError("이미 존재하는 ISBN입니다.")
        
        db_book = Book(**book_data.dict())
        self.db.add(db_book)
        self.db.commit()
        self.db.refresh(db_book)
        return db_book
    
    def update_book(self, book_id: int, book_data: BookUpdate) -> Book:
        book = self.db.query(Book).filter(Book.id == book_id).first()
        if not book:
            raise ValueError("도서를 찾을 수 없습니다.")
        
        for field, value in book_data.dict(exclude_unset=True).items():
            setattr(book, field, value)
        
        self.db.commit()
        self.db.refresh(book)
        return book`,
            language: 'python',
            size: 900
          },
          {
            path: 'services/category.py',
            content: `from sqlalchemy.orm import Session
from models.category import Category
from schemas.category import CategoryCreate

class CategoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_category(self, category_data: CategoryCreate) -> Category:
        db_category = Category(**category_data.dict())
        self.db.add(db_category)
        self.db.commit()
        self.db.refresh(db_category)
        return db_category
    
    def get_all_categories(self) -> list[Category]:
        return self.db.query(Category).all()`,
            language: 'python',
            size: 500
          },
          {
            path: 'utils/exceptions.py',
            content: `from fastapi import HTTPException

class BookNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(status_code=404, detail="도서를 찾을 수 없습니다.")

class CategoryNotFoundError(HTTPException):
    def __init__(self):
        super().__init__(status_code=404, detail="카테고리를 찾을 수 없습니다.")

class DuplicateISBNError(HTTPException):
    def __init__(self):
        super().__init__(status_code=400, detail="이미 존재하는 ISBN입니다.")

class InsufficientStockError(HTTPException):
    def __init__(self):
        super().__init__(status_code=400, detail="재고가 부족합니다.")`,
            language: 'python',
            size: 600
          }
        ]
      };
    }
    
    console.log('✅ 코드 가져오기 완료!');
    console.log(`⏱️  처리 시간: ${githubTime}ms`);
    console.log(`📄 총 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    
    // 2. 주요 코드 파일 통합
    console.log('\n📝 주요 FastAPI 백엔드 파일들:');
    const codeFiles = repoContent.files.filter(file => 
      (file.path.endsWith('.py')) &&
      !file.path.includes('__pycache__') &&
      !file.path.includes('test')
    );
    
    codeFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
    });
    
    // 코드 내용 통합
    let combinedCode = '# FastAPI 도서 관리 시스템 구현\n\n';
    combinedCode += '## 프로젝트 구조\n';
    combinedCode += '```\n' + repoContent.structure + '\n```\n\n';
    
    // 각 파일의 코드 추가
    for (const file of codeFiles) {
      combinedCode += `## ${file.path}\n\n`;
      combinedCode += '```' + (file.language || 'python') + '\n';
      combinedCode += file.content;
      combinedCode += '\n```\n\n';
    }
    
    // requirements.txt나 설정 파일도 포함
    const configFiles = repoContent.files.filter(file => 
      file.path.includes('requirements.txt') || 
      file.path.includes('README.md') ||
      file.path.includes('.env') ||
      file.path.includes('config')
    );
    
    if (configFiles.length > 0) {
      combinedCode += '## 설정 파일들\n\n';
      for (const file of configFiles) {
        combinedCode += `### ${file.path}\n\n`;
        combinedCode += '```\n';
        combinedCode += file.content || '# 파일 내용이 비어있거나 읽을 수 없습니다.';
        combinedCode += '\n```\n\n';
      }
    }
    
    // 3. AI 피드백 생성
    console.log('\n🤖 AI 피드백 생성 중...');
    
    const feedbackRequest = {
      assignment: {
        code: 'FASTAPI05',
        title: 'FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축',
        requirements: [
          '데이터베이스 모델링 (Book, Category 테이블 구현)',
          'RESTful API 엔드포인트 구현 (CRUD)',
          'SQLAlchemy ORM을 활용한 데이터 처리',
          '검색, 필터링, 페이지네이션 기능',
          '재고 관리 기능 구현',
          'Pydantic 스키마를 통한 유효성 검증',
          '적절한 에러 처리 및 응답 형식',
          '코드 구조화 및 계층별 책임 분리'
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
        position: 'backend_fastapi',
        evaluationCriteria: backendEvaluationCriteria,
        difficulty: 'intermediate' as const
      },
      submission: {
        type: 'code' as const,
        content: combinedCode,
        url: repoUrl,
        title: 'FastAPI 도서 관리 시스템 구현'
      },
      user_context: {
        previous_submissions: 3,
        average_score: 82,
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
    const outputFile = path.join(outputDir, `backend-feedback-${timestamp}.md`);
    
    // 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 마크다운 문서 생성
    let markdownContent = `# AI 피드백 보고서: FastAPI 도서 관리 시스템\n\n`;
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
  testBackendFeedback()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testBackendFeedback };