import { EmbedBuilder, ColorResolvable } from 'discord.js';
import { Assignment, Submission, Feedback, User } from '../types/Command';

// Color constants
export const COLORS = {
  SUCCESS: '#00ff00' as ColorResolvable,
  ERROR: '#ff0000' as ColorResolvable,
  WARNING: '#ffff00' as ColorResolvable,
  INFO: '#0099ff' as ColorResolvable,
  PENDING: '#ffa500' as ColorResolvable,
  PRIMARY: '#5865f2' as ColorResolvable,
} as const;

// Status emojis
export const EMOJIS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  PENDING: '⏳',
  ASSIGNMENT: '📚',
  SUBMISSION: '📝',
  FEEDBACK: '💬',
  USER: '👤',
  CODE: '💻',
  GITHUB: '<:github:123456789>', // Replace with actual GitHub emoji ID
  CLOCK: '🕐',
  CALENDAR: '📅',
  STAR: '⭐',
  TROPHY: '🏆',
  BOOK: '📖',
  LIGHTBULB: '💡',
  GEAR: '⚙️',
  CHART: '📊',
} as const;

/**
 * Create a success embed
 */
export function createSuccessEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.SUCCESS} ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create an error embed
 */
export function createErrorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle(`${EMOJIS.ERROR} ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create a warning embed
 */
export function createWarningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle(`${EMOJIS.WARNING} ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create an info embed
 */
export function createInfoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.INFO} ${title}`)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  return embed;
}

/**
 * Create an assignment details embed
 */
export function createAssignmentEmbed(assignment: Assignment): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${EMOJIS.ASSIGNMENT} ${assignment.title}`)
    .setDescription(assignment.description)
    .addFields(
      {
        name: `${EMOJIS.CODE} 과제 코드`,
        value: `\`${assignment.assignment_code}\``,
        inline: true,
      },
      {
        name: `${EMOJIS.CALENDAR} 마감일`,
        value: formatDate(assignment.deadline),
        inline: true,
      }
    )
    .setTimestamp();

  // Add requirements field if available
  if (assignment.requirements && assignment.requirements.length > 0) {
    embed.addFields({
      name: `${EMOJIS.BOOK} 요구사항`,
      value: assignment.requirements.map(req => `• ${req}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add recommendations if available
  if (assignment.recommendations && assignment.recommendations.length > 0) {
    embed.addFields({
      name: `${EMOJIS.LIGHTBULB} 권장사항`,
      value: assignment.recommendations.map(rec => `• ${rec}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add metadata if available
  if (assignment.category || assignment.difficulty_level || assignment.estimated_hours) {
    const metadata = [];
    if (assignment.category) metadata.push(`카테고리: ${assignment.category}`);
    if (assignment.difficulty_level) metadata.push(`난이도: ${assignment.difficulty_level}`);
    if (assignment.estimated_hours) metadata.push(`예상 시간: ${assignment.estimated_hours}시간`);
    
    embed.addFields({
      name: `${EMOJIS.GEAR} 상세 정보`,
      value: metadata.join(' • '),
      inline: false,
    });
  }

  return embed;
}

/**
 * Create a submission status embed
 */
export function createSubmissionEmbed(submission: Submission, assignment?: Assignment): EmbedBuilder {
  const statusEmoji = getStatusEmoji(submission.status);
  const statusText = getStatusText(submission.status);

  const embed = new EmbedBuilder()
    .setColor(getStatusColor(submission.status))
    .setTitle(`${EMOJIS.SUBMISSION} 제출 상태`)
    .addFields(
      {
        name: `${EMOJIS.CODE} 과제 코드`,
        value: `\`${submission.assignment_code}\``,
        inline: true,
      },
      {
        name: `${statusEmoji} 상태`,
        value: statusText,
        inline: true,
      },
      {
        name: `${EMOJIS.CLOCK} 제출 시간`,
        value: formatDate(submission.submitted_at),
        inline: true,
      }
    )
    .setTimestamp();

  // Add assignment title if available
  if (assignment) {
    embed.setDescription(`**${assignment.title}**`);
  }

  // Add GitHub link if available
  if (submission.github_link) {
    embed.addFields({
      name: `${EMOJIS.GITHUB} GitHub 링크`,
      value: `[저장소 보기](${submission.github_link})`,
      inline: false,
    });
  }

  // Add metadata if available
  if (submission.metadata) {
    const metadata = [];
    if (submission.metadata.file_count) metadata.push(`파일 수: ${submission.metadata.file_count}`);
    if (submission.metadata.languages) metadata.push(`언어: ${submission.metadata.languages.join(', ')}`);
    
    if (metadata.length > 0) {
      embed.addFields({
        name: `${EMOJIS.CHART} 분석 정보`,
        value: metadata.join(' • '),
        inline: false,
      });
    }
  }

  return embed;
}

/**
 * Create a feedback embed
 */
export function createFeedbackEmbed(feedback: Feedback, assignment?: Assignment): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getScoreColor(feedback.score))
    .setTitle(`${EMOJIS.FEEDBACK} AI 피드백`)
    .addFields(
      {
        name: `${EMOJIS.STAR} 점수`,
        value: `${feedback.score}/100`,
        inline: true,
      },
      {
        name: `${EMOJIS.CLOCK} 생성 시간`,
        value: formatDate(feedback.created_at),
        inline: true,
      }
    )
    .setTimestamp();

  // Add assignment title if available
  if (assignment) {
    embed.setDescription(`**${assignment.title}**에 대한 피드백`);
  }

  // Add strengths
  if (feedback.strengths && feedback.strengths.length > 0) {
    embed.addFields({
      name: `${EMOJIS.SUCCESS} 잘한 점`,
      value: feedback.strengths.map(strength => `• ${strength}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add improvements
  if (feedback.improvements && feedback.improvements.length > 0) {
    embed.addFields({
      name: `${EMOJIS.LIGHTBULB} 개선사항`,
      value: feedback.improvements.map(improvement => `• ${improvement}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add detailed feedback
  if (feedback.detailed_feedback) {
    embed.addFields({
      name: `${EMOJIS.BOOK} 상세 피드백`,
      value: feedback.detailed_feedback.slice(0, 1024),
      inline: false,
    });
  }

  // Add recommendations
  if (feedback.recommendations && feedback.recommendations.length > 0) {
    embed.addFields({
      name: `${EMOJIS.GEAR} 추천사항`,
      value: feedback.recommendations.map(rec => `• ${rec}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add learning resources
  if (feedback.learning_resources && feedback.learning_resources.length > 0) {
    embed.addFields({
      name: `${EMOJIS.BOOK} 학습 자료`,
      value: feedback.learning_resources.map(resource => `• ${resource}`).join('\n').slice(0, 1024),
      inline: false,
    });
  }

  // Add processing info
  if (feedback.ai_model || feedback.processing_time) {
    const info = [];
    if (feedback.ai_model) info.push(`모델: ${feedback.ai_model}`);
    if (feedback.processing_time) info.push(`처리 시간: ${feedback.processing_time}ms`);
    
    embed.setFooter({ text: info.join(' • ') });
  }

  return embed;
}

/**
 * Create a user profile embed
 */
export function createUserProfileEmbed(user: User): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.USER} 사용자 프로필`)
    .addFields(
      {
        name: '이름',
        value: user.username,
        inline: true,
      },
      {
        name: '역할',
        value: user.role === 'admin' ? '관리자' : '학생',
        inline: true,
      },
      {
        name: '가입일',
        value: formatDate(user.created_at),
        inline: true,
      }
    )
    .setTimestamp();

  // Add student ID if available
  if (user.student_id) {
    embed.addFields({
      name: '학번',
      value: user.student_id,
      inline: true,
    });
  }

  // Add email if available
  if (user.email) {
    embed.addFields({
      name: '이메일',
      value: user.email,
      inline: true,
    });
  }

  return embed;
}

/**
 * Create an assignments list embed
 */
export function createAssignmentsListEmbed(assignments: Assignment[], page: number, totalPages: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.ASSIGNMENT} 과제 목록`)
    .setFooter({ text: `페이지 ${page}/${totalPages}` })
    .setTimestamp();

  if (assignments.length === 0) {
    embed.setDescription('표시할 과제가 없습니다.');
    return embed;
  }

  const assignmentList = assignments.map(assignment => {
    const deadline = new Date(assignment.deadline);
    const isOverdue = deadline < new Date();
    const status = isOverdue ? '⏰ 마감' : '📅 진행중';
    
    return `${status} \`${assignment.assignment_code}\` **${assignment.title}**\n${formatDate(assignment.deadline)}`;
  }).join('\n\n');

  embed.setDescription(assignmentList);

  return embed;
}

// Helper functions

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'submitted': return EMOJIS.PENDING;
    case 'under_review': return EMOJIS.INFO;
    case 'feedback_ready': return EMOJIS.SUCCESS;
    case 'completed': return EMOJIS.TROPHY;
    default: return EMOJIS.INFO;
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'submitted': return '제출됨';
    case 'under_review': return '검토 중';
    case 'feedback_ready': return '피드백 준비됨';
    case 'completed': return '완료됨';
    default: return '알 수 없음';
  }
}

function getStatusColor(status: string): ColorResolvable {
  switch (status) {
    case 'submitted': return COLORS.PENDING;
    case 'under_review': return COLORS.INFO;
    case 'feedback_ready': return COLORS.SUCCESS;
    case 'completed': return COLORS.SUCCESS;
    default: return COLORS.INFO;
  }
}

function getScoreColor(score: number): ColorResolvable {
  if (score >= 90) return COLORS.SUCCESS;
  if (score >= 70) return COLORS.INFO;
  if (score >= 50) return COLORS.WARNING;
  return COLORS.ERROR;
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