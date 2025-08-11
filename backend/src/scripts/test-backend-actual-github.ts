/**
 * 백엔드 과제로 실제 GitHub 코드 평가 테스트
 * - backend_assignment.md 과제로 실제 GitHub backend 코드를 평가
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
    points: 15,
    details: [
      'Book, Category 테이블 스키마 설계의 적절성',
      'SQLAlchemy ORM 모델 클래스 구현',
      '다대일 관계 설정 및 제약조건 구현',
      '타임스탬프 자동 처리 (created_at, updated_at)'
    ]
  },
  {
    title: 'API 엔드포인트 구현',
    points: 20,
    details: [
      '모든 필수 CRUD 엔드포인트 구현',
      'RESTful API 설계 원칙 준수',
      '적절한 HTTP 메서드와 상태 코드 사용',
      '일관된 응답 형식 구현 (status, data, message, meta)'
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
      '검색 기능의 정확성 (제목/저자 키워드 검색)',
      '필터링 조건 조합 처리 (카테고리, 가격대)',
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

async function testBackendActualGitHub() {
  console.log('🚀 백엔드 과제로 실제 GitHub 코드 평가 테스트 시작...\n');
  console.log('📋 과제: FastAPI + SQLAlchemy 도서 관리 시스템 API (backend_assignment.md)');
  console.log('💻 평가 대상: 실제 백엔드 FastAPI 코드');
  console.log('🎯 Position: backend\n');

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
    // 1. GitHub에서 실제 백엔드 코드 가져오기
    console.log('\n📂 GitHub에서 실제 백엔드 코드 가져오는 중...');
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
        console.log('📝 샘플 백엔드 코드 사용...');
        repoContent = getSampleBackendCode();
      }
    } else {
      console.log('📝 GitHub API 사용 불가. 샘플 백엔드 코드 사용...');
      repoContent = getSampleBackendCode();
    }
    
    console.log(`⏱️  처리 시간: ${githubTime}ms`);
    console.log(`📄 총 파일 수: ${repoContent.metadata.totalFiles}`);
    console.log(`💾 총 크기: ${Math.round(repoContent.metadata.totalSize / 1024)}KB`);
    
    // 2. 백엔드 관련 파일 필터링 및 분석
    console.log('\n📝 분석 대상 파일들:');
    const codeFiles = repoContent.files.filter((file: any) => 
      (file.path.endsWith('.py') || 
       file.path.endsWith('.sql') || 
       file.path.includes('requirements.txt') ||
       file.path.includes('pyproject.toml') ||
       file.path.endsWith('.env.example') ||
       file.path.includes('main.py') ||
       file.path.includes('models.py') ||
       file.path.includes('schemas.py') ||
       file.path.includes('routers') ||
       file.path.includes('database') ||
       file.path.includes('crud')) &&
      !file.path.includes('node_modules') &&
      !file.path.includes('__pycache__') &&
      !file.path.includes('.pyc') &&
      !file.path.includes('venv') &&
      !file.path.includes('.env') // .env 파일은 보안상 제외
    );
    
    codeFiles.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.path} (${file.language || 'python'})`);
    });
    
    // 코드 내용 통합
    let combinedCode = '# FastAPI 도서 관리 시스템 API 구현\n\n';
    combinedCode += '## 프로젝트 구조\n';
    combinedCode += '```\n' + repoContent.structure + '\n```\n\n';
    
    // 각 파일의 코드 추가
    for (const file of codeFiles) {
      combinedCode += `## ${file.path}\n\n`;
      combinedCode += '```' + (file.language || 'python') + '\n';
      combinedCode += file.content;
      combinedCode += '\n```\n\n';
    }
    
    // README 파일도 포함 (문서화 평가를 위해)
    const readmeFiles = repoContent.files.filter((file: any) => 
      file.path.toLowerCase().includes('readme') ||
      file.path.toLowerCase().includes('api') ||
      file.path.toLowerCase().includes('docs')
    );
    
    if (readmeFiles.length > 0) {
      combinedCode += '## 문서화 파일들\n\n';
      for (const file of readmeFiles) {
        combinedCode += `### ${file.path}\n\n`;
        combinedCode += '```markdown\n';
        combinedCode += file.content || '/* 문서 내용이 비어있거나 읽을 수 없습니다 */';
        combinedCode += '\n```\n\n';
      }
    }
    
    // 3. 백엔드 과제로 AI 피드백 생성
    console.log('\n🤖 백엔드 관점에서 AI 피드백 생성 중...');
    console.log('✅ 정확한 매칭: 백엔드 코드를 백엔드 과제 기준으로 평가합니다.');
    
    const feedbackRequest = {
      assignment: {
        code: 'FASTAPI_ACTUAL_TEST',
        title: 'FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축',
        requirements: [
          'Book, Category 테이블 ORM 모델링',
          'SQLAlchemy를 활용한 관계 설정 (다대일)',
          'POST /books - 새 도서 등록',
          'GET /books - 전체 도서 목록 조회',
          'GET /books/{book_id} - 특정 도서 상세 조회',
          'PATCH /books/{book_id} - 도서 정보 수정',
          'DELETE /books/{book_id} - 도서 삭제',
          'POST /categories - 카테고리 생성',
          'GET /categories - 전체 카테고리 목록 조회',
          '검색 기능: GET /books?search={keyword}',
          '필터링: GET /books?category_id={id}&min_price={price}&max_price={price}',
          '페이지네이션: GET /books?page={page}&size={size}',
          '재고 관리: PATCH /books/{book_id}/stock',
          'Pydantic 스키마를 활용한 유효성 검증',
          '일관된 응답 형식 (status, data, message, meta)',
          '적절한 에러 처리 (404, 400, 500)'
        ],
        recommendations: [
          'SQLAlchemy ORM의 효율적 활용',
          '트랜잭션 처리',
          'RESTful API 설계 원칙 준수',
          '계층별 책임 분리 (라우터, 서비스, 모델)',
          '타입 힌트 사용',
          'API 문서화'
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
        title: 'FastAPI 도서 관리 시스템 API 구현'
      },
      user_context: {
        previous_submissions: 3,
        average_score: 80,
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
    const outputFile = path.join(outputDir, `backend-actual-github-feedback-${timestamp}.md`);
    
    // 디렉토리 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 마크다운 문서 생성
    let markdownContent = `# AI 피드백 보고서: FastAPI 도서 관리 시스템 API (실제 GitHub 코드)\n\n`;
    markdownContent += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    markdownContent += `**과제 문서**: backend_assignment.md\n`;
    markdownContent += `**평가 코드**: 실제 GitHub 백엔드 코드\n`;
    markdownContent += `**GitHub URL**: ${repoUrl}\n`;
    markdownContent += `**Position**: backend\n`;
    markdownContent += `**총점**: ${feedback.score}/100\n\n`;
    
    markdownContent += `> ✅ **정확한 매칭**: 백엔드 코드를 백엔드 과제 기준으로 평가한 정상적인 결과입니다.\n\n`;
    
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
    
    // 테스트 정보 추가
    markdownContent += `\n### 🎯 테스트 정보\n\n`;
    markdownContent += `- **테스트 유형**: Actual GitHub Code Testing\n`;
    markdownContent += `- **과제 유형**: Backend (FastAPI + SQLAlchemy)\n`;
    markdownContent += `- **코드 유형**: Backend (FastAPI)\n`;
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
    console.log('• 이 테스트는 백엔드 과제로 백엔드 코드를 평가한 정상적인 결과입니다.');
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

// 샘플 백엔드 코드 생성 함수 (GitHub 실패 시 사용)
function getSampleBackendCode() {
  return {
    metadata: {
      totalFiles: 8,
      totalSize: 8192,
      lastCommit: null
    },
    structure: `backend/members/example-user/week5/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── books.py
│   │   └── categories.py
│   └── services/
│       ├── __init__.py
│       └── book_service.py
├── requirements.txt
└── README.md`,
    files: [
      {
        path: 'app/main.py',
        content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routers import books, categories

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="도서 관리 시스템 API",
    description="FastAPI + SQLAlchemy를 활용한 도서 관리 시스템",
    version="1.0.0"
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(books.router, prefix="/books", tags=["books"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])

@app.get("/")
def read_root():
    return {"message": "도서 관리 시스템 API", "status": "success"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}`,
        language: 'python',
        size: 800
      },
      {
        path: 'app/database.py',
        content: `from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./books.db")

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()`,
        language: 'python',
        size: 600
      },
      {
        path: 'app/models.py',
        content: `from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    books = relationship("Book", back_populates="category")

class Book(Base):
    __tablename__ = "books"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    author = Column(String(100), nullable=False, index=True)
    isbn = Column(String(13), unique=True, nullable=False, index=True)
    price = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0, nullable=False)
    published_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), 
                       server_default=func.now(), onupdate=func.now())
    
    # Foreign Key
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Relationship
    category = relationship("Category", back_populates="books")`,
        language: 'python',
        size: 1200
      },
      {
        path: 'app/schemas.py',
        content: `from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List

# Category Schemas
class CategoryBase(BaseModel):
    name: str = Field(..., max_length=50)
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Book Schemas
class BookBase(BaseModel):
    title: str = Field(..., max_length=200)
    author: str = Field(..., max_length=100)
    isbn: str = Field(..., min_length=13, max_length=13)
    price: int = Field(..., ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    published_date: Optional[datetime] = None
    category_id: Optional[int] = None

class BookCreate(BookBase):
    @validator('isbn')
    def validate_isbn(cls, v):
        if not v.isdigit():
            raise ValueError('ISBN은 13자리 숫자여야 합니다')
        return v

class BookUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    author: Optional[str] = Field(None, max_length=100)
    isbn: Optional[str] = Field(None, min_length=13, max_length=13)
    price: Optional[int] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    published_date: Optional[datetime] = None
    category_id: Optional[int] = None

class BookResponse(BookBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryResponse] = None
    
    class Config:
        from_attributes = True

# Stock Management Schema
class StockUpdateRequest(BaseModel):
    quantity: int = Field(..., gt=0)
    operation: str = Field(..., regex="^(add|subtract)$")

# Response Schemas
class ApiResponse(BaseModel):
    status: str
    message: str
    data: Optional[dict] = None

class PaginatedResponse(ApiResponse):
    meta: dict = Field(default_factory=dict)`,
        language: 'python',
        size: 1500
      },
      {
        path: 'app/routers/books.py',
        content: `from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import Optional, List
from app.database import get_db
from app import models, schemas

router = APIRouter()

@router.post("/", response_model=dict)
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db)):
    # ISBN 중복 확인
    existing_book = db.query(models.Book).filter(models.Book.isbn == book.isbn).first()
    if existing_book:
        raise HTTPException(status_code=400, detail="이미 존재하는 ISBN입니다")
    
    # 카테고리 존재 확인
    if book.category_id:
        category = db.query(models.Category).filter(models.Category.id == book.category_id).first()
        if not category:
            raise HTTPException(status_code=400, detail="존재하지 않는 카테고리입니다")
    
    db_book = models.Book(**book.dict())
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    
    return {
        "status": "success",
        "message": "도서가 성공적으로 등록되었습니다",
        "data": schemas.BookResponse.from_orm(db_book).dict()
    }

@router.get("/", response_model=dict)
def get_books(
    search: Optional[str] = Query(None, description="제목 또는 저자 검색"),
    category_id: Optional[int] = Query(None, description="카테고리 ID로 필터링"),
    min_price: Optional[int] = Query(None, description="최소 가격"),
    max_price: Optional[int] = Query(None, description="최대 가격"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Book).options(joinedload(models.Book.category))
    
    # 검색 조건 적용
    if search:
        search_filter = or_(
            models.Book.title.contains(search),
            models.Book.author.contains(search)
        )
        query = query.filter(search_filter)
    
    if category_id:
        query = query.filter(models.Book.category_id == category_id)
    
    if min_price is not None:
        query = query.filter(models.Book.price >= min_price)
    
    if max_price is not None:
        query = query.filter(models.Book.price <= max_price)
    
    # 총 개수 계산
    total = query.count()
    
    # 페이지네이션 적용
    offset = (page - 1) * size
    books = query.offset(offset).limit(size).all()
    
    return {
        "status": "success",
        "message": f"{len(books)}권의 도서를 조회했습니다",
        "data": [schemas.BookResponse.from_orm(book).dict() for book in books],
        "meta": {
            "page": page,
            "size": size,
            "total": total,
            "total_pages": (total + size - 1) // size
        }
    }

@router.get("/{book_id}", response_model=dict)
def get_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(models.Book).options(joinedload(models.Book.category)).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다")
    
    return {
        "status": "success",
        "message": "도서 정보를 조회했습니다",
        "data": schemas.BookResponse.from_orm(book).dict()
    }

@router.patch("/{book_id}", response_model=dict)
def update_book(book_id: int, book_update: schemas.BookUpdate, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다")
    
    # 업데이트 데이터 적용
    update_data = book_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(book, field, value)
    
    db.commit()
    db.refresh(book)
    
    return {
        "status": "success",
        "message": "도서 정보가 수정되었습니다",
        "data": schemas.BookResponse.from_orm(book).dict()
    }

@router.delete("/{book_id}", response_model=dict)
def delete_book(book_id: int, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다")
    
    db.delete(book)
    db.commit()
    
    return {
        "status": "success",
        "message": "도서가 삭제되었습니다"
    }

@router.patch("/{book_id}/stock", response_model=dict)
def update_stock(book_id: int, stock_request: schemas.StockUpdateRequest, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="도서를 찾을 수 없습니다")
    
    if stock_request.operation == "add":
        book.stock_quantity += stock_request.quantity
    elif stock_request.operation == "subtract":
        if book.stock_quantity < stock_request.quantity:
            raise HTTPException(status_code=400, detail="재고가 부족합니다")
        book.stock_quantity -= stock_request.quantity
    
    db.commit()
    db.refresh(book)
    
    return {
        "status": "success",
        "message": f"재고가 {'증가' if stock_request.operation == 'add' else '감소'}되었습니다",
        "data": {"current_stock": book.stock_quantity}
    }`,
        language: 'python',
        size: 3000
      },
      {
        path: 'app/routers/categories.py',
        content: `from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas

router = APIRouter()

@router.post("/", response_model=dict)
def create_category(category: schemas.CategoryCreate, db: Session = Depends(get_db)):
    # 카테고리명 중복 확인
    existing_category = db.query(models.Category).filter(models.Category.name == category.name).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="이미 존재하는 카테고리명입니다")
    
    db_category = models.Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return {
        "status": "success",
        "message": "카테고리가 성공적으로 생성되었습니다",
        "data": schemas.CategoryResponse.from_orm(db_category).dict()
    }

@router.get("/", response_model=dict)
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).all()
    
    return {
        "status": "success",
        "message": f"{len(categories)}개의 카테고리를 조회했습니다",
        "data": [schemas.CategoryResponse.from_orm(category).dict() for category in categories]
    }

@router.get("/{category_id}", response_model=dict)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="카테고리를 찾을 수 없습니다")
    
    return {
        "status": "success",
        "message": "카테고리 정보를 조회했습니다",
        "data": schemas.CategoryResponse.from_orm(category).dict()
    }`,
        language: 'python',
        size: 1200
      },
      {
        path: 'requirements.txt',
        content: `fastapi==0.104.1
sqlalchemy==2.0.23
uvicorn==0.24.0
python-multipart==0.0.6
pydantic==2.5.0
python-dotenv==1.0.0`,
        language: 'text',
        size: 200
      },
      {
        path: 'README.md',
        content: `# 도서 관리 시스템 API

FastAPI + SQLAlchemy를 활용한 도서 관리 시스템 RESTful API 구현

## 🚀 설치 및 실행

### 1. 의존성 설치
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 2. 서버 실행
\`\`\`bash
uvicorn app.main:app --reload
\`\`\`

## 📚 API 엔드포인트

### Books
- \`POST /books\` - 새 도서 등록
- \`GET /books\` - 전체 도서 목록 조회
- \`GET /books/{book_id}\` - 특정 도서 상세 조회
- \`PATCH /books/{book_id}\` - 도서 정보 수정
- \`DELETE /books/{book_id}\` - 도서 삭제
- \`PATCH /books/{book_id}/stock\` - 재고 관리

### Categories
- \`POST /categories\` - 카테고리 생성
- \`GET /categories\` - 전체 카테고리 목록 조회

## 🔍 검색 및 필터링

\`\`\`
GET /books?search=리액트&category_id=1&min_price=10000&max_price=50000&page=1&size=10
\`\`\`

## 📖 응답 형식

\`\`\`json
{
    "status": "success",
    "data": {...},
    "message": "설명 메시지",
    "meta": {
        "page": 1,
        "size": 10,
        "total": 100
    }
}
\`\`\``,
        language: 'markdown',
        size: 1000
      }
    ]
  };
}

// 스크립트 실행
if (require.main === module) {
  testBackendActualGitHub()
    .then(() => {
      console.log('\n프로그램 종료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('테스트 실패:', error);
      process.exit(1);
    });
}

export { testBackendActualGitHub };