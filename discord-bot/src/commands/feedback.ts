import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { validateAssignmentCode, logValidationError } from '../utils/validators';
import { createSuccessEmbed, createErrorEmbed, createFeedbackEmbed, createInfoEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('과제 피드백을 확인합니다')
    .addStringOption(option =>
      option
        .setName('assignment_code')
        .setDescription('6자리 과제 코드 (예: ABC123)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const assignmentCode = interaction.options.getString('assignment_code', true);
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Validate assignment code
      const codeValidation = validateAssignmentCode(assignmentCode);
      if (!codeValidation.isValid) {
        logValidationError('feedback', 'assignment_code', codeValidation.error!, userId);
        await interaction.editReply({
          embeds: [createErrorEmbed('유효하지 않은 과제 코드', codeValidation.error!)],
        });
        return;
      }

      // Get or create user
      const user = await apiClient.getOrCreateUser(userId, userName);

      // Get assignment details
      let assignment;
      try {
        assignment = await apiClient.getAssignment(assignmentCode.toUpperCase());
      } catch (error: any) {
        logger.error(`과제 조회 실패: ${assignmentCode}`, error);
        await interaction.editReply({
          embeds: [createErrorEmbed('과제를 찾을 수 없음', `과제 코드 '${assignmentCode.toUpperCase()}'에 해당하는 과제가 없습니다.`)],
        });
        return;
      }

      // Get user's submissions for this assignment
      const submissions = await apiClient.getUserSubmissions(user.id, assignmentCode.toUpperCase());

      if (submissions.length === 0) {
        await interaction.editReply({
          embeds: [createInfoEmbed(
            '제출 내역 없음',
            `'${assignmentCode.toUpperCase()}' 과제에 대한 제출 내역이 없습니다.\n\n` +
            `먼저 \`/submit ${assignmentCode.toUpperCase()}\` 명령어로 과제를 제출해주세요.`
          )],
        });
        return;
      }

      // Get the most recent submission
      const latestSubmission = submissions.sort((a, b) => 
        new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )[0];

      // Get feedback for the submission
      let feedbackList;
      try {
        feedbackList = await apiClient.getFeedback(latestSubmission.id);
      } catch (error: any) {
        logger.error(`피드백 조회 실패: ${latestSubmission.id}`, error);
        await interaction.editReply({
          embeds: [createErrorEmbed('피드백 조회 실패', '피드백을 가져오는 중 오류가 발생했습니다.')],
        });
        return;
      }

      if (feedbackList.length === 0) {
        // No feedback available yet
        const embed = createInfoEmbed(
          '피드백 준비 중',
          `'${assignment.title}' 과제에 대한 피드백이 아직 준비되지 않았습니다.`
        );

        embed.addFields({
          name: '📋 제출 상태',
          value: `상태: ${getStatusText(latestSubmission.status)}\n제출 시간: ${formatDate(latestSubmission.submitted_at)}`,
          inline: false,
        });

        // Check if we can request feedback
        if (latestSubmission.status === 'submitted') {
          embed.addFields({
            name: '🔄 피드백 생성',
            value: 'AI 피드백을 생성하고 있습니다. 보통 1-2분 정도 소요됩니다.\n잠시 후 다시 확인해주세요.',
            inline: false,
          });

          // Try to request feedback if not already in progress
          try {
            await apiClient.requestFeedback(latestSubmission.id);
            logger.info(`피드백 요청 완료: ${latestSubmission.id}`);
          } catch (requestError: any) {
            logger.warn(`피드백 요청 실패: ${latestSubmission.id}`, requestError);
          }
        }

        await interaction.editReply({
          embeds: [embed],
        });
        return;
      }

      // Get the most recent feedback
      const latestFeedback = feedbackList.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      logger.info(`피드백 조회 성공: ${assignmentCode.toUpperCase()}`, {
        userId,
        userName,
        submissionId: latestSubmission.id,
        feedbackId: latestFeedback.id,
        score: latestFeedback.score,
      });

      // Create feedback embed
      const embed = createFeedbackEmbed(latestFeedback, assignment);

      // Add submission info
      embed.addFields({
        name: '📝 제출 정보',
        value: `제출 시간: ${formatDate(latestSubmission.submitted_at)}\n상태: ${getStatusText(latestSubmission.status)}`,
        inline: false,
      });

      await interaction.editReply({
        embeds: [embed],
      });

    } catch (error: any) {
      logger.error('feedback 명령어 실행 중 오류:', error);

      await interaction.editReply({
        embeds: [createErrorEmbed('피드백 조회 실패', error.message || '피드백 조회 중 오류가 발생했습니다.')],
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