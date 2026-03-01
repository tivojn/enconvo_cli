import { Client, Message, TextChannel } from 'discord.js';
import { loadGlobalConfig } from '../../../config/store';
import { handleMessage, buildRosterContext, ChannelIO } from '../../../services/handler-core';
import { sendFile } from '../utils/file-sender';
import { startTypingIndicator } from '../middleware/typing';
import { getSessionId } from './commands';
import { DISCORD_MAX_LENGTH } from '../../../utils/message-splitter';

function createDiscordIO(message: Message): ChannelIO {
  return {
    maxMessageLength: DISCORD_MAX_LENGTH,
    sendText: async (text: string) => { await message.reply(text); },
    sendFile: async (filePath: string) => { await sendFile(message, filePath); },
    startTyping: () => startTypingIndicator(message.channel as TextChannel),
  };
}

export function createTextMessageHandler(client: Client, agentPath?: string, instanceId?: string) {
  const roster = buildRosterContext(instanceId);

  return async function handleTextMessage(message: Message): Promise<void> {
    let text = message.content;
    const channelId = message.channel.id;
    if (!text) return;

    // Strip @mention of this bot from text
    if (client.user) {
      text = text.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
    }

    // Bare @mention with no text — use replied-to message or nudge
    if (!text) {
      if (message.reference?.messageId) {
        try {
          const referenced = await message.channel.messages.fetch(message.reference.messageId);
          text = referenced.content || 'Hey, what can I help you with?';
        } catch {
          text = 'Hey, what can I help you with?';
        }
      } else {
        text = 'Hey, what can I help you with?';
      }
    }

    const sessionId = getSessionId(channelId, instanceId);
    const globalConfig = loadGlobalConfig();
    const io = createDiscordIO(message);

    await handleMessage(io, {
      text,
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
