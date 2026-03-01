import { Context } from 'grammy';
import { InputFile } from 'grammy';
import { getSessionId, getAgent } from '../../../services/session-manager';
import { handleMessage, buildRosterContext, ChannelIO } from '../../../services/handler-core';
import { startTypingIndicator } from '../middleware/typing';
import { TELEGRAM_MAX_LENGTH } from '../../../utils/message-splitter';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

function createTelegramIO(ctx: Context): ChannelIO {
  return {
    maxMessageLength: TELEGRAM_MAX_LENGTH,
    sendText: async (text: string) => { await sendWithMarkdownFallback(ctx, text); },
    sendFile: async (filePath: string) => { await sendFile(ctx, filePath); },
    startTyping: () => startTypingIndicator(ctx),
  };
}

export function createTextMessageHandler(pinnedAgentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleTextMessage(ctx: Context): Promise<void> {
    let text = ctx.message?.text;
    const chatId = ctx.chat?.id;
    if (!text || !chatId) return;

    // Strip @mention from text before sending to EnConvo
    if (ctx.me?.username) {
      text = text.replace(new RegExp(`@${ctx.me.username}`, 'gi'), '').trim();
    }

    // Bare @mention with no text — use replied-to message or nudge
    if (!text) {
      const replyText = ctx.message?.reply_to_message?.text;
      text = replyText || 'Hey, what can I help you with?';
    }

    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const io = createTelegramIO(ctx);

    await handleMessage(io, {
      text,
      sessionId,
      agentPath,
      channel: 'telegram',
      chatId: String(chatId),
      instanceId,
    }, roster);
  };
}

// Legacy export for npm run dev path
export const handleTextMessage = createTextMessageHandler();

async function sendFile(ctx: Context, filePath: string): Promise<void> {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (IMAGE_EXTS.has(ext)) {
    await ctx.replyWithPhoto(new InputFile(filePath));
  } else {
    await ctx.replyWithDocument(new InputFile(filePath));
  }
}

async function sendWithMarkdownFallback(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch {
    await ctx.reply(text);
  }
}
