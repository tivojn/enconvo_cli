import { Bot } from 'grammy';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { registerCommands } from './handlers/commands';
import { handleTextMessage } from './handlers/message';
import { handlePhoto, handleDocument } from './handlers/media';

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Auth middleware — runs before all handlers
  bot.use(authMiddleware);

  // Commands
  registerCommands(bot);

  // Media handlers
  bot.on('message:photo', handlePhoto);
  bot.on('message:document', handleDocument);

  // Text messages (catch-all, must be last)
  bot.on('message:text', handleTextMessage);

  // Error handler
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  return bot;
}
