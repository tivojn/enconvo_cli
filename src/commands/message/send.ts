import { Command } from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { getChannelInstance, loadGlobalConfig } from '../../config/store';
import { loadAgentsRoster } from '../../config/agent-store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';

export function registerMessageSend(parent: Command): void {
  parent
    .command('send')
    .description('Send a message through a channel')
    .requiredOption('--channel <channel>', 'Channel type (telegram, discord)')
    .requiredOption('--target <target>', 'Chat/channel ID or group name')
    .requiredOption('--message <text>', 'Message text')
    .option('--agent <id>', 'Agent ID (routes via agent bindings)')
    .option('--name <name>', 'Instance name (direct, bypasses agent lookup)')
    .option('--deliver', 'Send response to the channel (not just stdout)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      // Resolve instance: either by --name or by --agent binding
      let instanceName = opts.name;

      if (!instanceName && opts.agent) {
        const roster = loadAgentsRoster();
        const agent = roster.members.find(m => m.id === opts.agent);
        if (!agent) {
          console.error(`Agent "${opts.agent}" not found`);
          process.exit(1);
        }
        // Find binding for this channel
        const binding = agent.bindings.channelBindings?.find(b => b.channel === opts.channel);
        if (binding) {
          instanceName = binding.instanceName;
        } else if (opts.channel === 'telegram') {
          instanceName = agent.bindings.instanceName;
        } else {
          console.error(`Agent "${opts.agent}" has no binding for channel "${opts.channel}"`);
          process.exit(1);
        }
      }

      if (!instanceName) {
        console.error('Provide --name or --agent to identify the instance');
        process.exit(1);
      }

      const instance = getChannelInstance(opts.channel, instanceName);
      if (!instance) {
        console.error(`Instance "${instanceName}" not found for channel "${opts.channel}"`);
        process.exit(1);
      }

      if (!instance.agent) {
        console.error(`Instance "${instanceName}" has no agent configured`);
        process.exit(1);
      }

      const config = loadGlobalConfig();
      const sessionId = `${opts.channel}-${opts.target}-${instanceName}-${crypto.randomUUID().slice(0, 8)}`;

      try {
        const response = await callEnConvo(opts.message, sessionId, instance.agent, {
          url: config.enconvo.url,
          timeoutMs: config.enconvo.timeoutMs,
        });

        const parsed = parseResponse(response);

        if (opts.json) {
          console.log(JSON.stringify({
            channel: opts.channel,
            target: opts.target,
            instance: instanceName,
            response: parsed.text,
            files: parsed.filePaths,
          }, null, 2));
        } else {
          console.log(parsed.text ?? '(empty response)');
          if (parsed.filePaths.length > 0) {
            console.log(`\nFiles: ${parsed.filePaths.join(', ')}`);
          }
        }

        // If --deliver, also send to channel
        if (opts.deliver && parsed.text) {
          const { Bot, InputFile } = await import('grammy');
          if (opts.channel === 'telegram') {
            const bot = new Bot(instance.token);
            try {
              await bot.api.sendMessage(opts.target, parsed.text, { parse_mode: 'Markdown' });
            } catch {
              await bot.api.sendMessage(opts.target, parsed.text);
            }
            for (const filePath of parsed.filePaths) {
              if (!fs.existsSync(filePath)) continue;
              const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
              const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
              if (IMAGE_EXTS.has(ext)) {
                await bot.api.sendPhoto(opts.target, new InputFile(filePath));
              } else {
                await bot.api.sendDocument(opts.target, new InputFile(filePath));
              }
            }
            if (!opts.json) console.log(`\n→ Delivered to ${opts.target} via ${opts.channel}`);
          } else if (opts.channel === 'discord') {
            const { splitMessage } = await import('../../channels/discord/utils/message-splitter');
            const baseUrl = `https://discord.com/api/v10/channels/${opts.target}/messages`;
            const headers = {
              Authorization: `Bot ${instance.token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
            };
            const chunks = splitMessage(parsed.text);
            for (const chunk of chunks) {
              await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify({ content: chunk }) });
            }
            if (!opts.json) console.log(`\n→ Delivered to ${opts.target} via ${opts.channel}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(`Error: ${msg}`);
        }
        process.exit(1);
      }
    });
}
