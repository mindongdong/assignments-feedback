import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { validateAssignmentCode, logValidationError } from '../utils/validators';
import { createErrorEmbed, createSubmissionEmbed, createInfoEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('제출 상태를 확인합니다')
    .addStringOption(option =>
      option
        .setName('assignment_code')
        .setDescription('6자리 과제 코드 (생략시 모든 제출 상태 확인)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const assignmentCode = interaction.options.getString('assignment_code');
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Validate assignment code if provided
      if (assignmentCode) {
        const codeValidation = validateAssignmentCode(assignmentCode);
        if (!codeValidation.isValid) {
          logValidationError('status', 'assignment_code', codeValidation.error!, userId);
          await interaction.editReply({
            embeds: [createErrorEmbed('유효하지 않은 과제 코드', codeValidation.error!)],
          });
          return;
        }
      }

      // Get or create user
      const user = await apiClient.getOrCreateUser(userId, userName);

      // Get user's submissions
      const submissions = await apiClient.getUserSubmissions(
        user.id, 
        assignmentCode ? assignmentCode.toUpperCase() : undefined
      );

      if (submissions.length === 0) {
        const message = assignmentCode 
          ? `'${assignmentCode.toUpperCase()}' 과제에 대한 제출 내역이 없습니다.`
          : '제출한 과제가 없습니다.';
        
        await interaction.editReply({
          embeds: [createInfoEmbed('제출 내역 없음', message)],
        });
        return;
      }

      if (assignmentCode) {
        // Show detailed status for specific assignment
        const submission = submissions[0]; // Should be only one for specific assignment
        
        // Get assignment details
        let assignment;
        try {
          assignment = await apiClient.getAssignment(assignmentCode.toUpperCase());
        } catch (error: any) {
          logger.warn(`과제 조회 실패: ${assignmentCode}`, error);
          assignment = undefined;
        }

        const embed = createSubmissionEmbed(submission, assignment);
        
        // Add feedback status
        try {
          const feedbackList = await apiClient.getFeedback(submission.id);
          
          if (feedbackList.length > 0) {
            const latestFeedback = feedbackList.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            
            embed.addFields({
              name: '💬 최신 피드백',
              value: `점수: ${latestFeedback.score}/100\n생성 시간: ${formatDate(latestFeedback.created_at)}`,
              inline: false,
            });
          } else {
            embed.addFields({
              name: '💬 피드백 상태',
              value: '피드백이 아직 생성되지 않았습니다.',
              inline: false,
            });
          }
        } catch (feedbackError: any) {
          logger.warn(`피드백 조회 실패: ${submission.id}`, feedbackError);
          embed.addFields({
            name: '💬 피드백 상태',
            value: '피드백 상태를 확인할 수 없습니다.',
            inline: false,
          });
        }

        await interaction.editReply({
          embeds: [embed],
        });

      } else {
        // Show summary of all submissions
        const embed = createInfoEmbed('📋 내 제출 현황', `총 ${submissions.length}개의 과제를 제출했습니다.`);

        // Sort submissions by submission date (most recent first)
        const sortedSubmissions = submissions.sort((a, b) => 
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        );

        // Group submissions by status
        const statusGroups = sortedSubmissions.reduce((groups, sub) => {
          const status = sub.status;
          if (!groups[status]) groups[status] = [];
          groups[status].push(sub);
          return groups;
        }, {} as Record<string, typeof submissions>);

        // Add status summary
        const statusSummary = Object.entries(statusGroups).map(([status, subs]) => {
          const statusText = getStatusText(status);
          const emoji = getStatusEmoji(status);
          return `${emoji} ${statusText}: ${subs.length}개`;
        }).join('\n');

        embed.addFields({
          name: '📊 상태별 요약',
          value: statusSummary,
          inline: false,
        });

        // Add recent submissions (up to 5)
        const recentSubmissions = sortedSubmissions.slice(0, 5);
        const recentList = recentSubmissions.map(sub => {
          const emoji = getStatusEmoji(sub.status);
          const statusText = getStatusText(sub.status);
          return `${emoji} \`${sub.assignment_code}\` - ${statusText}\n${formatDate(sub.submitted_at)}`;
        }).join('\n\n');

        embed.addFields({
          name: '📝 최근 제출 내역',
          value: recentList,
          inline: false,
        });

        if (submissions.length > 5) {
          embed.addFields({
            name: '💡 더 자세한 정보',
            value: `특정 과제의 상세 상태를 보려면 \`/status <과제코드>\`를 사용하세요.`,
            inline: false,
          });
        }

        await interaction.editReply({
          embeds: [embed],
        });
      }

      logger.info(`status 명령어 실행 완료`, {
        userId,
        userName,
        assignmentCode: assignmentCode?.toUpperCase(),
        submissionCount: submissions.length,
      });

    } catch (error: any) {
      logger.error('status 명령어 실행 중 오류:', error);

      await interaction.editReply({
        embeds: [createErrorEmbed('상태 조회 실패', error.message || '제출 상태 조회 중 오류가 발생했습니다.')],
      });
    }
  },
} as Command;

// Helper functions
function getStatusText(status: string): string {
  switch (status) {
    case 'submitted': return '제출됨';
    case 'under_review': return '검토 중';
    case 'feedback_ready': return '피드백 준비됨';
    case 'completed': return '완료됨';
    default: return '알 수 없음';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'submitted': return '⏳';
    case 'under_review': return 'ℹ️';
    case 'feedback_ready': return '✅';
    case 'completed': return '🏆';
    default: return 'ℹ️';
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}