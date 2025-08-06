# Assignment Feedback Backend API

Discord 봇 기반 과제 관리 시스템의 백엔드 API 서버입니다.

## 🚀 빠른 시작

### 필수 요구사항
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Yarn 또는 npm

### 1. 의존성 설치
```bash
yarn install
# 또는
npm install
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 편집하여 실제 값으로 설정
```

### 3. 데이터베이스 설정
```bash
# Prisma 마이그레이션 실행
yarn migrate
# 또는
npx prisma migrate dev

# 데이터베이스 시드 데이터 생성 (개발용)
yarn db:seed
```

### 4. 개발 서버 시작
```bash
yarn dev
# 또는
npm run dev
```

서버가 시작되면 http://localhost:3001 에서 접근할 수 있습니다.

## 📁 프로젝트 구조

```
backend/
├── src/
│   ├── controllers/          # API 컨트롤러
│   │   ├── AssignmentController.ts
│   │   ├── SubmissionController.ts
│   │   ├── UserController.ts
│   │   └── AuthController.ts
│   ├── middleware/           # Express 미들웨어
│   │   ├── auth.ts          # JWT 인증
│   │   ├── errorHandler.ts  # 에러 핸들링
│   │   └── rateLimiter.ts   # 요청 제한
│   ├── routes/              # API 라우트
│   │   ├── assignments.ts
│   │   ├── submissions.ts
│   │   ├── users.ts
│   │   └── auth.ts
│   ├── services/            # 비즈니스 로직
│   │   ├── AIService.ts     # AI 피드백 생성
│   │   ├── CacheService.ts  # Redis 캐싱
│   │   └── ContentFetcher.ts # 외부 콘텐츠 가져오기
│   ├── utils/               # 유틸리티 함수
│   │   ├── errors.ts        # 에러 클래스
│   │   ├── helpers.ts       # 헬퍼 함수
│   │   ├── logger.ts        # 로깅
│   │   └── validation.ts    # 입력값 검증
│   ├── database/
│   │   └── seed.ts          # 시드 데이터
│   └── index.ts             # 애플리케이션 엔트리 포인트
├── prisma/
│   └── schema.prisma        # 데이터베이스 스키마
├── logs/                    # 로그 파일 (자동 생성)
└── dist/                    # 컴파일된 JavaScript (자동 생성)
```

## 🔌 API 엔드포인트

### 인증 (Authentication)
- `GET /auth/discord/url` - Discord OAuth URL 생성
- `POST /auth/discord/login` - Discord 로그인
- `POST /auth/refresh` - JWT 토큰 갱신
- `DELETE /auth/logout` - 로그아웃
- `GET /auth/me` - 현재 사용자 정보

### 과제 관리 (Assignments)
- `GET /api/assignments` - 과제 목록 조회
- `GET /api/assignments/:code` - 특정 과제 상세 조회
- `POST /api/assignments` - 과제 생성 (관리자)
- `PUT /api/assignments/:code` - 과제 수정 (관리자)
- `DELETE /api/assignments/:code` - 과제 삭제 (관리자)

### 제출물 관리 (Submissions)
- `POST /api/submissions/blog` - 블로그 글 제출
- `POST /api/submissions/code` - 코드 제출
- `POST /api/submissions/interactive/start` - 대화형 제출 시작
- `GET /api/submissions/:id/feedback` - 피드백 조회
- `PUT /api/submissions/:id` - 제출물 수정

### 사용자 관리 (Users)
- `GET /api/users/me` - 내 프로필 조회
- `PUT /api/users/me` - 프로필 수정
- `GET /api/users/me/status` - 전체 현황 조회
- `GET /api/users/me/submissions` - 내 제출물 목록
- `GET /api/users/me/submissions/:code` - 특정 과제 제출 현황
- `GET /api/users/leaderboard` - 리더보드

## 🔧 주요 기능

### 1. Discord OAuth2 인증
- Discord 계정으로 로그인
- JWT 토큰 기반 인증
- 자동 사용자 생성/업데이트

### 2. 과제 관리
- 6자리 영숫자 과제 코드 (ABC123)
- 마감일 관리
- 요구사항/권장사항 관리

### 3. 제출물 처리
- 블로그 글 자동 크롤링 (Notion, 티스토리 등)
- GitHub 저장소 자동 분석
- 대화형 제출 프로세스

### 4. AI 피드백 시스템
- Claude/OpenAI 기반 자동 피드백
- 다중 평가 기준 (요구사항 충족도, 코드 품질, 모범 사례, 창의성)
- 한국어 피드백

### 5. 캐싱 시스템
- Redis 기반 캐싱
- 자동 캐시 무효화
- 성능 최적화

### 6. 에러 처리 및 검증
- 포괄적인 에러 핸들링
- 한국어 에러 메시지
- 입력값 유효성 검사

## 🔒 보안 기능

- JWT 토큰 인증
- 요청 속도 제한
- CORS 설정
- Helmet 보안 헤더
- 입력값 검증 및 새니타이징

## 📊 모니터링 및 로깅

- Winston 로깅 시스템
- 요청/응답 로깅
- 에러 추적
- 성능 메트릭

## 🧪 테스트

```bash
# 테스트 실행
yarn test

# 테스트 커버리지
yarn test:coverage

# 테스트 감시 모드
yarn test:watch
```

## 🚀 배포

### 프로덕션 빌드
```bash
yarn build
yarn start
```

### Docker 사용
```bash
# Docker 이미지 빌드
docker build -t assignments-backend .

# 컨테이너 실행
docker run -p 3001:3001 --env-file .env assignments-backend
```

### 환경별 설정

#### 개발 환경
- 상세한 로깅
- 시드 데이터 사용 가능
- Hot reload

#### 프로덕션 환경
- 최적화된 로깅
- 보안 강화
- 성능 최적화

## 🔧 설정 옵션

### 환경 변수
주요 환경 변수들:

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `REDIS_HOST/PORT`: Redis 서버 설정
- `JWT_SECRET`: JWT 서명 키
- `DISCORD_CLIENT_ID/SECRET`: Discord OAuth2 설정
- `ANTHROPIC_API_KEY`: Claude AI API 키
- `OPENAI_API_KEY`: OpenAI API 키

자세한 설정은 `.env.example`을 참조하세요.

### 캐시 설정
- Assignment 상세: 5분
- 사용자 상태: 2분
- AI 피드백: 1시간

### 속도 제한
- 일반 API: 15분당 100회
- 제출: 1시간당 10회
- 피드백 조회: 10분당 20회

## 🐛 문제 해결

### 일반적인 문제들

1. **데이터베이스 연결 실패**
   ```bash
   # PostgreSQL 상태 확인
   brew services list | grep postgresql
   # 또는
   sudo systemctl status postgresql
   ```

2. **Redis 연결 실패**
   ```bash
   # Redis 상태 확인
   brew services list | grep redis
   # 또는
   sudo systemctl status redis
   ```

3. **AI 서비스 오류**
   - API 키 확인
   - 요청 한도 확인
   - 네트워크 연결 확인

### 로그 확인
```bash
# 실시간 로그 확인
tail -f logs/combined.log

# 에러 로그만 확인
tail -f logs/error.log
```

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 라이선스

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.