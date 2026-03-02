import { Message } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { loadGlobalConfig } from '../../../config/store';
import { handleMessage, buildRosterContext } from '../../../services/handler-core';
import { createDiscordIO } from '../utils/file-sender';
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

export function createMediaHandler(agentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleMedia(message: Message): Promise<void> {
    const channelId = message.channel.id;
    const caption = message.content || 'User sent a file';

    const localPaths: string[] = [];
    try {
      for (const attachment of message.attachments.values()) {
        const filename = attachment.name ?? 'file.bin';
        const localPath = await downloadAttachment(attachment.url, filename);
        localPaths.push(localPath);
      }
    } catch (err) {
      console.error('Error downloading attachment:', err);
      await message.reply('Failed to download the attachment.');
      return;
    }

    const attachmentRefs = localPaths
      .map(p => `[Attached file: ${p}]`)
      .join('\n');
    const inputText = `${caption}\n\n${attachmentRefs}`;

    const sessionId = getSessionId(channelId, instanceId);
    const globalConfig = loadGlobalConfig();
    const io = createDiscordIO(message);

    await handleMessage(io, {
      text: inputText,
      sessionId,
      agentPath: agentPath ?? 'chat_with_ai/chat',
      channel: 'discord',
      chatId: channelId,
      instanceId,
      apiOptions: {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      },
    }, roster);
  };
}
