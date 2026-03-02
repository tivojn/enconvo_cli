import { Command } from 'commander';
import * as crypto from 'crypto';
import { getChannelInstance, resolveChatId, loadGlobalConfig } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';
import { routeToAgent } from '../../services/agent-router';
import { buildRosterContext } from '../../services/handler-core';
import { deliverTelegram, deliverDiscord } from '../../services/channel-deliver';
import { outputError } from '../../utils/command-output';

export function registerSend(parent: Command): void {
  parent
    .command('send')
    .description('Send a message through a channel instance and get the response')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram, discord)')
    .requiredOption('--name <name>', 'Instance name (e.g. vivienne)')
    .option('--chat <id>', 'Chat/channel ID to send response to')
    .option('--group <name>', 'Named group (resolves to chat ID)')
    .requiredOption('--message <text>', 'Message to send')
    .option('--reset', 'Start a fresh conversation (new session ID)')
    .option('--timeout <ms>', 'Override timeout in milliseconds (default: from config)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const instance = getChannelInstance(opts.channel, opts.name);
      if (!instance) {
        outputError(opts, `Instance "${opts.name}" not found. Run: enconvo channels list`);
        process.exit(1);
      }

      if (!instance.agent) {
        outputError(opts, `Instance "${opts.name}" has no agent configured.`);
        process.exit(1);
      }

      let chatId: string;
      try {
        chatId = resolveChatId(opts, opts.channel);
      } catch (err: unknown) {
        outputError(opts, err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const config = loadGlobalConfig();
      const channel = opts.channel as string;
      const timeoutMs = opts.timeout ? Number(opts.timeout) : config.enconvo.timeoutMs;
      const apiOptions = { url: config.enconvo.url, timeoutMs };
      const sessionId = opts.reset
        ? `${channel}-${chatId}-${opts.name}-${crypto.randomUUID().slice(0, 8)}`
        : `${channel}-${chatId}-${opts.name}`;

      // Build roster for delegation detection
      const roster = buildRosterContext(opts.name);

      try {
        if (!opts.json) console.log(`Sending to ${opts.name} (${instance.agent})...`);

        const response = await callEnConvo(opts.message, sessionId, instance.agent, apiOptions);
        const parsed = parseResponse(response, roster.rosterIds, roster.handleMap);

        if (!parsed.text && parsed.filePaths.length === 0) {
          if (opts.json) {
            console.log(JSON.stringify({ error: 'Empty response from EnConvo' }));
          } else {
            console.log('(EnConvo returned an empty response)');
          }
          return;
        }

        // Deliver primary response
        const deliver = channel === 'telegram'
          ? (p: typeof parsed) => deliverTelegram(instance.token, chatId, p)
          : channel === 'discord'
            ? (p: typeof parsed) => deliverDiscord(instance.token, chatId, p)
            : null;

        if (!deliver) throw new Error(`Channel "${channel}" does not support send yet.`);
        await deliver(parsed);

        // Handle delegations — route to target agents, skip self-mentions
        if (parsed.delegations.length > 0 && roster.currentAgent) {
          for (const delegation of parsed.delegations) {
            if (delegation.targetAgentId === roster.currentAgent.id) continue;
            const enrichedDelegation = {
              ...delegation,
              message: `[Original question: ${opts.message}]\n\n${delegation.message}`,
            };
            if (!opts.json) console.log(`  → Delegating to ${delegation.targetAgentId}...`);
            const delegatedResponse = await routeToAgent(
              roster.currentAgent.name,
              enrichedDelegation,
              { chatId, channel, instanceId: opts.name, apiOptions },
            );
            const target = roster.members.find(m => m.id === delegation.targetAgentId);
            const label = target ? `${target.emoji} ${target.name}` : delegation.targetAgentId;
            if (delegatedResponse && (delegatedResponse.text || delegatedResponse.filePaths.length > 0)) {
              const headerResponse = {
                text: delegatedResponse.text ? `[${label}]:\n${delegatedResponse.text}` : '',
                filePaths: delegatedResponse.filePaths,
                delegations: [],
              };
              await deliver(headerResponse);
              if (!opts.json) console.log(`  ✓ ${label} responded`);
            } else {
              const failMsg = { text: `(Could not reach ${label} — delegation failed)`, filePaths: [], delegations: [] };
              await deliver(failMsg);
              if (!opts.json) console.log(`  ✗ ${label} — delegation failed`);
            }
          }
        }

        if (opts.json) {
          console.log(JSON.stringify({
            instance: opts.name,
            channel,
            chat: chatId,
            message: opts.message,
            response: parsed.text,
            files: parsed.filePaths,
            delegations: parsed.delegations.map(d => d.targetAgentId),
          }, null, 2));
        } else {
          console.log(`\n${parsed.text ?? '(no text)'}`);
          if (parsed.filePaths.length > 0) {
            console.log(`\nFiles sent: ${parsed.filePaths.join(', ')}`);
          }
          console.log(`\n→ Delivered to chat ${chatId} via @${opts.name}`);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          outputError(opts, `Request timed out after ${timeoutMs}ms. Try --timeout <ms> for longer operations.`);
        } else if (err instanceof Error && err.message.includes('fetch failed')) {
          outputError(opts, 'Cannot reach EnConvo API. Is it running on localhost:54535?');
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          outputError(opts, msg);
        }
        process.exit(1);
      }
    });
}
