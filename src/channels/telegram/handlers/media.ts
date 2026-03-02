import { Context } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import { getSessionId, getAgent } from '../../../services/session-manager';
import { handleMessage, buildRosterContext } from '../../../services/handler-core';
import { createTelegramIO } from '../utils/telegram-io';
import { ensureMediaDir } from '../../../utils/media-dir';

async function downloadFile(ctx: Context, fileId: string, extension: string): Promise<string> {
  const mediaDir = ensureMediaDir('telegram');
  const file = await ctx.api.getFile(fileId);
  const filePath = path.join(mediaDir, `${file.file_unique_id}${extension}`);

  const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

export function createPhotoHandler(pinnedAgentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handlePhoto(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const photos = ctx.message?.photo;
    if (!chatId || !photos || photos.length === 0) return;

    const photo = photos[photos.length - 1];
    const caption = ctx.message?.caption ?? 'User sent a photo';

    let localPath: string;
    try {
      localPath = await downloadFile(ctx, photo.file_id, '.jpg');
    } catch (err) {
      console.error('Error downloading photo:', err);
      await ctx.reply('Failed to download the photo.');
      return;
    }

    const inputText = `${caption}\n\n[Attached image: ${localPath}]`;
    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const io = createTelegramIO(ctx);

    await handleMessage(io, {
      text: inputText,
      sessionId,
      agentPath,
      channel: 'telegram',
      chatId: String(chatId),
      instanceId,
    }, roster);
  };
}

export function createDocumentHandler(pinnedAgentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleDocument(ctx: Context): Promise<void> {
    const chatId = ctx.chat?.id;
    const doc = ctx.message?.document;
    if (!chatId || !doc) return;

    const caption = ctx.message?.caption ?? 'User sent a document';
    const ext = doc.file_name ? path.extname(doc.file_name) || '.bin' : '.bin';

    let localPath: string;
    try {
      localPath = await downloadFile(ctx, doc.file_id, ext);
    } catch (err) {
      console.error('Error downloading document:', err);
      await ctx.reply('Failed to download the document.');
      return;
    }

    const inputText = `${caption}\n\n[Attached file: ${localPath}]`;
    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const io = createTelegramIO(ctx);

    await handleMessage(io, {
      text: inputText,
      sessionId,
      agentPath,
      channel: 'telegram',
      chatId: String(chatId),
      instanceId,
    }, roster);
  };
}

// Legacy exports for npm run dev path
export const handlePhoto = createPhotoHandler();
export const handleDocument = createDocumentHandler();
