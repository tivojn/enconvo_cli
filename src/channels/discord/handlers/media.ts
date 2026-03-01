import { Client, Message, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { loadGlobalConfig } from '../../../config/store';
import { splitMessage } from '../utils/message-splitter';
import { sendFile } from '../utils/file-sender';
import { startTypingIndicator } from '../middleware/typing';
import { getSessionId } from './commands';
import { ensureMediaDir } from '../../../utils/media-dir';

async function downloadAttachment(url: string, filename: string): Promise<string> {
  const mediaDir = ensureMediaDir('discord');
  const filePath = path.join(mediaDir, `${Date.now()}-${filename}`);
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function createMediaHandler(client: Client, agentPath?: string, instanceId?: string) {
  return async function handleMedia(message: Message): Promise<void> {
    const channelId = message.channel.id;
    const caption = message.content || 'User sent a file';

    const typing = startTypingIndicator(message.channel as TextChannel);

    try {
      // Download all attachments
      const localPaths: string[] = [];
      for (const attachment of message.attachments.values()) {
        const filename = attachment.name ?? 'file.bin';
        const localPath = await downloadAttachment(attachment.url, filename);
        localPaths.push(localPath);
      }

      // Build input text with attachment references
      const attachmentRefs = localPaths
        .map(p => `[Attached file: ${p}]`)
        .join('\n');
      const inputText = `${caption}\n\n${attachmentRefs}`;

      const sessionId = getSessionId(channelId, instanceId);
      const globalConfig = loadGlobalConfig();

      const response = await callEnConvo(inputText, sessionId, agentPath ?? 'chat_with_ai/chat', {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      });
      typing.stop();

      const parsed = parseResponse(response);
      await sendParsedResponse(message, parsed);
    } catch (err) {
      typing.stop();
      console.error('Error handling media:', err);
      await message.reply('Failed to process the attachment.');
    }
  };
}

async function sendParsedResponse(message: Message, parsed: { text: string; filePaths: string[] }): Promise<void> {
  if (!parsed.text && parsed.filePaths.length === 0) {
    await message.reply('(EnConvo returned an empty response)');
    return;
  }

  if (parsed.text) {
    const chunks = splitMessage(parsed.text);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  }

  for (const filePath of parsed.filePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;
      await sendFile(message, filePath);
    } catch (err) {
      console.error(`Failed to send file ${filePath}:`, err);
    }
  }
}
