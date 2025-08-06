import { Client } from 'discord.js';
import { Command } from '../types/Command';
import { logger } from './logger';
import path from 'path';
import fs from 'fs';

export async function loadCommands(client: Client): Promise<void> {
  const commandsPath = path.join(__dirname, '../commands');
  
  try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.ts') || file.endsWith('.js')
    );

    logger.info(`${commandFiles.length}개의 명령어 파일을 발견했습니다.`);

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      
      try {
        // Dynamic import for TypeScript files
        const commandModule = await import(filePath);
        const command: Command = commandModule.default || commandModule;

        if (!command || !command.data || !command.execute) {
          logger.warn(`명령어 파일 '${file}'이 올바른 형식이 아닙니다.`);
          continue;
        }

        // Validate command data
        if (!command.data.name) {
          logger.warn(`명령어 파일 '${file}'에 이름이 없습니다.`);
          continue;
        }

        client.commands.set(command.data.name, command);
        logger.info(`명령어 '${command.data.name}' 로드 완료`);

      } catch (error) {
        logger.error(`명령어 파일 '${file}' 로드 실패:`, error);
      }
    }

    logger.info(`총 ${client.commands.size}개의 명령어가 로드되었습니다.`);

  } catch (error) {
    logger.error('명령어 디렉토리를 읽는 중 오류 발생:', error);
    throw error;
  }
}

export function getCommandUsage(commandName: string): string {
  const usageMap: Record<string, string> = {
    submit: '/submit <과제코드> [GitHub링크] [내용] - 과제를 제출합니다',
    feedback: '/feedback <과제코드> - 과제 피드백을 확인합니다',
    status: '/status [과제코드] - 제출 상태를 확인합니다',
    assignments: '/assignments [페이지] - 과제 목록을 확인합니다',
    help: '/help [명령어] - 도움말을 표시합니다',
    profile: '/profile - 사용자 프로필을 확인합니다',
    ping: '/ping - 봇 응답 시간을 확인합니다',
  };

  return usageMap[commandName] || `/${commandName} - 사용법을 찾을 수 없습니다`;
}

export function formatCommandList(): string {
  return [
    '**📚 과제 관련 명령어**',
    '• `/submit <과제코드> [GitHub링크] [내용]` - 과제 제출',
    '• `/feedback <과제코드>` - 피드백 확인',
    '• `/status [과제코드]` - 제출 상태 확인',
    '• `/assignments [페이지]` - 과제 목록 보기',
    '',
    '**👤 사용자 관련 명령어**',
    '• `/profile` - 내 프로필 확인',
    '',
    '**🔧 유틸리티 명령어**',
    '• `/help [명령어]` - 도움말',
    '• `/ping` - 봇 상태 확인',
    '',
    '**💡 사용 팁**',
    '• 과제 코드는 6자리 영문 대문자와 숫자 조합입니다 (예: ABC123)',
    '• GitHub 링크는 공개 저장소여야 합니다',
    '• 피드백은 AI가 자동으로 생성되며, 보통 1-2분 정도 소요됩니다',
  ].join('\n');
}