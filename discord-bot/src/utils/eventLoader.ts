import { Client } from 'discord.js';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

export async function loadEvents(client: Client): Promise<void> {
  const eventsPath = path.join(__dirname, '../events');
  
  try {
    // Check if events directory exists
    if (!fs.existsSync(eventsPath)) {
      logger.info('이벤트 디렉토리가 없습니다. 기본 이벤트만 등록합니다.');
      registerDefaultEvents(client);
      return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => 
      file.endsWith('.ts') || file.endsWith('.js')
    );

    if (eventFiles.length === 0) {
      logger.info('이벤트 파일이 없습니다. 기본 이벤트만 등록합니다.');
      registerDefaultEvents(client);
      return;
    }

    logger.info(`${eventFiles.length}개의 이벤트 파일을 발견했습니다.`);

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      
      try {
        // Dynamic import for TypeScript files
        const eventModule = await import(filePath);
        const event = eventModule.default || eventModule;

        if (!event || !event.name || !event.execute) {
          logger.warn(`이벤트 파일 '${file}'이 올바른 형식이 아닙니다.`);
          continue;
        }

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args, client));
        } else {
          client.on(event.name, (...args) => event.execute(...args, client));
        }

        logger.info(`이벤트 '${event.name}' 등록 완료`);

      } catch (error) {
        logger.error(`이벤트 파일 '${file}' 로드 실패:`, error);
      }
    }

    // Also register default events
    registerDefaultEvents(client);

  } catch (error) {
    logger.error('이벤트 디렉토리를 읽는 중 오류 발생:', error);
    // Fallback to default events
    registerDefaultEvents(client);
  }
}

function registerDefaultEvents(client: Client): void {
  // Ready event
  client.once('ready', () => {
    logger.info(`Discord bot '${client.user?.tag}'가 준비되었습니다!`);
    logger.info(`${client.guilds.cache.size}개의 서버에 연결되었습니다.`);
    
    // Set bot status
    client.user?.setActivity('과제 피드백 시스템', { type: 3 }); // Watching
  });

  // Interaction create event (for slash commands)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`알 수 없는 명령어: ${interaction.commandName}`);
      return;
    }

    // Check if command requires admin permissions
    if (command.adminOnly && !interaction.memberPermissions?.has('Administrator')) {
      await interaction.reply({
        content: '❌ 이 명령어는 관리자만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    try {
      logger.info(`명령어 실행: ${interaction.commandName}`, {
        user: interaction.user.tag,
        guild: interaction.guild?.name,
        channel: interaction.channel?.id,
      });

      await command.execute(interaction);

    } catch (error) {
      logger.error(`명령어 '${interaction.commandName}' 실행 중 오류:`, error);

      const errorMessage = '❌ 명령어 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: errorMessage,
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error('오류 응답 전송 실패:', replyError);
      }
    }
  });

  // Error handling
  client.on('error', (error) => {
    logger.error('Discord 클라이언트 오류:', error);
  });

  client.on('warn', (warning) => {
    logger.warn('Discord 클라이언트 경고:', warning);
  });

  // Guild events for logging
  client.on('guildCreate', (guild) => {
    logger.info(`새 서버에 추가됨: ${guild.name} (${guild.id})`);
  });

  client.on('guildDelete', (guild) => {
    logger.info(`서버에서 제거됨: ${guild.name} (${guild.id})`);
  });

  logger.info('기본 이벤트 등록 완료');
}