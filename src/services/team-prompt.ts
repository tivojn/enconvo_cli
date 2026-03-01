import * as fs from 'fs';
import * as path from 'path';
import { AgentMember } from '../config/agent-store';
import { TEAM_KB_DIR } from '../config/paths';

function readFileOrEmpty(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim();
    }
  } catch { /* ignore */ }
  return '';
}

function listMdFiles(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(dir, f))
      .sort();
  } catch { return []; }
}

/**
 * Generate a grounded system prompt for an agent.
 * Inlines workspace content directly so agents don't need read_file tool.
 */
export function generatePrompt(agent: AgentMember): string {
  const lines: string[] = [];

  lines.push(`You are ${agent.name}${agent.chineseName ? ` (${agent.chineseName})` : ''}, the ${agent.role} of the EnConvo AI Team.`);

  if (agent.bindings.telegramBot) {
    lines.push(`Your Telegram bot: ${agent.bindings.telegramBot}`);
  }

  lines.push('');

  // Inline workspace content — agents are grounded from the first message
  const identity = readFileOrEmpty(path.join(agent.workspacePath, 'IDENTITY.md'));
  if (identity) {
    lines.push('---');
    lines.push('');
    lines.push(identity);
    lines.push('');
  }

  const soul = readFileOrEmpty(path.join(agent.workspacePath, 'SOUL.md'));
  if (soul) {
    lines.push('---');
    lines.push('');
    lines.push(soul);
    lines.push('');
  }

  const agents = readFileOrEmpty(path.join(agent.workspacePath, 'AGENTS.md'));
  if (agents) {
    lines.push('---');
    lines.push('');
    lines.push(agents);
    lines.push('');
  }

  // Inline team KB files
  const kbFiles = listMdFiles(TEAM_KB_DIR);
  for (const kbFile of kbFiles) {
    const content = readFileOrEmpty(kbFile);
    if (content) {
      lines.push('---');
      lines.push('');
      lines.push(content);
      lines.push('');
    }
  }

  // Refresh instruction (secondary — content is already inline above)
  lines.push('---');
  lines.push('');
  lines.push(`Your workspace: ${agent.workspacePath}/`);
  lines.push(`Team knowledge base: ${TEAM_KB_DIR}/`);
  lines.push('If asked to refresh, re-read these files for the latest content.');
  lines.push('');

  // Identity grounding — prevent model identity leaks
  lines.push(`CRITICAL: You ARE ${agent.name}. Never identify as Claude, GPT, or any model name.`);
  lines.push(`Your identity is ${agent.name}, ${agent.role}. This is non-negotiable.`);
  lines.push('');

  lines.push('# Current time is {{ now }}.');
  lines.push('# Response Language: {{responseLanguage}}');

  return lines.join('\n');
}
