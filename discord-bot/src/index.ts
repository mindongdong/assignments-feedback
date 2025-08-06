import { Client, GatewayIntentBits, REST, Routes, Collection } from 'discord.js';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { loadCommands } from './utils/commandLoader';
import { loadEvents } from './utils/eventLoader';
import { Command } from './types/Command';

// Load environment variables
config({ path: '../backend/.env' });

// Extend Client to include commands collection
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

class DiscordBot {
  private client: Client;
  private rest: REST;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    this.client.commands = new Collection();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Discord bot 초기화 시작...');

      // Load commands and events
      await loadCommands(this.client);
      await loadEvents(this.client);

      // Deploy slash commands
      await this.deployCommands();

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);
      
      logger.info('Discord bot이 성공적으로 시작되었습니다!');
    } catch (error) {
      logger.error('Discord bot 초기화 실패:', error);
      process.exit(1);
    }
  }

  private async deployCommands(): Promise<void> {
    try {
      logger.info('슬래시 명령어 등록 시작...');

      const commands = Array.from(this.client.commands.values()).map(command => command.data.toJSON());

      const data = await this.rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.DISCORD_GUILD_ID!),
        { body: commands }
      );

      logger.info(`${(data as any[]).length}개의 슬래시 명령어가 성공적으로 등록되었습니다.`);
    } catch (error) {
      logger.error('슬래시 명령어 등록 실패:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Discord bot 종료 중...');
    this.client.destroy();
    logger.info('Discord bot이 종료되었습니다.');
  }
}

// Initialize bot
const bot = new DiscordBot();

// Handle process termination gracefully
process.on('SIGINT', async () => {
  logger.info('SIGINT 신호를 받았습니다. 정상 종료 중...');
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM 신호를 받았습니다. 정상 종료 중...');
  await bot.shutdown();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 예외:', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외:', error);
  process.exit(1);
});

// Start the bot
bot.initialize();