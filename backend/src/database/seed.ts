import { PrismaClient, SubmissionType, Difficulty } from '@prisma/client';
import { generateAssignmentCode } from '../utils/assignmentCode';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Clean existing data (be careful in production!)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Cleaning existing data...');
      await prisma.feedback.deleteMany();
      await prisma.submission.deleteMany();
      await prisma.assignment.deleteMany();
      await prisma.user.deleteMany();
    }

    // Create sample users
    console.log('👤 Creating sample users...');
    const users = await Promise.all([
      prisma.user.create({
        data: {
          discordId: '123456789012345678',
          username: '김개발',
        },
      }),
      prisma.user.create({
        data: {
          discordId: '234567890123456789',
          username: '이프론트',
        },
      }),
      prisma.user.create({
        data: {
          discordId: '345678901234567890',
          username: '박백엔드',
        },
      }),
      prisma.user.create({
        data: {
          discordId: '456789012345678901',
          username: 'admin',
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create sample assignments
    console.log('📝 Creating sample assignments...');
    const assignments = await Promise.all([
      prisma.assignment.create({
        data: {
          assignmentCode: generateAssignmentCode(),
          title: 'React Hooks 실습',
          difficulty: Difficulty.MEDIUM,
          category: 'frontend',
          estimatedHours: 8,
          description: `# React Hooks 심화 학습

이번 과제에서는 React Hooks를 활용하여 실제 프로젝트를 구현합니다.

## 목표
- useState와 useEffect의 올바른 사용법 익히기
- Custom Hook 구현하기
- 성능 최적화 기법 적용하기

## 구현 요구사항
React 18의 최신 기능을 활용하여 Todo 애플리케이션을 구현해주세요.`,
          requirements: `useState와 useEffect 활용
Custom Hook 구현
컴포넌트 최적화
반응형 디자인
로컬 스토리지 연동`,
          recommendations: `ESLint 규칙 준수
TypeScript 사용 권장
테스트 코드 작성
접근성 고려`,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      }),
      prisma.assignment.create({
        data: {
          assignmentCode: generateAssignmentCode(),
          title: 'Node.js API 서버 구축',
          difficulty: Difficulty.HARD,
          category: 'backend',
          estimatedHours: 16,
          description: `# Node.js API 서버 구축

Express.js를 사용하여 RESTful API 서버를 구축하는 과제입니다.

## 학습 목표
- Express.js 프레임워크 활용
- 데이터베이스 연동
- 인증 시스템 구현
- API 문서화

## 구현할 기능
사용자 관리, 게시물 CRUD, 댓글 시스템을 포함한 블로그 API를 구현해주세요.`,
          requirements: `Express.js 사용
PostgreSQL 연동
JWT 인증 구현
Swagger 문서화
에러 핸들링`,
          recommendations: `TypeScript 사용
테스트 코드 작성
Docker 컨테이너화
CI/CD 파이프라인`,
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        },
      }),
      prisma.assignment.create({
        data: {
          assignmentCode: generateAssignmentCode(),
          title: 'CSS Grid 레이아웃 실습',
          difficulty: Difficulty.EASY,
          category: 'frontend',
          estimatedHours: 6,
          description: `# CSS Grid를 활용한 반응형 레이아웃

CSS Grid와 Flexbox를 조합하여 현대적인 웹 레이아웃을 구현합니다.

## 학습 목표
- CSS Grid 시스템 이해
- 반응형 디자인 구현
- 모던 CSS 기법 활용

## 실습 내용
포트폴리오 웹사이트를 CSS Grid로 구현해주세요.`,
          requirements: `CSS Grid 활용
반응형 디자인
크로스 브라우저 호환성
시맨틱 HTML
성능 최적화`,
          recommendations: `SCSS 사용 권장
BEM 네이밍 컨벤션
웹 접근성 준수
성능 최적화`,
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        },
      }),
      // Past assignment for testing
      prisma.assignment.create({
        data: {
          assignmentCode: generateAssignmentCode(),
          title: 'JavaScript 기초 문제 해결',
          difficulty: Difficulty.EASY,
          category: 'frontend',
          estimatedHours: 4,
          description: '기본적인 JavaScript 문제들을 해결하는 과제입니다.',
          requirements: `변수와 함수 활용
조건문과 반복문
배열과 객체 다루기
ES6+ 문법 사용`,
          recommendations: `코드 가독성 고려
주석 작성
best practice 적용`,
          deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (closed)
        },
      }),
    ]);

    console.log(`✅ Created ${assignments.length} assignments`);

    // Create sample submissions
    console.log('📤 Creating sample submissions...');
    const submissions = await Promise.all([
      // Blog submission
      prisma.submission.create({
        data: {
          assignmentCode: assignments[0].assignmentCode,
          userId: users[0].id,
          submissionType: SubmissionType.blog,
          title: 'React Hooks 학습 후기',
          url: 'https://myblog.tistory.com/react-hooks-learning',
          content: `# React Hooks 학습 후기

이번 과제를 통해 React Hooks에 대해 깊이 있게 학습할 수 있었습니다.

## 배운 내용

### useState 사용법
\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

### useEffect 활용
\`\`\`javascript
useEffect(() => {
  // 컴포넌트 마운트 시 실행
  document.title = \`Count: \${count}\`;
}, [count]);
\`\`\`

## 어려웠던 점
- 의존성 배열 관리
- 클린업 함수 구현
- 성능 최적화

## 개선점
앞으로는 더 많은 custom hook을 만들어서 재사용성을 높이고 싶습니다.`,
        },
      }),
      // Code submission
      prisma.submission.create({
        data: {
          assignmentCode: assignments[1].assignmentCode,
          userId: users[1].id,
          submissionType: SubmissionType.code,
          url: 'https://github.com/user/nodejs-blog-api',
          content: `# Node.js Blog API

## Project Structure
\`\`\`
src/
├── controllers/
├── models/
├── routes/
├── middleware/
└── app.js
\`\`\`

## Code Files

## src/app.js
\`\`\`javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));

module.exports = app;
\`\`\`

## src/controllers/userController.js
\`\`\`javascript
const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.create({ username, email, password });
    res.status(201).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
\`\`\``,
        },
      }),
      // Past submission with feedback
      prisma.submission.create({
        data: {
          assignmentCode: assignments[3].assignmentCode,
          userId: users[2].id,
          submissionType: SubmissionType.blog,
          title: 'JavaScript 기초 정리',
          url: 'https://velog.io/@user/javascript-basics',
          content: 'JavaScript 기초 문법과 개념들을 정리한 글입니다...',
        },
      }),
    ]);

    console.log(`✅ Created ${submissions.length} submissions`);

    // Create sample feedback
    console.log('💬 Creating sample feedback...');
    const feedbacks = await Promise.all([
      prisma.feedback.create({
        data: {
          submissionId: submissions[0].id,
          aiFeedback: `# React Hooks 실습 피드백

## 잘한 점
- useState와 useEffect의 기본 사용법을 잘 이해하고 있습니다
- 코드 예시가 명확하고 이해하기 쉽습니다
- 학습 과정에서의 어려움을 솔직하게 공유해주셨네요

## 개선할 점
- Custom Hook 구현 예제가 부족합니다
- 성능 최적화 부분에 대한 구체적인 예시가 있으면 좋겠습니다
- useCallback, useMemo 등의 활용도 다뤄보세요

## 추가 학습 권장사항
- React DevTools를 활용한 성능 분석
- 복잡한 상태 관리를 위한 useReducer 학습
- Context API와 Hooks의 조합 활용

전반적으로 기초는 탄탄하니, 좀 더 고급 개념들을 학습해보시기 바랍니다!`,
          aiScore: {
            requirementsFulfillment: 7,
            codeQuality: 8,
            bestPractices: 6,
            creativity: 7,
            overall: 7,
          },
        },
      }),
      prisma.feedback.create({
        data: {
          submissionId: submissions[1].id,
          aiFeedback: `# Node.js API 서버 피드백

## 잘한 점
- Express.js 구조가 체계적으로 잘 구성되어 있습니다
- 미들웨어 사용이 적절합니다
- 코드가 깔끔하고 읽기 쉽습니다

## 개선할 점
- 에러 핸들링 미들웨어가 부족합니다
- 데이터베이스 연동 부분이 보이지 않습니다
- JWT 인증 구현이 누락되었습니다
- API 문서화(Swagger)가 없습니다

## 추가 구현 필요사항
- 입력값 유효성 검사
- 로깅 시스템
- 테스트 코드
- 환경 변수 관리

기본 구조는 좋으니 요구사항을 모두 구현해보세요!`,
          aiScore: {
            requirementsFulfillment: 5,
            codeQuality: 7,
            bestPractices: 6,
            creativity: 6,
            overall: 6,
          },
        },
      }),
      prisma.feedback.create({
        data: {
          submissionId: submissions[2].id,
          aiFeedback: `# JavaScript 기초 과제 피드백

## 잘한 점
- 기본 문법을 잘 이해하고 있습니다
- 코드 예시가 적절합니다

## 개선할 점
- ES6+ 문법 활용이 부족합니다
- 더 다양한 예제가 필요합니다

총평: 기초는 탄탄하니 더 고급 기능들을 학습해보세요.`,
          aiScore: {
            requirementsFulfillment: 8,
            codeQuality: 7,
            bestPractices: 6,
            creativity: 5,
            overall: 7,
          },
        },
      }),
    ]);

    console.log(`✅ Created ${feedbacks.length} feedbacks`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Users: ${users.length}`);
    console.log(`- Assignments: ${assignments.length}`);
    console.log(`- Submissions: ${submissions.length}`);
    console.log(`- Feedbacks: ${feedbacks.length}`);

    // Print assignment codes for testing
    console.log('\n🔑 Assignment Codes for Testing:');
    assignments.forEach((assignment, index) => {
      console.log(`${index + 1}. ${assignment.title}: ${assignment.assignmentCode}`);
    });

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });