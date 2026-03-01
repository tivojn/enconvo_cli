import { Context } from 'grammy';
import { InputFile } from 'grammy';
import * as fs from 'fs';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { getSessionId, getAgent } from '../../../services/session-manager';
import { splitMessage } from '../utils/message-splitter';
import { startTypingIndicator } from '../middleware/typing';

export function createTextMessageHandler(pinnedAgentPath?: string, instanceId?: string) {
  return async function handleTextMessage(ctx: Context): Promise<void> {
    let text = ctx.message?.text;
    const chatId = ctx.chat?.id;
    if (!text || !chatId) return;

    // Strip @mention from text before sending to EnConvo
    if (ctx.me?.username) {
      text = text.replace(new RegExp(`@${ctx.me.username}`, 'gi'), '').trim();
    }
    if (!text) return;

    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const typing = startTypingIndicator(ctx);

    try {
      const response = await callEnConvo(text, sessionId, agentPath);
      typing.stop();

      const parsed = parseResponse(response);

      if (!parsed.text && parsed.filePaths.length === 0) {
        await ctx.reply('(EnConvo returned an empty response)');
        return;
      }

      if (parsed.text) {
        const chunks = splitMessage(parsed.text);
        for (const chunk of chunks) {
          await sendWithMarkdownFallback(ctx, chunk);
        }
      }

      for (const filePath of parsed.filePaths) {
        try {
          if (!fs.existsSync(filePath)) continue;
          await sendFile(ctx, filePath);
        } catch (err) {
          console.error(`Failed to send file ${filePath}:`, err);
        }
      }
    } catch (err) {
      typing.stop();

      if (err instanceof Error && err.name === 'AbortError') {
        await ctx.reply('Request timed out. EnConvo took too long to respond.');
      } else if (err instanceof Error && err.message.includes('fetch failed')) {
        await ctx.reply('Cannot reach EnConvo API. Is it running on localhost:54535?');
      } else {
        console.error('Error handling message:', err);
        await ctx.reply('Something went wrong while processing your message.');
      }
    }
  };
}

// Legacy export for npm run dev path
export const handleTextMessage = createTextMessageHandler();

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

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
