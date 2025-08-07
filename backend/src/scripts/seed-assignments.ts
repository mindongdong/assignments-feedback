/**
 * Assignment seeding script
 * 테스트용 과제를 데이터베이스에 등록
 */

import { PrismaClient } from '@prisma/client';
import { generateAssignmentCode } from '../utils/assignmentCode';

const prisma = new PrismaClient();

async function seedAssignments() {
  console.log('🌱 과제 데이터 시딩 시작...');

  try {
    // 1. FastAPI + SQLAlchemy 과제 등록
    const backendAssignment = await prisma.assignment.create({
      data: {
        assignmentCode: generateAssignmentCode(),
        title: 'FastAPI + SQLAlchemy 도서 관리 시스템',
        description: `## FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축

### 📌 과제 개요
간단한 도서 관리 시스템의 RESTful API를 구현하세요. **인프런 강의 섹션 3. 데이터베이스**에서 학습한 SQLAlchemy ORM과 FastAPI를 활용하여 CRUD 기능을 구현해봅니다.

### 📁 제출 방법
1. GitHub 저장소에 코드 업로드
2. README.md 파일에 다음 내용 포함:
   - 프로젝트 설정 방법
   - API 문서 (엔드포인트, 요청/응답 예시)`,
        requirements: JSON.stringify([
          "Book 테이블 설계 (id, title, author, isbn, price, stock_quantity, published_date, created_at, updated_at)",
          "Category 테이블 설계 (id, name, description, created_at)",
          "Book과 Category 다대일 관계 설정",
          "POST /books - 새 도서 등록",
          "GET /books - 전체 도서 목록 조회",
          "GET /books/{book_id} - 특정 도서 상세 조회",
          "PATCH /books/{book_id} - 도서 정보 수정",
          "DELETE /books/{book_id} - 도서 삭제",
          "POST /categories - 카테고리 생성",
          "GET /categories - 전체 카테고리 목록 조회",
          "검색 기능: GET /books?search={keyword}",
          "필터링: GET /books?category_id={id}&min_price={price}&max_price={price}",
          "페이지네이션: GET /books?page={page}&size={size}",
          "재고 관리: PATCH /books/{book_id}/stock",
          "Pydantic을 사용한 요청/응답 스키마 정의",
          "적절한 HTTP 상태 코드와 에러 처리"
        ]),
        recommendations: JSON.stringify([
          "SQLAlchemy의 filter(), like(), and_(), or_() 활용",
          "페이지네이션은 offset()과 limit() 사용",
          "관계 데이터 조회 시 joinedload() 또는 selectinload() 고려",
          "트랜잭션 처리를 위해 db.commit()과 db.rollback() 적절히 사용",
          "계층별 책임 분리 (라우터, 서비스, 모델)",
          "명확한 함수/변수 네이밍과 타입 힌트 사용",
          "README.md에 설치 및 실행 가이드 포함"
        ]),
        deadline: new Date('2025-08-08T23:59:59Z'),
        category: 'backend',
        difficulty: 'MEDIUM',
        estimatedHours: 8,
        autoFeedback: true,
        isActive: true
      }
    });

    // 2. React.js 과제 등록
    const frontendAssignment = await prisma.assignment.create({
      data: {
        assignmentCode: generateAssignmentCode(),
        title: 'React.js 독서 기록장 만들기',
        description: `## React.js 실습 과제: 독서 기록장 만들기

### 📌 과제 개요
React를 사용하여 간단한 독서 기록 관리 애플리케이션을 만드세요. **인프런 강의 섹션 6. React.js 입문**에서 학습한 내용을 활용해 사용자가 읽은 책을 추가하고, 별점을 매기고, 간단한 메모를 남길 수 있는 기능을 구현합니다.

### 📁 제출 방법
1. GitHub 저장소에 코드 업로드
2. README.md에 실행 방법과 구현한 기능 목록 작성, 추가 기능을 구현한 경우 명시`,
        requirements: JSON.stringify([
          "App 메인 컴포넌트",
          "BookForm 책 정보 입력 폼",
          "BookList 책 목록 표시 컴포넌트",
          "BookItem 개별 책 정보 표시 컴포넌트",
          "제목 입력 필드",
          "저자 입력 필드",
          "별점 선택 (1-5점, 라디오 버튼 또는 select)",
          "간단한 메모 입력 (textarea)",
          "추가 버튼",
          "책 추가 기능",
          "책 삭제 기능 (각 BookItem에 삭제 버튼)",
          "총 읽은 책 권수 표시",
          "useRef를 사용하여 책 추가 후 첫 번째 입력 필드에 자동 포커스",
          "책이 없을 때 '아직 등록된 책이 없습니다' 메시지 표시"
        ]),
        recommendations: JSON.stringify([
          "적절한 컴포넌트 구조와 역할 분담",
          "부모-자식 컴포넌트 간 Props를 통한 데이터 전달",
          "useState를 사용한 폼 입력값 관리",
          "useState를 사용한 책 목록 데이터 관리",
          "이벤트 처리 (폼 제출, 삭제 등)",
          "적절한 useRef 활용",
          "깔끔한 UI와 사용자 경험",
          "각 책 정보에는 제목, 저자, 별점(⭐로 표시), 메모 포함",
          "카드 형태로 책 목록 표시"
        ]),
        deadline: new Date('2025-08-08T23:59:59Z'),
        category: 'frontend',
        difficulty: 'EASY',
        estimatedHours: 6,
        autoFeedback: true,
        isActive: true
      }
    });

    // 과제 통계 초기화
    await prisma.assignmentStats.createMany({
      data: [
        {
          assignmentCode: backendAssignment.assignmentCode
        },
        {
          assignmentCode: frontendAssignment.assignmentCode
        }
      ]
    });

    console.log(`✅ Backend 과제 등록 완료: ${backendAssignment.assignmentCode} - ${backendAssignment.title}`);
    console.log(`✅ Frontend 과제 등록 완료: ${frontendAssignment.assignmentCode} - ${frontendAssignment.title}`);
    
    console.log('🎉 과제 데이터 시딩 완료!');
    
    return {
      backendAssignment,
      frontendAssignment
    };
  } catch (error) {
    console.error('❌ 과제 시딩 중 오류 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedAssignments()
    .then((result) => {
      console.log('시딩된 과제:', result);
    })
    .catch((error) => {
      console.error('시딩 실패:', error);
      process.exit(1);
    });
}

export { seedAssignments };