import { Bot, Context } from 'grammy';
import { resetSession, getSessionId, getAgent, setAgent } from '../../../services/session-manager';
import { config } from '../config';

export function registerCommands(bot: Bot, pinnedAgentPath?: string, instanceId?: string): void {
  bot.command('start', async (ctx: Context) => {
    const chatId = ctx.chat?.id ?? 0;
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const groupTip = isGroup
      ? `\n\n💡 In this group, mention me with @${ctx.me.username} to chat.`
      : '';

    if (pinnedAgentPath) {
      await ctx.reply(
        `Welcome! This bot is dedicated to agent: ${pinnedAgentPath}\n\n` +
        'Commands:\n' +
        '/reset - Start a new conversation\n' +
        '/status - Check connection status\n' +
        '/help - Show this help message' +
        groupTip
      );
    } else {
      const agent = getAgent(chatId);
      await ctx.reply(
        `Welcome to EnConvo! Currently talking to: ${agent.name}\n\n` +
        'Commands:\n' +
        '/agent - Switch between AI agents\n' +
        '/reset - Start a new conversation\n' +
        '/status - Check connection status\n' +
        '/help - Show this help message' +
        groupTip
      );
    }
  });

  bot.command('help', async (ctx: Context) => {
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
    const groupSection = isGroup
      ? '\n\n' +
        '📌 Group Chat Usage:\n' +
        `• Mention me: @${ctx.me.username} your message\n` +
        '• Reply to my message to continue a thread\n' +
        `• Target commands: /reset@${ctx.me.username}\n` +
        '• I only respond when mentioned or replied to'
      : '';

    if (pinnedAgentPath) {
      await ctx.reply(
        'EnConvo Telegram Bot (dedicated instance)\n\n' +
        `Agent: ${pinnedAgentPath}\n\n` +
        'Send me text, photos, or documents and I\'ll forward them to the agent.\n\n' +
        'Commands:\n' +
        '/reset - Start a fresh conversation (clears context)\n' +
        '/status - Check if EnConvo is reachable\n' +
        '/help - Show this message' +
        groupSection
      );
    } else {
      await ctx.reply(
        'EnConvo Telegram Bot\n\n' +
        'Send me text, photos, or documents and I\'ll forward them to EnConvo AI.\n\n' +
        'Commands:\n' +
        '/agent - List agents or switch (e.g. /agent openclaw)\n' +
        '/reset - Start a fresh conversation (clears context)\n' +
        '/status - Check if EnConvo is reachable\n' +
        '/help - Show this message' +
        groupSection
      );
    }
  });

  bot.command(['agent', 'agents'], async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Pinned mode — no switching allowed
    if (pinnedAgentPath) {
      await ctx.reply(
        `This bot is dedicated to agent: ${pinnedAgentPath}\n` +
        'Agent switching is not available for dedicated instances.'
      );
      return;
    }

    const args = ctx.message?.text?.split(/\s+/).slice(1) ?? [];
    const current = getAgent(chatId);

    // No args: list available agents
    if (args.length === 0) {
      const lines = config.enconvo.agents.map(a => {
        const marker = a.id === current.id ? ' (active)' : '';
        return `  ${a.id} — ${a.name}${marker}\n    ${a.description}`;
      });
      await ctx.reply(
        `Current agent: ${current.name}\n\n` +
        `Available agents:\n${lines.join('\n')}\n\n` +
        'Usage: /agent <id>'
      );
      return;
    }

    // Switch agent
    const agent = setAgent(chatId, args[0]);
    if (!agent) {
      const ids = config.enconvo.agents.map(a => a.id).join(', ');
      await ctx.reply(`Unknown agent "${args[0]}". Available: ${ids}`);
      return;
    }

    await ctx.reply(`Switched to ${agent.name} (${agent.description})`);
  });

  bot.command('reset', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const newSessionId = resetSession(chatId, instanceId);
    await ctx.reply(`Session reset. New session: ${newSessionId}`);
  });

  bot.command('status', async (ctx: Context) => {
    const chatId = ctx.chat?.id ?? 0;
    const sessionId = getSessionId(chatId, instanceId);

    const agentDisplay = pinnedAgentPath
      ? `${pinnedAgentPath} (pinned)`
      : getAgent(chatId).name;

    try {
      const res = await fetch(`${config.enconvo.url}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        await ctx.reply(
          `Status: Connected\n` +
          `EnConvo: ${config.enconvo.url}\n` +
          `Agent: ${agentDisplay}\n` +
          `Session: ${sessionId}`
        );
      } else {
        await ctx.reply(`Status: EnConvo returned ${res.status}`);
      }
    } catch {
      await ctx.reply('Status: Cannot reach EnConvo API. Is it running?');
    }
  });
}
