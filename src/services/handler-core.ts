import * as fs from 'fs';
import { callEnConvo, CallEnConvoOptions } from './enconvo-client';
import { parseResponse, ParsedResponse } from './response-parser';
import { loadAgentsRoster, AgentMember } from '../config/agent-store';
import { routeToAgent } from './agent-router';
import { splitMessage as splitMessageShared } from '../utils/message-splitter';

/**
 * Channel-specific I/O interface.
 * Each channel adapter implements this to plug into the shared handler core.
 */
export interface ChannelIO {
  /** Send a text message (may support markdown) */
  sendText(text: string): Promise<void>;
  /** Send a file by local path */
  sendFile(filePath: string): Promise<void>;
  /** Start a typing/activity indicator, returns a stop function */
  startTyping(): { stop(): void };
  /** Maximum message length for this channel */
  maxMessageLength: number;
}

export interface HandlerContext {
  /** The user's text input */
  text: string;
  /** Session ID for EnConvo */
  sessionId: string;
  /** Agent path for EnConvo API (e.g. 'chat_with_ai/chat') */
  agentPath: string;
  /** Channel name ('telegram' | 'discord') */
  channel: string;
  /** Chat/channel ID as string */
  chatId: string;
  /** Instance name for this bot */
  instanceId?: string;
  /** Optional EnConvo API options */
  apiOptions?: CallEnConvoOptions;
}

/**
 * Pre-loaded roster context for delegation detection.
 * Create once per handler factory, reuse across messages.
 */
export interface RosterContext {
  rosterIds: string[];
  handleMap: Record<string, string>;
  currentAgent?: AgentMember;
  members: AgentMember[];
}

/**
 * Build roster context once at handler creation time.
 */
export function buildRosterContext(instanceId?: string): RosterContext {
  const roster = loadAgentsRoster();
  const rosterIds = roster.members.map(m => m.id);
  const handleMap: Record<string, string> = {};
  for (const m of roster.members) {
    // Legacy Telegram bot handle
    if (m.bindings.telegramBot) {
      handleMap[m.bindings.telegramBot] = m.id;
    }
    // Multi-channel bindings (Discord, etc.)
    if (m.bindings.channelBindings) {
      for (const binding of m.bindings.channelBindings) {
        if (binding.botHandle) {
          handleMap[binding.botHandle] = m.id;
        }
      }
    }
  }
  const currentAgent = instanceId
    ? roster.members.find(m => m.bindings.instanceName === instanceId)
    : undefined;

  return { rosterIds, handleMap, currentAgent, members: roster.members };
}

/**
 * Core message handling logic shared across all channels.
 * Calls EnConvo, parses response, sends text/files, handles delegations.
 */
export async function handleMessage(
  io: ChannelIO,
  ctx: HandlerContext,
  roster: RosterContext,
): Promise<void> {
  const typing = io.startTyping();

  try {
    const response = await callEnConvo(ctx.text, ctx.sessionId, ctx.agentPath, ctx.apiOptions);
    typing.stop();

    const parsed = parseResponse(response, roster.rosterIds, roster.handleMap);
    await sendParsedResponse(io, parsed);

    // Handle delegations (skip self-mentions)
    if (parsed.delegations.length > 0 && roster.currentAgent) {
      for (const delegation of parsed.delegations) {
        if (delegation.targetAgentId === roster.currentAgent.id) continue;
        // Enrich delegation with original user message for context
        const enrichedDelegation = {
          ...delegation,
          message: `[Original question: ${ctx.text}]\n\n${delegation.message}`,
        };
        const delegatedResponse = await routeToAgent(
          roster.currentAgent.name,
          enrichedDelegation,
          { chatId: ctx.chatId, channel: ctx.channel, instanceId: ctx.instanceId, apiOptions: ctx.apiOptions },
        );
        const target = roster.members.find(m => m.id === delegation.targetAgentId);
        const label = target ? `${target.emoji} ${target.name}` : delegation.targetAgentId;
        if (delegatedResponse?.text) {
          const header = `[${label}]:`;
          const chunks = splitMessageShared(`${header}\n${delegatedResponse.text}`, io.maxMessageLength);
          for (const chunk of chunks) {
            await io.sendText(chunk);
          }
        } else if (delegatedResponse === null) {
          await io.sendText(`(Could not reach ${label} — delegation failed)`);
        }
      }
    }
  } catch (err) {
    typing.stop();

    if (err instanceof Error && err.name === 'AbortError') {
      await io.sendText('Request timed out. EnConvo took too long to respond.');
    } else if (err instanceof Error && err.message.includes('fetch failed')) {
      await io.sendText('Cannot reach EnConvo API. Is it running on localhost:54535?');
    } else {
      console.error('Error handling message:', err);
      await io.sendText('Something went wrong while processing your message.');
    }
  }
}

/**
 * Send a parsed EnConvo response via the channel I/O interface.
 * Shared between message and media handlers.
 */
export async function sendParsedResponse(
  io: ChannelIO,
  parsed: ParsedResponse,
): Promise<void> {
  if (!parsed.text && parsed.filePaths.length === 0) {
    await io.sendText('(EnConvo returned an empty response)');
    return;
  }

  if (parsed.text) {
    const chunks = splitMessageShared(parsed.text, io.maxMessageLength);
    for (const chunk of chunks) {
      await io.sendText(chunk);
    }
  }

  let failedFiles = 0;
  for (const filePath of parsed.filePaths) {
    try {
      if (!fs.existsSync(filePath)) { failedFiles++; continue; }
      await io.sendFile(filePath);
    } catch (err) {
      failedFiles++;
      console.error(`Failed to send file ${filePath}:`, err);
    }
  }
  if (failedFiles > 0) {
    await io.sendText(`(${failedFiles} file(s) could not be delivered)`);
  }
}
