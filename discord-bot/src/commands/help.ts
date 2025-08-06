import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { createInfoEmbed } from '../utils/embeds';
import { getCommandUsage, formatCommandList } from '../utils/commandLoader';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('도움말을 표시합니다')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('특정 명령어의 도움말을 확인합니다')
        .setRequired(false)
        .addChoices(
          { name: 'submit', value: 'submit' },
          { name: 'feedback', value: 'feedback' },
          { name: 'status', value: 'status' },
          { name: 'assignments', value: 'assignments' },
          { name: 'profile', value: 'profile' },
          { name: 'ping', value: 'ping' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const specificCommand = interaction.options.getString('command');
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    try {
      if (specificCommand) {
        // Show help for specific command
        const embed = createInfoEmbed(`명령어 도움말: /${specificCommand}`, getDetailedCommandHelp(specificCommand));
        
        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });

        logger.info(`help 명령어 실행 (특정): ${specificCommand}`, {
          userId,
          userName,
        });

      } else {
        // Show general help
        const embed = createInfoEmbed('🤖 과제 피드백 봇 도움말', '과제 제출과 AI 피드백을 관리하는 Discord 봇입니다.');
        
        embed.setDescription(formatCommandList());
        
        embed.addFields({
          name: '🔗 추가 정보',
          value: [
            '• 특정 명령어 도움말: `/help <명령어>`',
            '• 봇 상태 확인: `/ping`',
            '• 문제 발생시 관리자에게 문의하세요',
          ].join('\n'),
          inline: false,
        });

        embed.setFooter({ text: 'Made with ❤️ for better learning experience' });

        await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });

        logger.info(`help 명령어 실행 (일반)`, {
          userId,
          userName,
        });
      }

    } catch (error: any) {
      logger.error('help 명령어 실행 중 오류:', error);

      await interaction.reply({
        content: '❌ 도움말을 표시하는 중 오류가 발생했습니다.',
        ephemeral: true,
      });
    }
  },
} as Command;

function getDetailedCommandHelp(commandName: string): string {
  const helpTexts: Record<string, string> = {
    submit: [
      '**📝 과제 제출 명령어**',
      '',
      '**사용법:**',
      '`/submit <과제코드> [GitHub링크] [내용]`',
      '',
      '**매개변수:**',
      '• `과제코드` (필수): 6자리 영문 대문자와 숫자 조합 (예: ABC123)',
      '• `GitHub링크` (선택): GitHub 저장소 공개 링크', 
      '• `내용` (선택): 직접 입력하는 제출 내용',
      '',
      '**참고사항:**',
      '• GitHub 링크 또는 내용 중 하나는 반드시 필요합니다',
      '• 마감일이 지난 과제는 제출할 수 없습니다',
      '• 제출 후 자동으로 AI 피드백이 생성됩니다',
      '',
      '**예시:**',
      '`/submit ABC123 https://github.com/user/repo`',
      '`/submit ABC123 content:코드를 여기에 붙여넣기`',
    ].join('\n'),

    feedback: [
      '**💬 피드백 확인 명령어**',
      '',
      '**사용법:**',
      '`/feedback <과제코드>`',
      '',
      '**매개변수:**',
      '• `과제코드` (필수): 피드백을 확인할 과제의 6자리 코드',
      '',
      '**기능:**',
      '• AI가 생성한 자동 피드백을 확인합니다',
      '• 점수, 잘한 점, 개선사항, 추천사항을 제공합니다',
      '• 학습 자료와 한국 개발 문화에 맞는 조언도 포함됩니다',
      '',
      '**참고사항:**',
      '• 과제를 먼저 제출해야 피드백을 받을 수 있습니다',
      '• 피드백 생성은 보통 1-2분 정도 소요됩니다',
      '',
      '**예시:**',
      '`/feedback ABC123`',
    ].join('\n'),

    status: [
      '**📋 제출 상태 확인 명령어**',
      '',
      '**사용법:**',
      '`/status [과제코드]`',
      '',
      '**매개변수:**',
      '• `과제코드` (선택): 특정 과제의 상태만 확인',
      '',
      '**기능:**',
      '• 과제코드를 지정하면: 해당 과제의 상세 상태',
      '• 과제코드를 생략하면: 모든 제출 과제의 요약',
      '',
      '**상태 유형:**',
      '• ⏳ 제출됨: 제출 완료, 피드백 대기 중',
      '• ℹ️ 검토 중: AI가 피드백을 생성 중',
      '• ✅ 피드백 준비됨: 피드백 확인 가능',
      '• 🏆 완료됨: 모든 과정 완료',
      '',
      '**예시:**',
      '`/status ABC123` (특정 과제)',
      '`/status` (전체 요약)',
    ].join('\n'),

    assignments: [
      '**📚 과제 목록 확인 명령어**',
      '',
      '**사용법:**',
      '`/assignments [페이지]`',
      '',
      '**매개변수:**',
      '• `페이지` (선택): 페이지 번호 (기본값: 1)',
      '',
      '**기능:**',
      '• 등록된 모든 과제의 목록을 확인합니다',
      '• 과제 코드, 제목, 마감일을 표시합니다',
      '• 한 페이지에 10개씩 표시됩니다',
      '',
      '**참고사항:**',
      '• 📅 진행중: 아직 마감되지 않은 과제',
      '• ⏰ 마감: 마감일이 지난 과제',
      '',
      '**예시:**',
      '`/assignments` (첫 페이지)',
      '`/assignments 2` (2페이지)',
    ].join('\n'),

    profile: [
      '**👤 사용자 프로필 명령어**',
      '',
      '**사용법:**',
      '`/profile`',
      '',
      '**기능:**',
      '• 현재 사용자의 프로필 정보를 확인합니다',
      '• 이름, 역할, 가입일 등을 표시합니다',
      '• 학번이나 이메일이 있으면 함께 표시됩니다',
      '',
      '**참고사항:**',
      '• 처음 명령어 사용시 자동으로 계정이 생성됩니다',
      '• 프로필 정보 수정은 관리자에게 문의하세요',
    ].join('\n'),

    ping: [
      '**🏓 봇 상태 확인 명령어**',
      '',
      '**사용법:**',
      '`/ping`',
      '',
      '**기능:**',
      '• 봇의 응답 속도를 확인합니다',
      '• 서버와의 연결 상태를 테스트합니다',
      '• 백엔드 API 서버 상태도 함께 확인합니다',
      '',
      '**참고사항:**',
      '• 응답 시간이 너무 길면 관리자에게 문의하세요',
      '• 서버 문제가 있을 때 진단 용도로 사용하세요',
    ].join('\n'),
  };

  return helpTexts[commandName] || `'${commandName}' 명령어에 대한 도움말을 찾을 수 없습니다.`;
}