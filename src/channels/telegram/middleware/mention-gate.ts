import { Context, NextFunction } from 'grammy';

/**
 * Middleware that gates group messages — only passes through if:
 * 1. Private chat (always respond)
 * 2. Bot is @mentioned in the message
 * 3. Message is a reply to one of the bot's messages
 * 4. Message is a bot command (handled by command handlers)
 */
export function createMentionGate() {
  return async function mentionGate(ctx: Context, next: NextFunction): Promise<void> {
    // Private chats: always respond
    if (ctx.chat?.type === 'private') return next();

    // Bot commands: let command handlers deal with them
    if (ctx.message?.entities?.some(e => e.type === 'bot_command')) return next();

    // Reply to bot's own message: respond
    if (ctx.message?.reply_to_message?.from?.id === ctx.me.id) return next();

    // Check for @mention of this bot
    const mentions = ctx.entities('mention') ?? [];
    const botMentioned = mentions.some(
      e => e.text.toLowerCase() === `@${ctx.me.username.toLowerCase()}`
    );
    if (botMentioned) return next();

    // Check for text_mention (mention by user ID, for bots without visible username)
    const textMentions = ctx.entities('text_mention') ?? [];
    const botTextMentioned = textMentions.some(
      e => e.user?.id === ctx.me.id
    );
    if (botTextMentioned) return next();

    // Not mentioned, not a reply — silently ignore
  };
}
