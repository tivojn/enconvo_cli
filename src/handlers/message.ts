import { Context } from 'grammy';
import { InputFile } from 'grammy';
import * as fs from 'fs';
import { callEnConvo } from '../services/enconvo-client';
import { parseResponse } from '../services/response-parser';
import { getSessionId } from '../services/session-manager';
import { splitMessage } from '../utils/message-splitter';
import { startTypingIndicator } from '../middleware/typing';

export async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  const chatId = ctx.chat?.id;
  if (!text || !chatId) return;

  const sessionId = getSessionId(chatId);
  const typing = startTypingIndicator(ctx);

  try {
    const response = await callEnConvo(text, sessionId);
    typing.stop();

    const parsed = parseResponse(response);

    if (!parsed.text && parsed.filePaths.length === 0) {
      await ctx.reply('(EnConvo returned an empty response)');
      return;
    }

    // Send text
    if (parsed.text) {
      const chunks = splitMessage(parsed.text);
      for (const chunk of chunks) {
        await sendWithMarkdownFallback(ctx, chunk);
      }
    }

    // Send images
    for (const filePath of parsed.filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await ctx.replyWithPhoto(new InputFile(filePath));
        }
      } catch (err) {
        console.error(`Failed to send image ${filePath}:`, err);
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
}

async function sendWithMarkdownFallback(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } catch {
    // Markdown parse failed, send as plain text
    await ctx.reply(text);
  }
}
