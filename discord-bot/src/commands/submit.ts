import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { validateAssignmentCode, validateGitHubUrl, validateSubmissionContent, logValidationError } from '../utils/validators';
import { createSuccessEmbed, createErrorEmbed, createSubmissionEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('과제를 제출합니다')
    .addStringOption(option =>
      option
        .setName('assignment_code')
        .setDescription('6자리 과제 코드 (예: ABC123)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('github_link')
        .setDescription('GitHub 저장소 링크')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('content')
        .setDescription('제출 내용 (GitHub 링크가 없는 경우 필수)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const assignmentCode = interaction.options.getString('assignment_code', true);
      const githubLink = interaction.options.getString('github_link');
      const content = interaction.options.getString('content');
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Validate assignment code
      const codeValidation = validateAssignmentCode(assignmentCode);
      if (!codeValidation.isValid) {
        logValidationError('submit', 'assignment_code', codeValidation.error!, userId);
        await interaction.editReply({
          embeds: [createErrorEmbed('유효하지 않은 과제 코드', codeValidation.error!)],
        });
        return;
      }

      // Validate GitHub link if provided
      if (githubLink) {
        const urlValidation = validateGitHubUrl(githubLink);
        if (!urlValidation.isValid) {
          logValidationError('submit', 'github_link', urlValidation.error!, userId);
          await interaction.editReply({
            embeds: [createErrorEmbed('유효하지 않은 GitHub URL', urlValidation.error!)],
          });
          return;
        }
      }

      // Validate content if provided
      if (content) {
        const contentValidation = validateSubmissionContent(content);
        if (!contentValidation.isValid) {
          logValidationError('submit', 'content', contentValidation.error!, userId);
          await interaction.editReply({
            embeds: [createErrorEmbed('유효하지 않은 제출 내용', contentValidation.error!)],
          });
          return;
        }
      }

      // Check if either GitHub link or content is provided
      if (!githubLink && !content) {
        await interaction.editReply({
          embeds: [createErrorEmbed('제출 방법 오류', 'GitHub 링크 또는 제출 내용 중 하나는 반드시 제공해야 합니다.')],
        });
        return;
      }

      // Get or create user
      const user = await apiClient.getOrCreateUser(userId, userName);

      // Check if assignment exists
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

      // Check deadline
      const deadline = new Date(assignment.deadline);
      const now = new Date();
      if (deadline < now) {
        await interaction.editReply({
          embeds: [createErrorEmbed('마감일 초과', `이 과제의 마감일(${deadline.toLocaleString('ko-KR')})이 지났습니다.`)],
        });
        return;
      }

      // Create submission
      const submission = await apiClient.createSubmission(
        assignmentCode.toUpperCase(),
        user.id,
        githubLink || undefined,
        content || undefined
      );

      logger.info(`과제 제출 성공: ${assignmentCode.toUpperCase()}`, {
        userId,
        userName,
        submissionId: submission.id,
        hasGithubLink: !!githubLink,
        hasContent: !!content,
      });

      // Create success embed with submission details
      const embed = createSubmissionEmbed(submission, assignment);
      embed.setColor('#00ff00');
      embed.setTitle('✅ 과제 제출 완료');

      // Add next steps
      embed.addFields({
        name: '🔄 다음 단계',
        value: [
          '• AI 피드백이 자동으로 생성됩니다 (1-2분 소요)',
          '• `/feedback ' + assignmentCode.toUpperCase() + '` 명령어로 피드백을 확인하세요',
          '• `/status ' + assignmentCode.toUpperCase() + '` 명령어로 제출 상태를 확인하세요',
        ].join('\n'),
        inline: false,
      });

      await interaction.editReply({
        embeds: [embed],
      });

      // Try to request AI feedback immediately (non-blocking)
      try {
        await apiClient.requestFeedback(submission.id);
        logger.info(`AI 피드백 요청 완료: ${submission.id}`);
      } catch (feedbackError: any) {
        logger.warn(`AI 피드백 자동 요청 실패: ${submission.id}`, feedbackError);
        // Don't notify user about this error as the submission was successful
      }

    } catch (error: any) {
      logger.error('submit 명령어 실행 중 오류:', error);

      await interaction.editReply({
        embeds: [createErrorEmbed('제출 실패', error.message || '과제 제출 중 오류가 발생했습니다.')],
      });
    }
  },
} as Command;