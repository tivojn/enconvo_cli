import { Client, Message, TextChannel } from 'discord.js';
import * as fs from 'fs';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { loadGlobalConfig } from '../../../config/store';
import { loadAgentsRoster } from '../../../config/agent-store';
import { routeToAgent } from '../../../services/agent-router';
import { splitMessage } from '../utils/message-splitter';
import { sendFile } from '../utils/file-sender';
import { startTypingIndicator } from '../middleware/typing';
import { getSessionId } from './commands';

export function createTextMessageHandler(client: Client, agentPath?: string, instanceId?: string) {
  // Pre-load roster for delegation detection
  const roster = loadAgentsRoster();
  const rosterIds = roster.members.map(m => m.id);
  // Map bot handles → agent IDs so we catch @BotUsername mentions too
  const handleMap: Record<string, string> = {};
  for (const m of roster.members) {
    if (m.bindings.telegramBot) {
      handleMap[m.bindings.telegramBot] = m.id;
    }
  }
  const currentAgent = instanceId
    ? roster.members.find(m => m.bindings.instanceName === instanceId)
    : undefined;

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
    const typing = startTypingIndicator(message.channel as TextChannel);

    try {
      const response = await callEnConvo(text, sessionId, agentPath ?? 'chat_with_ai/chat', {
        url: globalConfig.enconvo.url,
        timeoutMs: globalConfig.enconvo.timeoutMs,
      });
      typing.stop();

      const parsed = parseResponse(response, rosterIds, handleMap);

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

      // Send files with error tracking
      let failedFiles = 0;
      for (const filePath of parsed.filePaths) {
        try {
          if (!fs.existsSync(filePath)) { failedFiles++; continue; }
          await sendFile(message, filePath);
        } catch (err) {
          failedFiles++;
          console.error(`Failed to send file ${filePath}:`, err);
        }
      }
      if (failedFiles > 0) {
        await message.reply(`(${failedFiles} file(s) could not be delivered)`);
      }

      // Handle delegations — route to target agents
      if (parsed.delegations.length > 0 && currentAgent) {
        for (const delegation of parsed.delegations) {
          const delegatedResponse = await routeToAgent(
            currentAgent.name,
            delegation,
            { chatId: channelId, channel: 'discord', instanceId },
          );
          if (delegatedResponse?.text) {
            const target = roster.members.find(m => m.id === delegation.targetAgentId);
            const label = target ? `${target.emoji} ${target.name}` : delegation.targetAgentId;
            const header = `[${label}]:`;
            const chunks = splitMessage(`${header}\n${delegatedResponse.text}`);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
          }
        }
      }
    } catch (err) {
      typing.stop();

      if (err instanceof Error && err.name === 'AbortError') {
        await message.reply('Request timed out. EnConvo took too long to respond.');
      } else if (err instanceof Error && err.message.includes('fetch failed')) {
        await message.reply('Cannot reach EnConvo API. Is it running on localhost:54535?');
      } else {
        console.error('Error handling message:', err);
        await message.reply('Something went wrong while processing your message.');
      }
    }
  };
}
