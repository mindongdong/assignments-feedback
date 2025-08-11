/**
 * 테스트용 assignment_code 생성 스크립트
 * 데이터베이스 권한 문제로 인해 직접 코드를 생성합니다.
 */

// Character set for assignment codes (excluding confusing characters)
const CHARSET = '0123456789ABCDEFGHIJKLMNPQRSTUVWXYZ'; // Excluded O, I for clarity
const CODE_LENGTH = 6;

/**
 * Generate a random 6-character alphanumeric assignment code
 */
function generateAssignmentCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    code += CHARSET[randomIndex];
  }
  return code;
}

console.log('🔑 테스트용 Assignment Codes 생성\n');

// 시드 데이터와 동일한 과제 생성 (4개)
const assignments = [
  {
    title: 'React.js 실습 과제: 독서 기록장 만들기',
    category: 'frontend',
    difficulty: 'MEDIUM',
    description: 'React.js를 활용하여 독서 기록장 웹 애플리케이션을 구현하는 과제'
  },
  {
    title: 'FastAPI + SQLAlchemy 실습 과제: 도서 관리 시스템 API 구축',
    category: 'backend', 
    difficulty: 'HARD',
    description: 'FastAPI와 SQLAlchemy를 사용하여 도서 관리 시스템 RESTful API를 구축하는 과제'
  },
  {
    title: 'CSS Grid 레이아웃 실습',
    category: 'frontend',
    difficulty: 'EASY',
    description: 'CSS Grid와 Flexbox를 조합하여 현대적인 웹 레이아웃을 구현'
  },
  {
    title: 'JavaScript 기초 문제 해결',
    category: 'frontend',
    difficulty: 'EASY',
    description: '기본적인 JavaScript 문제들을 해결하는 과제 (마감 지남)'
  }
];

// 각 과제에 대해 assignment_code 생성
assignments.forEach((assignment, index) => {
  const assignmentCode = generateAssignmentCode();
  console.log(`📝 과제 ${index + 1}:`);
  console.log(`   🔢 코드: ${assignmentCode}`);
  console.log(`   📋 제목: ${assignment.title}`);
  console.log(`   📂 카테고리: ${assignment.category}`);
  console.log(`   ⭐ 난이도: ${assignment.difficulty}`);
  console.log(`   📖 설명: ${assignment.description}`);
  console.log('');
  
  assignment.assignmentCode = assignmentCode;
});

console.log('🎨 프론트엔드 과제:');
const frontendAssignments = assignments.filter(a => a.category === 'frontend');
frontendAssignments.forEach(a => {
  console.log(`   • ${a.assignmentCode}: ${a.title}`);
});

console.log('\n⚙️ 백엔드 과제:');
const backendAssignments = assignments.filter(a => a.category === 'backend');
backendAssignments.forEach(a => {
  console.log(`   • ${a.assignmentCode}: ${a.title}`);
});

console.log('\n🚀 API 테스트용 assignment_code:');
if (frontendAssignments.length > 0) {
  console.log(`   프론트엔드: "${frontendAssignments[0].assignmentCode}"`);
}
if (backendAssignments.length > 0) {
  console.log(`   백엔드: "${backendAssignments[0].assignmentCode}"`);
}

console.log('\n💡 참고사항:');
console.log('- 위 코드들은 실제 데이터베이스에 저장되지 않았습니다');
console.log('- API 테스트 시 실제 데이터베이스의 assignment_code와 다를 수 있습니다');
console.log('- 데이터베이스 권한 문제 해결 후 npm run db:seed를 실행하여 실제 코드를 생성하세요');

// 특별히 backend_assignment.md와 frontend_assignment.md에 대응하는 코드 생성
console.log('\n📄 특정 문서 매핑용 assignment_code:');
console.log(`backend_assignment.md → ${backendAssignments[0]?.assignmentCode || generateAssignmentCode()}`);
console.log(`frontend_assignment.md → ${frontendAssignments[0]?.assignmentCode || generateAssignmentCode()}`);