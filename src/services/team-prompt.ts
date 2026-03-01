import { AgentMember } from '../config/agent-store';
import { TEAM_KB_DIR } from '../config/paths';

/**
 * Generate a lean pointer prompt for an agent.
 * Workspace files and team KB are read by the agent at conversation start via read_file.
 */
export function generatePrompt(agent: AgentMember): string {
  const lines: string[] = [];

  lines.push(`You are ${agent.name}${agent.chineseName ? ` (${agent.chineseName})` : ''}, the ${agent.role} of the EnConvo AI Team.`);

  if (agent.bindings.telegramBot) {
    lines.push(`Your Telegram bot: ${agent.bindings.telegramBot}`);
  }

  lines.push('');
  lines.push(`Your workspace: ${agent.workspacePath}/`);
  lines.push(`Team knowledge base: ${TEAM_KB_DIR}/`);
  lines.push('');
  lines.push('IMPORTANT: At the start of every conversation, you MUST read your workspace files and team KB before responding:');
  lines.push('- IDENTITY.md — your identity, appearance, portrait');
  lines.push('- SOUL.md — your personality and directives');
  lines.push('- AGENTS.md — team roster, delegation rules, group chat rules');
  lines.push(`- Team KB (ALL files in ${TEAM_KB_DIR}/) — mandatory team rules and standards`);
  lines.push('');
  lines.push('Team KB contains MANDATORY rules that override your own judgment. Follow them strictly — no exceptions, no workarounds.');
  lines.push('Re-read all files if asked to refresh.');
  lines.push('');
  lines.push('# Current time is {{ now }}.');
  lines.push('# Response Language: {{responseLanguage}}');

  return lines.join('\n');
}
