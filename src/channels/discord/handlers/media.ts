import { Message, TextChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { loadGlobalConfig } from '../../../config/store';
import { sendParsedResponse, ChannelIO } from '../../../services/handler-core';
import { sendFile } from '../utils/file-sender';
import { startTypingIndicator } from '../middleware/typing';
import { getSessionId } from './commands';
import { ensureMediaDir } from '../../../utils/media-dir';
import { DISCORD_MAX_LENGTH } from '../../../utils/message-splitter';

async function downloadAttachment(url: string, filename: string): Promise<string> {
  const mediaDir = ensureMediaDir('discord');
  const filePath = path.join(mediaDir, `${Date.now()}-${filename}`);
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function createDiscordIO(message: Message): ChannelIO {
  return {
    maxMessageLength: DISCORD_MAX_LENGTH,
    sendText: async (text: string) => { await message.reply(text); },
    sendFile: async (filePath: string) => { await sendFile(message, filePath); },
    startTyping: () => startTypingIndicator(message.channel as TextChannel),
  };
}

export function createMediaHandler(agentPath?: string, instanceId?: string) {
  return async function handleMedia(message: Message): Promise<void> {
    const channelId = message.channel.id;
    const caption = message.content || 'User sent a file';
    const io = createDiscordIO(message);
    const typing = io.startTyping();

    try {
      const localPaths: string[] = [];
      for (const attachment of message.attachments.values()) {
        const filename = attachment.name ?? 'file.bin';
        const localPath = await downloadAttachment(attachment.url, filename);
        localPaths.push(localPath);
      }

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
      await sendParsedResponse(io, parsed);
    } catch (err) {
      typing.stop();
      console.error('Error handling media:', err);
      await message.reply('Failed to process the attachment.');
    }
  };
}
