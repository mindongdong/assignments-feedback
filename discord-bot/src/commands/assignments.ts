import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { validatePageNumber, logValidationError } from '../utils/validators';
import { createErrorEmbed, createAssignmentsListEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('assignments')
    .setDescription('과제 목록을 확인합니다')
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('페이지 번호 (기본값: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    try {
      const pageInput = interaction.options.getInteger('page') || 1;
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Validate page number
      const pageValidation = validatePageNumber(pageInput);
      if (!pageValidation.isValid) {
        logValidationError('assignments', 'page', pageValidation.error!, userId);
        await interaction.editReply({
          embeds: [createErrorEmbed('유효하지 않은 페이지 번호', pageValidation.error!)],
        });
        return;
      }

      const page = pageValidation.value!;
      const limit = 10; // Show 10 assignments per page

      // Get or create user (for potential future role-based filtering)
      const user = await apiClient.getOrCreateUser(userId, userName);

      // Get assignments
      const { assignments, total } = await apiClient.getAssignments(page, limit);
      const totalPages = Math.ceil(total / limit);

      if (assignments.length === 0) {
        if (page === 1) {
          await interaction.editReply({
            embeds: [createErrorEmbed('과제 없음', '등록된 과제가 없습니다.')],
          });
        } else {
          await interaction.editReply({
            embeds: [createErrorEmbed('페이지 없음', `페이지 ${page}에 표시할 과제가 없습니다.\n최대 페이지: ${totalPages}`)],
          });
        }
        return;
      }

      // Create assignments list embed
      const embed = createAssignmentsListEmbed(assignments, page, totalPages);

      // Add navigation info if there are multiple pages
      if (totalPages > 1) {
        const navigationInfo = [];
        
        if (page > 1) {
          navigationInfo.push(`이전 페이지: \`/assignments ${page - 1}\``);
        }
        
        if (page < totalPages) {
          navigationInfo.push(`다음 페이지: \`/assignments ${page + 1}\``);
        }

        if (navigationInfo.length > 0) {
          embed.addFields({
            name: '🔄 페이지 이동',
            value: navigationInfo.join('\n'),
            inline: false,
          });
        }
      }

      // Add usage tips
      embed.addFields({
        name: '💡 사용 팁',
        value: [
          '• 특정 과제 상세보기: `/submit <과제코드>`에서 과제코드를 확인하세요',
          '• 과제 제출: `/submit <과제코드> <GitHub링크>`',
          '• 피드백 확인: `/feedback <과제코드>`',
        ].join('\n'),
        inline: false,
      });

      await interaction.editReply({
        embeds: [embed],
      });

      logger.info(`assignments 명령어 실행 완료`, {
        userId,
        userName,
        page,
        totalPages,
        assignmentCount: assignments.length,
        totalAssignments: total,
      });

    } catch (error: any) {
      logger.error('assignments 명령어 실행 중 오류:', error);

      await interaction.editReply({
        embeds: [createErrorEmbed('과제 목록 조회 실패', error.message || '과제 목록을 가져오는 중 오류가 발생했습니다.')],
      });
    }
  },
} as Command;