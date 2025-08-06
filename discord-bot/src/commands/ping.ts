import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types/Command';
import { apiClient } from '../utils/apiClient';
import { createSuccessEmbed, createWarningEmbed, createInfoEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('봇의 응답 속도와 서버 상태를 확인합니다'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now();
    
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Calculate Discord API latency
      const discordLatency = Date.now() - startTime;
      
      // Check WebSocket heartbeat
      const wsLatency = interaction.client.ws.ping;

      // Test backend API connection
      const apiStartTime = Date.now();
      const isBackendHealthy = await apiClient.healthCheck();
      const apiLatency = Date.now() - apiStartTime;

      // Create status embed
      let embed;
      
      if (isBackendHealthy && discordLatency < 1000 && wsLatency < 500) {
        embed = createSuccessEmbed('🏓 Pong!', '모든 시스템이 정상 작동 중입니다.');
      } else if (!isBackendHealthy) {
        embed = createWarningEmbed('⚠️ 부분 서비스 장애', '백엔드 서버 연결에 문제가 있습니다.');
      } else {
        embed = createInfoEmbed('🏓 Pong!', '응답 속도가 다소 느릴 수 있습니다.');
      }

      // Add latency information
      embed.addFields({
        name: '📡 연결 상태',
        value: [
          `Discord API: ${discordLatency}ms`,
          `WebSocket: ${wsLatency}ms`,
          `백엔드 API: ${isBackendHealthy ? `${apiLatency}ms` : '연결 실패 ❌'}`,
        ].join('\n'),
        inline: true,
      });

      // Add performance interpretation
      const performance = [];
      if (discordLatency < 200) performance.push('✅ Discord 연결 우수');
      else if (discordLatency < 500) performance.push('⚠️ Discord 연결 보통');
      else performance.push('❌ Discord 연결 느림');

      if (wsLatency < 100) performance.push('✅ 실시간 연결 우수');
      else if (wsLatency < 300) performance.push('⚠️ 실시간 연결 보통');
      else performance.push('❌ 실시간 연결 느림');

      if (isBackendHealthy) {
        if (apiLatency < 500) performance.push('✅ 백엔드 응답 우수');
        else if (apiLatency < 1000) performance.push('⚠️ 백엔드 응답 보통');
        else performance.push('❌ 백엔드 응답 느림');
      } else {
        performance.push('❌ 백엔드 서버 오류');
      }

      embed.addFields({
        name: '📊 성능 상태',
        value: performance.join('\n'),
        inline: true,
      });

      // Add system information
      const systemInfo = [
        `서버 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        `메모리 사용량: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        `업타임: ${formatUptime(process.uptime())}`,
      ];

      embed.addFields({
        name: '🖥️ 시스템 정보',
        value: systemInfo.join('\n'),
        inline: false,
      });

      // Add troubleshooting tips if there are issues
      if (!isBackendHealthy || discordLatency > 1000) {
        embed.addFields({
          name: '🔧 문제 해결',
          value: [
            '• 잠시 후 다시 시도해보세요',
            '• 문제가 지속되면 관리자에게 문의하세요',
            '• 다른 명령어들이 느리게 작동할 수 있습니다',
          ].join('\n'),
          inline: false,
        });
      }

      await interaction.editReply({
        embeds: [embed],
      });

      logger.info('ping 명령어 실행 완료', {
        userId,
        userName,
        discordLatency,
        wsLatency,
        apiLatency,
        isBackendHealthy,
      });

    } catch (error: any) {
      logger.error('ping 명령어 실행 중 오류:', error);

      const errorEmbed = createWarningEmbed(
        '⚠️ 상태 확인 실패',
        '시스템 상태를 확인하는 중 오류가 발생했습니다.'
      );

      errorEmbed.addFields({
        name: '📡 기본 연결 상태',
        value: `Discord API: ${Date.now() - startTime}ms\nWebSocket: ${interaction.client.ws.ping}ms`,
        inline: false,
      });

      errorEmbed.addFields({
        name: '❌ 오류 정보',
        value: error.message || '알 수 없는 오류가 발생했습니다.',
        inline: false,
      });

      await interaction.editReply({
        embeds: [errorEmbed],
      });
    }
  },
} as Command;

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  if (minutes > 0) parts.push(`${minutes}분`);

  return parts.length > 0 ? parts.join(' ') : '1분 미만';
}