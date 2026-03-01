import { Context } from 'grammy';

export function startTypingIndicator(ctx: Context): { stop: () => void } {
  const chatId = ctx.chat?.id;
  if (!chatId) return { stop: () => {} };

  let running = true;

  const sendTyping = async () => {
    while (running) {
      try {
        await ctx.replyWithChatAction('typing');
      } catch {
        // Chat might be gone, stop silently
        running = false;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  };

  sendTyping();

  return {
    stop: () => { running = false; },
  };
}
