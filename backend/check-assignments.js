/**
 * 현재 데이터베이스의 과제 코드 확인 스크립트
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkAssignments() {
  try {
    console.log('📚 현재 등록된 과제 목록 조회 중...\n');

    const assignments = await prisma.assignment.findMany({
      select: {
        assignmentCode: true,
        title: true,
        category: true,
        difficulty: true,
        isActive: true,
        deadline: true,
        description: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (assignments.length === 0) {
      console.log('❌ 등록된 과제가 없습니다.');
      console.log('💡 먼저 시드 데이터를 실행하세요: npm run db:seed');
      return;
    }

    console.log(`✅ 총 ${assignments.length}개 과제가 등록되어 있습니다.\n`);

    assignments.forEach((assignment, index) => {
      console.log(`📝 과제 ${index + 1}:`);
      console.log(`   🔢 코드: ${assignment.assignmentCode}`);
      console.log(`   📋 제목: ${assignment.title}`);
      console.log(`   📂 카테고리: ${assignment.category}`);
      console.log(`   ⭐ 난이도: ${assignment.difficulty}`);
      console.log(`   🟢 활성화: ${assignment.isActive ? 'YES' : 'NO'}`);
      console.log(`   ⏰ 마감일: ${assignment.deadline.toLocaleDateString('ko-KR')}`);
      
      // 설명 미리보기
      const preview = assignment.description.substring(0, 80).replace(/\n/g, ' ');
      console.log(`   📖 설명: ${preview}...`);
      console.log('');
    });

    // 프론트엔드와 백엔드 과제 필터링
    const frontendAssignments = assignments.filter(a => a.category === 'frontend');
    const backendAssignments = assignments.filter(a => a.category === 'backend');

    console.log('🎨 프론트엔드 과제:');
    frontendAssignments.forEach(a => {
      console.log(`   • ${a.assignmentCode}: ${a.title}`);
    });

    console.log('\n⚙️ 백엔드 과제:');
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

  } catch (error) {
    console.error('❌ 데이터베이스 조회 오류:', error.message);
    
    if (error.code === 'P2021') {
      console.log('💡 테이블이 존재하지 않습니다. 마이그레이션을 실행하세요:');
      console.log('   npm run migrate');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkAssignments();