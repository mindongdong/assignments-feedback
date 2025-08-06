# 스터디 과제 관리 시스템 개발 계획

## 🎯 프로젝트 개요

웹 스터디의 과제 관리를 자동화하는 시스템으로, 디스코드 봇을 통한 과제 제출과 AI 기반 자동 피드백을 제공합니다.

### 핵심 기능
- 디스코드 봇을 통한 과제 제출 및 조회
- AI(Claude/OpenAI) 기반 자동 코드 리뷰 및 피드백
- 6자리 고유번호 시스템으로 과제 관리
- 실시간 제출 현황 추적

## 📋 개발 범위 (Phase 1)

1. **디스코드 봇**: 과제 제출/조회 인터페이스
2. **AI 피드백 시스템**: Claude/OpenAI API 통합
3. **데이터베이스**: 과제, 제출물, 피드백 저장

## 🛠 기술 스택

### 백엔드
- **언어/프레임워크**: Node.js + Express 또는 Python + FastAPI
- **데이터베이스**: PostgreSQL (관계형 데이터)
- **캐싱**: Redis (AI 피드백 캐싱)
- **ORM**: Prisma (Node.js) 또는 SQLAlchemy (Python)

### 디스코드 봇
- **라이브러리**: Discord.js (Node.js) 또는 Discord.py (Python)
- **명령어 처리**: Slash Commands 지원

### AI 통합
- **LLM API**: OpenAI API, Anthropic Claude API
- **프롬프트 관리**: 과제별 맞춤 평가 기준
- **비용 최적화**: 응답 캐싱, 토큰 관리

## 📅 개발 일정 (6일 스프린트)

### Day 1: 기초 설계
- 데이터베이스 스키마 설계
- API 엔드포인트 설계
- 시스템 아키텍처 정의

### Day 2-3: 백엔드 개발
- 백엔드 서버 구축
- 데이터베이스 연동
- 핵심 비즈니스 로직 구현
  - 6자리 고유번호 생성
  - 제출물 처리
  - GitHub/블로그 데이터 수집

### Day 3-4: AI 통합
- LLM API 연동
- 프롬프트 엔지니어링
- 피드백 생성 로직
- 에러 처리 및 재시도

### Day 4-5: 디스코드 봇
- 봇 초기 설정
- 명령어 구현
- 백엔드 API 통합
- 대화형 UI 구현

### Day 5-6: 테스트 및 최적화
- 단위/통합 테스트
- 성능 최적화
- 배포 준비

## 🏗 시스템 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Discord Bot   │────▶│   Backend API   │────▶│    Database     │
│                 │     │                 │     │  (PostgreSQL)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   AI Service    │────▶│      Redis      │
                        │ (Claude/OpenAI) │     │    (Cache)      │
                        └─────────────────┘     └─────────────────┘
```

## 💾 데이터베이스 스키마

### assignments (과제)
- id: UUID
- assignment_code: VARCHAR(6) UNIQUE - 6자리 고유번호
- title: VARCHAR(255)
- description: TEXT
- requirements: TEXT
- recommendations: TEXT
- deadline: TIMESTAMP
- created_at: TIMESTAMP

### submissions (제출물)
- id: UUID
- assignment_code: VARCHAR(6) - FK to assignments
- user_id: VARCHAR(255) - Discord User ID
- submission_type: ENUM('blog', 'code')
- content: TEXT
- url: VARCHAR(500)
- submitted_at: TIMESTAMP

### feedbacks (피드백)
- id: UUID
- submission_id: UUID - FK to submissions
- ai_feedback: TEXT
- ai_score: JSON
- manual_feedback: TEXT (nullable)
- created_at: TIMESTAMP

### users (사용자)
- id: UUID
- discord_id: VARCHAR(255) UNIQUE
- username: VARCHAR(255)
- created_at: TIMESTAMP

## 🔌 API 엔드포인트

### 과제 관련
- `GET /api/assignments/:code` - 과제 조회
- `GET /api/assignments` - 과제 목록
- `POST /api/assignments` - 과제 생성 (관리자)

### 제출 관련
- `POST /api/submissions` - 과제 제출
- `GET /api/submissions/:id` - 제출물 조회
- `GET /api/submissions/user/:userId` - 사용자별 제출 목록

### 피드백 관련
- `POST /api/feedback/generate` - AI 피드백 생성
- `GET /api/feedback/:submissionId` - 피드백 조회

## 🤖 디스코드 봇 명령어

### 기본 명령어
- `!공지 {과제고유번호}` - 과제 상세 정보 조회
- `!제출` - 대화형 제출 프로세스 시작
- `!제출글 {과제고유번호} "{제목}" {링크}` - 글 과제 직접 제출
- `!제출코드 {과제고유번호} {GitHub링크}` - 코드 과제 직접 제출
- `!피드백 {제출번호}` - AI 피드백 재확인
- `!내제출 {과제고유번호}` - 특정 과제 제출 상태
- `!현황` - 전체 제출 현황
- `!과제리스트` - 과제 목록 조회

## 🧠 AI 피드백 시스템

### 프롬프트 구조
```
당신은 친절하고 전문적인 프로그래밍 튜터입니다.

[과제 정보]
- 과제 고유번호: {assignment_id}
- 과제명: {assignment_title}
- 요구사항: {requirements}
- 권장사항: {recommendations}

[제출물]
{submission_content}

[평가 기준]
1. 요구사항 충족 여부
2. 코드 품질
3. 베스트 프랙티스 준수
4. 개선 제안

마크다운 형식으로 구체적인 피드백을 작성해주세요.
```

## 🚀 Agent 활용 계획

### Phase별 Agent 배치

#### Phase 1: 기초 설계
- **backend-architect**: 데이터베이스 스키마, API 설계

#### Phase 2: 백엔드 개발
- **rapid-prototyper**: 초기 서버 구축
- **backend-architect**: 비즈니스 로직 구현

#### Phase 3: AI 통합
- **ai-engineer**: LLM 통합, 프롬프트 엔지니어링

#### Phase 4: 디스코드 봇
- **rapid-prototyper**: 봇 초기 구현
- **backend-architect**: API 통합

#### Phase 5: 테스트
- **test-writer-fixer**: 테스트 코드 작성
- **performance-benchmarker**: 성능 최적화

## 🔐 보안 고려사항

1. **환경 변수 관리**
   - Discord Bot Token
   - AI API Keys
   - Database Credentials

2. **입력 검증**
   - SQL Injection 방지
   - XSS 방지
   - Rate Limiting

3. **권한 관리**
   - 관리자 전용 기능 분리
   - 사용자별 접근 제어

## 📊 성능 목표

- API 응답 시간: < 200ms (AI 제외)
- AI 피드백 생성: < 30초
- 동시 접속 처리: 100+ 사용자
- 가용성: 99.9%

## 🔄 향후 확장 계획

### Phase 2 (관리자 웹)
- React/Vue 기반 관리자 대시보드
- 실시간 모니터링
- 수동 피드백 기능

### Phase 3 (고급 기능)
- 과제별 통계 분석
- 학습 진도 추적
- 팀 프로젝트 지원

## 📝 개발 규칙

1. **코드 스타일**
   - ESLint/Prettier 설정
   - TypeScript 사용 권장
   - 명확한 변수명과 함수명

2. **Git 컨벤션**
   - Feature 브랜치 전략
   - Conventional Commits
   - PR 리뷰 필수

3. **문서화**
   - API 문서 (Swagger/OpenAPI)
   - 코드 주석
   - README 업데이트

## ✅ 완료 기준

- [ ] 모든 디스코드 명령어 정상 작동
- [ ] AI 피드백 생성 성공률 > 95%
- [ ] 6자리 고유번호 중복 없음
- [ ] 전체 테스트 커버리지 > 80%
- [ ] 배포 가능한 상태

---

이 계획은 6일 스프린트 철학에 따라 빠른 개발과 실용적인 구현에 중점을 둡니다. 
완벽보다는 작동하는 제품을 우선시하며, 향후 반복적으로 개선해 나갑니다.