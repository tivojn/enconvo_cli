import { Context } from 'grammy';
import { InputFile } from 'grammy';
import * as fs from 'fs';
import { callEnConvo } from '../../../services/enconvo-client';
import { parseResponse } from '../../../services/response-parser';
import { getSessionId, getAgent } from '../../../services/session-manager';
import { loadAgentsRoster } from '../../../config/agent-store';
import { routeToAgent } from '../../../services/agent-router';
import { splitMessage } from '../utils/message-splitter';
import { startTypingIndicator } from '../middleware/typing';

export function createTextMessageHandler(pinnedAgentPath?: string, instanceId?: string) {
  // Pre-load roster IDs for delegation detection
  const roster = loadAgentsRoster();
  const rosterIds = roster.members.map(m => m.id);
  const currentAgent = instanceId
    ? roster.members.find(m => m.bindings.instanceName === instanceId)
    : undefined;

  return async function handleTextMessage(ctx: Context): Promise<void> {
    let text = ctx.message?.text;
    const chatId = ctx.chat?.id;
    if (!text || !chatId) return;

    // Strip @mention from text before sending to EnConvo
    if (ctx.me?.username) {
      text = text.replace(new RegExp(`@${ctx.me.username}`, 'gi'), '').trim();
    }

    // Bare @mention with no text — use replied-to message or nudge EnConvo with session context
    if (!text) {
      const replyText = ctx.message?.reply_to_message?.text;
      if (replyText) {
        text = replyText;
      } else {
        text = 'Hey, what can I help you with?';
      }
    }

    const sessionId = getSessionId(chatId, instanceId);
    const agentPath = pinnedAgentPath ?? getAgent(chatId).path;
    const typing = startTypingIndicator(ctx);

    try {
      const response = await callEnConvo(text, sessionId, agentPath);
      typing.stop();

      const parsed = parseResponse(response, rosterIds);

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

      // Send files with error tracking
      let failedFiles = 0;
      for (const filePath of parsed.filePaths) {
        try {
          if (!fs.existsSync(filePath)) { failedFiles++; continue; }
          await sendFile(ctx, filePath);
        } catch (err) {
          failedFiles++;
          console.error(`Failed to send file ${filePath}:`, err);
        }
      }
      if (failedFiles > 0) {
        await ctx.reply(`(${failedFiles} file(s) could not be delivered)`);
      }

      // Handle delegations — route to target agents
      if (parsed.delegations.length > 0 && currentAgent) {
        for (const delegation of parsed.delegations) {
          const delegatedResponse = await routeToAgent(
            currentAgent.name,
            delegation,
            { chatId: String(chatId), channel: 'telegram', instanceId },
          );
          if (delegatedResponse?.text) {
            const target = roster.members.find(m => m.id === delegation.targetAgentId);
            const label = target ? `${target.emoji} ${target.name}` : delegation.targetAgentId;
            const header = `[${label}]:`;
            const chunks = splitMessage(`${header}\n${delegatedResponse.text}`);
            for (const chunk of chunks) {
              await sendWithMarkdownFallback(ctx, chunk);
            }
          }
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
