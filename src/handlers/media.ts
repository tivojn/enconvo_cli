import { Context } from 'grammy';
import { InputFile } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { callEnConvo } from '../services/enconvo-client';
import { parseResponse } from '../services/response-parser';
import { getSessionId } from '../services/session-manager';
import { splitMessage } from '../utils/message-splitter';
import { startTypingIndicator } from '../middleware/typing';

const MEDIA_DIR = '/tmp/enconvo-telegram-media';

function ensureMediaDir(): void {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}

async function downloadFile(ctx: Context, fileId: string, extension: string): Promise<string> {
  ensureMediaDir();
  const file = await ctx.api.getFile(fileId);
  const filePath = path.join(MEDIA_DIR, `${file.file_unique_id}${extension}`);

  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

export async function handlePhoto(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const photos = ctx.message?.photo;
  if (!chatId || !photos || photos.length === 0) return;

  // Get the largest photo
  const photo = photos[photos.length - 1];
  const caption = ctx.message?.caption ?? 'User sent a photo';

  const typing = startTypingIndicator(ctx);

  try {
    const localPath = await downloadFile(ctx, photo.file_id, '.jpg');
    const inputText = `${caption}\n\n[Attached image: ${localPath}]`;
    const sessionId = getSessionId(chatId);

    const response = await callEnConvo(inputText, sessionId);
    typing.stop();

    const parsed = parseResponse(response);
    await sendParsedResponse(ctx, parsed);
  } catch (err) {
    typing.stop();
    console.error('Error handling photo:', err);
    await ctx.reply('Failed to process the photo.');
  }
}

export async function handleDocument(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  const doc = ctx.message?.document;
  if (!chatId || !doc) return;

  const caption = ctx.message?.caption ?? 'User sent a document';
  const ext = path.extname(doc.file_name ?? '.bin');

  const typing = startTypingIndicator(ctx);

  try {
    const localPath = await downloadFile(ctx, doc.file_id, ext);
    const inputText = `${caption}\n\n[Attached file: ${localPath}]`;
    const sessionId = getSessionId(chatId);

    const response = await callEnConvo(inputText, sessionId);
    typing.stop();

    const parsed = parseResponse(response);
    await sendParsedResponse(ctx, parsed);
  } catch (err) {
    typing.stop();
    console.error('Error handling document:', err);
    await ctx.reply('Failed to process the document.');
  }
}

async function sendParsedResponse(ctx: Context, parsed: { text: string; filePaths: string[] }): Promise<void> {
  if (!parsed.text && parsed.filePaths.length === 0) {
    await ctx.reply('(EnConvo returned an empty response)');
    return;
  }

  if (parsed.text) {
    const chunks = splitMessage(parsed.text);
    for (const chunk of chunks) {
      try {
        await ctx.reply(chunk, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(chunk);
      }
    }
  }

  for (const filePath of parsed.filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        await ctx.replyWithPhoto(new InputFile(filePath));
      }
    } catch (err) {
      console.error(`Failed to send image ${filePath}:`, err);
    }
  }
}
