import { Bot } from 'grammy';
import { config } from './config';
import { authMiddleware, createAuthMiddleware } from './middleware/auth';
import { registerCommands } from './handlers/commands';
import { handleTextMessage, createTextMessageHandler } from './handlers/message';
import { handlePhoto, handleDocument, createPhotoHandler, createDocumentHandler } from './handlers/media';

/**
 * Create a Grammy bot instance.
 *
 * - With no args: legacy mode (uses config.ts, session-manager for multi-agent switching)
 * - With token + agentPath: pinned mode (one bot, one agent, no switching)
 */
export function createBot(token?: string, agentPath?: string, allowedUserIds?: number[]): Bot {
  const botToken = token ?? config.botToken;
  const bot = new Bot(botToken);

  if (agentPath) {
    // Pinned mode — dedicated instance
    bot.use(createAuthMiddleware(allowedUserIds));
    registerCommands(bot, agentPath);

    bot.on('message:text').filter(
      (ctx) => /^\/\w+/.test(ctx.message.text),
      async (ctx) => {
        await ctx.reply(
          `Unknown command: ${ctx.message.text.split(/\s+/)[0]}\n` +
          'Type /help to see available commands.'
        );
      },
    );

    bot.on('message:photo', createPhotoHandler(agentPath));
    bot.on('message:document', createDocumentHandler(agentPath));
    bot.on('message:text', createTextMessageHandler(agentPath));
  } else {
    // Legacy mode — multi-agent switching via session-manager
    bot.use(authMiddleware);
    registerCommands(bot);

    bot.on('message:text').filter(
      (ctx) => /^\/\w+/.test(ctx.message.text),
      async (ctx) => {
        await ctx.reply(
          `Unknown command: ${ctx.message.text.split(/\s+/)[0]}\n` +
          'Type /help to see available commands.'
        );
      },
    );

    bot.on('message:photo', handlePhoto);
    bot.on('message:document', handleDocument);
    bot.on('message:text', handleTextMessage);
  }

  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
