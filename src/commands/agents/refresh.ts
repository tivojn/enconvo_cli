import { Command } from 'commander';
import { Bot } from 'grammy';
import * as crypto from 'crypto';
import { loadAgentsRoster, AgentMember } from '../../config/agent-store';
import { getChannelInstance, loadGlobalConfig, resolveChatId } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';
import { TEAM_KB_DIR } from '../../config/paths';
import { outputError } from '../../utils/command-output';

const REFRESH_MESSAGE = `Team files updated. Re-read all workspace files and team KB now: IDENTITY.md, SOUL.md, AGENTS.md, and ${TEAM_KB_DIR}/. Acknowledge briefly.`;
const SILENT_REFRESH_MESSAGE = `Re-read all workspace files and team KB now: IDENTITY.md, SOUL.md, AGENTS.md, and ${TEAM_KB_DIR}/. Do not announce or summarize what you read. Just confirm with "OK".`;

export function registerRefresh(parent: Command): void {
  parent
    .command('refresh')
    .description('Notify agents to re-read their workspace files and team KB')
    .option('--chat <id>', 'Telegram chat ID to deliver responses to')
    .option('--group <name>', 'Named group (resolves to chat ID)')
    .option('--agent <id>', 'Refresh a specific agent only')
    .option('--reset', 'Generate a new session ID (fresh conversation)')
    .option('--silent', 'Refresh without posting to Telegram')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      let chatId: string;
      try {
        chatId = resolveChatId(opts, 'telegram');
      } catch (err: unknown) {
        outputError(opts, err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        outputError(opts, 'No agents configured. Run "enconvo agents add" first.');
        process.exit(1);
      }

      let targets: AgentMember[];
      if (opts.agent) {
        const agent = roster.members.find((m) => m.id === opts.agent);
        if (!agent) {
          outputError(opts, `Agent "${opts.agent}" not found`);
          process.exit(1);
        }
        targets = [agent];
      } else {
        targets = roster.members;
      }

      const config = loadGlobalConfig();
      const results: Array<{ id: string; status: string; response?: string }> = [];

      for (const agent of targets) {
        const instanceName = agent.bindings.instanceName;
        const instance = getChannelInstance('telegram', instanceName);

        if (!instance) {
          results.push({ id: agent.id, status: `skipped — no telegram instance "${instanceName}"` });
          if (!opts.json) {
            console.log(`  ${agent.emoji} ${agent.name}: skipped — instance "${instanceName}" not found`);
          }
          continue;
        }

        // Build session ID — use reset flag for fresh session
        const sessionId = opts.reset
          ? `telegram-${chatId}-${instanceName}-${crypto.randomUUID().slice(0, 8)}`
          : `telegram-${chatId}-${instanceName}`;

        try {
          if (!opts.json) {
            console.log(`  ${agent.emoji} ${agent.name}: sending refresh...`);
          }

          const message = opts.silent ? SILENT_REFRESH_MESSAGE : REFRESH_MESSAGE;
          const response = await callEnConvo(message, sessionId, instance.agent, {
            url: config.enconvo.url,
            timeoutMs: config.enconvo.timeoutMs,
          });

          const parsed = parseResponse(response);
          const responseText = parsed.text || '(no text response)';

          // Deliver response to Telegram chat (skip in silent mode)
          if (!opts.silent) {
            const bot = new Bot(instance.token);
            const label = `${agent.emoji} ${agent.name}`;

            try {
              await bot.api.sendMessage(chatId, `${label}:\n${responseText}`, { parse_mode: 'Markdown' });
            } catch {
              await bot.api.sendMessage(chatId, `${label}:\n${responseText}`);
            }
          }

          results.push({ id: agent.id, status: 'refreshed', response: responseText });
          if (!opts.json) {
            console.log(`  ${agent.emoji} ${agent.name}: refreshed ✓`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ id: agent.id, status: `error: ${msg}` });
          if (!opts.json) {
            console.error(`  ${agent.emoji} ${agent.name}: error — ${msg}`);
          }
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ action: 'refresh', chat: chatId, reset: !!opts.reset, results }, null, 2));
      } else {
        const refreshed = results.filter((r) => r.status === 'refreshed').length;
        console.log(`\nRefreshed ${refreshed}/${targets.length} agents.`);
      }
    });
}
