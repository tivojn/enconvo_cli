import { Bot, Context } from 'grammy';
import { resetSession, getSessionId } from '../services/session-manager';
import { config } from '../config';

export function registerCommands(bot: Bot): void {
  bot.command('start', async (ctx: Context) => {
    await ctx.reply(
      'Welcome to EnConvo! Send me a message and I\'ll process it through EnConvo AI.\n\n' +
      'Commands:\n' +
      '/reset - Start a new conversation\n' +
      '/status - Check connection status\n' +
      '/help - Show this help message'
    );
  });

  bot.command('help', async (ctx: Context) => {
    await ctx.reply(
      'EnConvo Telegram Bot\n\n' +
      'Just send me any text message and I\'ll forward it to EnConvo AI.\n' +
      'You can also send photos or documents.\n\n' +
      'Commands:\n' +
      '/reset - Start a fresh conversation (clears context)\n' +
      '/status - Check if EnConvo is reachable\n' +
      '/help - Show this message'
    );
  });

  bot.command('reset', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const newSessionId = resetSession(chatId);
    await ctx.reply(`Session reset. New session: ${newSessionId}`);
  });

  bot.command('status', async (ctx: Context) => {
    const chatId = ctx.chat?.id ?? 0;
    const sessionId = getSessionId(chatId);

    try {
      const res = await fetch(`${config.enconvo.url}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        await ctx.reply(
          `Status: Connected\n` +
          `EnConvo: ${config.enconvo.url}\n` +
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
