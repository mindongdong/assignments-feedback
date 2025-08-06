# 📚 Study Assignment Management System

스터디 과제 관리를 위한 Discord 봇과 AI 기반 피드백 시스템입니다.

## 🎯 주요 기능

- **Discord 봇**: 과제 제출 및 조회를 위한 한국어 명령어 지원
- **AI 피드백**: Claude/OpenAI를 활용한 자동 코드 리뷰 및 피드백
- **6자리 고유번호**: 간편한 과제 식별을 위한 고유번호 시스템 (예: ABC123)
- **실시간 현황 추적**: 제출 상태 및 피드백 확인

## 🛠 기술 스택

- **Backend**: Node.js + TypeScript + Express + Prisma
- **Database**: PostgreSQL + Redis
- **Discord Bot**: Discord.js
- **AI**: Claude API + OpenAI API

## 📦 프로젝트 구조

```
assignments-feedback/
├── backend/          # Express API 서버
├── discord-bot/      # Discord 봇
├── shared/          # 공유 타입 및 유틸리티
│   ├── types/       # TypeScript 타입 정의
│   └── utils/       # 공용 유틸리티 함수
├── database/        # 데이터베이스 관련 파일
└── docker-compose.yml
```

## 🚀 시작하기

### 환경 설정

1. `.env.example`을 복사하여 `.env` 파일 생성
```bash
cp .env.example .env
```

2. 필요한 환경 변수 설정:
- Discord Bot Token
- Claude/OpenAI API Keys
- Database 연결 정보

### 설치 및 실행

```bash
# Docker 컨테이너 실행 (PostgreSQL, Redis)
make docker-up

# 의존성 설치
make install

# 데이터베이스 마이그레이션
make migrate

# 개발 서버 실행
make dev
```

### 개별 서비스 실행

```bash
# Backend API만 실행
make dev-backend

# Discord Bot만 실행
make dev-bot
```

## 💬 Discord 명령어

- `!공지 {과제코드}` - 과제 상세 정보 확인
- `!제출` - 대화형 과제 제출
- `!제출글 {과제코드} "{제목}" {링크}` - 글 과제 제출
- `!제출코드 {과제코드} {GitHub링크}` - 코드 과제 제출
- `!피드백 {제출번호}` - AI 피드백 확인
- `!내제출 {과제코드}` - 특정 과제 제출 상태
- `!현황` - 전체 제출 현황
- `!과제리스트` - 등록된 과제 목록

## 🧪 테스트

```bash
# 전체 테스트 실행
make test

# 테스트 커버리지 확인
make test-coverage
```

## 📝 개발 가이드

### 데이터베이스 스키마 변경

```bash
# Prisma 스키마 수정 후
make db-push  # 개발 환경
make migrate  # 마이그레이션 생성
```

### Discord 명령어 배포

```bash
make deploy-commands
```

## 🔐 보안 설정

- 모든 API 키는 환경 변수로 관리
- Rate limiting 적용
- Input validation 구현
- SQL injection 방지

## 📊 모니터링

- API 응답 시간: < 200ms
- AI 피드백 생성: < 30초
- 동시 사용자: 100+

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request