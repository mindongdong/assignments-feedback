import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { createErrorEmbed, createUserProfileEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('사용자 프로필을 확인합니다'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Get or create user
      const user = await apiClient.getOrCreateUser(userId, userName);

      // Get user's submission statistics
      const submissions = await apiClient.getUserSubmissions(user.id);

      // Create profile embed
      const embed = createUserProfileEmbed(user);

      // Add submission statistics
      if (submissions.length > 0) {
        const statusCounts = submissions.reduce((counts, sub) => {
          counts[sub.status] = (counts[sub.status] || 0) + 1;
          return counts;
        }, {} as Record<string, number>);

        const stats = [];
        stats.push(`총 제출: ${submissions.length}개`);
        
        if (statusCounts.completed) {
          stats.push(`완료: ${statusCounts.completed}개`);
        }
        if (statusCounts.feedback_ready) {
          stats.push(`피드백 준비: ${statusCounts.feedback_ready}개`);
        }
        if (statusCounts.under_review) {
          stats.push(`검토 중: ${statusCounts.under_review}개`);
        }
        if (statusCounts.submitted) {
          stats.push(`제출됨: ${statusCounts.submitted}개`);
        }

        embed.addFields({
          name: '📊 제출 통계',
          value: stats.join('\n'),
          inline: false,
        });

        // Add recent activity
        const recentSubmissions = submissions
          .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
          .slice(0, 3);

        if (recentSubmissions.length > 0) {
          const recentActivity = recentSubmissions.map(sub => {
            const date = new Date(sub.submitted_at).toLocaleDateString('ko-KR');
            const status = getStatusText(sub.status);
            return `• \`${sub.assignment_code}\` - ${status} (${date})`;
          }).join('\n');

          embed.addFields({
            name: '🕐 최근 활동',
            value: recentActivity,
            inline: false,
          });
        }

        // Calculate and show average performance if feedback exists
        try {
          const feedbackPromises = submissions.map(sub => 
            apiClient.getFeedback(sub.id).catch(() => [])
          );
          
          const allFeedback = (await Promise.all(feedbackPromises)).flat();
          
          if (allFeedback.length > 0) {
            const scores = allFeedback.map(f => f.score);
            const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            const maxScore = Math.max(...scores);
            
            embed.addFields({
              name: '🎯 성과 지표',
              value: `평균 점수: ${averageScore.toFixed(1)}/100\n최고 점수: ${maxScore}/100\n피드백 받은 과제: ${allFeedback.length}개`,
              inline: false,
            });
          }
        } catch (error) {
          logger.warn(`사용자 ${userId}의 피드백 통계 조회 실패:`, error);
        }

      } else {
        embed.addFields({
          name: '📊 제출 통계',
          value: '아직 제출한 과제가 없습니다.\n`/assignments` 명령어로 과제 목록을 확인하세요!',
          inline: false,
        });
      }

      // Add useful links and tips
      embed.addFields({
        name: '💡 유용한 명령어',
        value: [
          '• `/assignments` - 과제 목록 보기',
          '• `/status` - 내 제출 현황',
          '• `/help` - 도움말',
        ].join('\n'),
        inline: false,
      });

      await interaction.editReply({
        embeds: [embed],
      });

      logger.info(`profile 명령어 실행 완료`, {
        userId,
        userName,
        submissionCount: submissions.length,
        userRole: user.role,
      });

    } catch (error: any) {
      logger.error('profile 명령어 실행 중 오류:', error);

      await interaction.editReply({
        embeds: [createErrorEmbed('프로필 조회 실패', error.message || '프로필 정보를 가져오는 중 오류가 발생했습니다.')],
      });
    }
  },
} as Command;

// Helper function
function getStatusText(status: string): string {
  switch (status) {
    case 'submitted': return '제출됨';
    case 'under_review': return '검토 중';
    case 'feedback_ready': return '피드백 준비됨';
    case 'completed': return '완료됨';
    default: return '알 수 없음';
  }
}