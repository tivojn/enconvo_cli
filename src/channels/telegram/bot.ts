import { Bot } from 'grammy';
import { authMiddleware, createAuthMiddleware } from './middleware/auth';
import { createMentionGate } from './middleware/mention-gate';
import { registerCommands } from './handlers/commands';
import { handleTextMessage, createTextMessageHandler } from './handlers/message';
import { handlePhoto, handleDocument, createPhotoHandler, createDocumentHandler } from './handlers/media';

/**
 * Create a Grammy bot instance.
 *
 * - With token + agentPath: pinned mode (one bot, one agent, no switching)
 * - With token only: legacy mode (multi-agent switching via session-manager)
 *
 * instanceId is used to namespace sessions per bot in group chats.
 */
export function createBot(token?: string, agentPath?: string, allowedUserIds?: number[], instanceId?: string): Bot {
  const botToken = token ?? process.env.BOT_TOKEN;
  if (!botToken) {
    throw new Error('Bot token is required — provide via parameter or BOT_TOKEN env var');
  }
  const bot = new Bot(botToken);

  if (agentPath) {
    // Pinned mode — dedicated instance
    bot.use(createAuthMiddleware(allowedUserIds));
    bot.use(createMentionGate());
    registerCommands(bot, agentPath, instanceId);

    bot.on('message:text').filter(
      (ctx) => /^\/\w+/.test(ctx.message.text),
      async (ctx) => {
        await ctx.reply(
          `Unknown command: ${ctx.message.text.split(/\s+/)[0]}\n` +
          'Type /help to see available commands.'
        );
      },
    );

    bot.on('message:photo', createPhotoHandler(agentPath, instanceId));
    bot.on('message:document', createDocumentHandler(agentPath, instanceId));
    bot.on('message:text', createTextMessageHandler(agentPath, instanceId));
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
