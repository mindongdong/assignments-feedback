/**
 * 테스트용 JWT 토큰 생성 스크립트
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT Secret 확인
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// 테스트용 사용자 정보
const testUsers = [
  {
    sub: '123456789012345678', // Discord ID (seed.ts와 동일)
    username: '김개발',
    role: 'student'
  },
  {
    sub: '456789012345678901', // Admin Discord ID 
    username: 'admin',
    role: 'admin'
  }
];

console.log('🔑 테스트용 JWT 토큰 생성 중...\n');

testUsers.forEach((user, index) => {
  const payload = {
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7일 유효
  };

  const token = jwt.sign(payload, JWT_SECRET);
  
  console.log(`👤 사용자 ${index + 1}: ${user.username} (${user.role})`);
  console.log('🎫 JWT 토큰:');
  console.log(token);
  console.log('\n📝 API 테스트용 Authorization 헤더:');
  console.log(`Authorization: Bearer ${token}`);
  console.log('\n' + '='.repeat(80) + '\n');
});

console.log('✅ JWT 토큰 생성 완료!');
console.log('💡 위 토큰을 API 테스트에 사용하세요.');