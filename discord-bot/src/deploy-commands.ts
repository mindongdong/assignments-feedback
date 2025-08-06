import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '../backend/.env' });

interface Command {
  data: {
    toJSON(): any;
    name: string;
  };
}

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.ts') || file.endsWith('.js')
  );

  console.log(`📂 ${commandFiles.length}개의 명령어 파일을 발견했습니다.`);

  // Load all commands
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const commandModule = await import(filePath);
      const command: Command = commandModule.default || commandModule;

      if (command?.data?.name) {
        commands.push(command.data.toJSON());
        console.log(`✅ 명령어 '${command.data.name}' 로드 완료`);
      } else {
        console.warn(`⚠️  명령어 파일 '${file}'이 올바른 형식이 아닙니다.`);
      }
    } catch (error) {
      console.error(`❌ 명령어 파일 '${file}' 로드 실패:`, error);
    }
  }

  if (commands.length === 0) {
    console.error('❌ 등록할 명령어가 없습니다.');
    process.exit(1);
  }

  // Validate environment variables
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token) {
    console.error('❌ DISCORD_TOKEN이 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!clientId) {
    console.error('❌ DISCORD_CLIENT_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  if (!guildId) {
    console.error('❌ DISCORD_GUILD_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🚀 ${commands.length}개의 슬래시 명령어 등록을 시작합니다...`);

    // Register commands for specific guild (faster for development)
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log(`✅ ${(data as any[]).length}개의 슬래시 명령어가 성공적으로 등록되었습니다!`);

    // Log registered commands
    commands.forEach(command => {
      console.log(`   • /${command.name} - ${command.description}`);
    });

  } catch (error) {
    console.error('❌ 슬래시 명령어 등록 실패:', error);
    process.exit(1);
  }
}

// For global commands (use with caution, takes up to 1 hour to update)
async function deployGlobalCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.ts') || file.endsWith('.js')
  );

  // Load all commands
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const commandModule = await import(filePath);
      const command: Command = commandModule.default || commandModule;

      if (command?.data?.name) {
        commands.push(command.data.toJSON());
      }
    } catch (error) {
      console.error(`❌ 명령어 파일 '${file}' 로드 실패:`, error);
    }
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    console.error('❌ DISCORD_TOKEN 또는 DISCORD_CLIENT_ID가 설정되지 않았습니다.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`🌍 ${commands.length}개의 글로벌 슬래시 명령어 등록을 시작합니다...`);
    console.log('⚠️  글로벌 명령어는 업데이트에 최대 1시간이 소요될 수 있습니다.');

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(`✅ ${(data as any[]).length}개의 글로벌 슬래시 명령어가 성공적으로 등록되었습니다!`);

  } catch (error) {
    console.error('❌ 글로벌 슬래시 명령어 등록 실패:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const isGlobal = args.includes('--global');

if (isGlobal) {
  console.log('🌍 글로벌 명령어 등록 모드');
  deployGlobalCommands();
} else {
  console.log('🏠 길드 명령어 등록 모드 (개발용)');
  deployCommands();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  명령어 등록이 중단되었습니다.');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ 처리되지 않은 Promise 예외:', error);
  process.exit(1);
});