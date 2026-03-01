import { Command } from 'commander';
import { Bot, InputFile } from 'grammy';
import * as fs from 'fs';
import { getChannelInstance } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse } from '../../services/response-parser';
import { loadGlobalConfig } from '../../config/store';

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

export function registerSend(parent: Command): void {
  parent
    .command('send')
    .description('Send a message through a channel instance and get the response')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. vivienne)')
    .requiredOption('--chat <id>', 'Chat ID to send response to')
    .requiredOption('--message <text>', 'Message to send')
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

      const config = loadGlobalConfig();
      const sessionId = `telegram-${opts.chat}-${opts.name}`;

      try {
        // Call EnConvo
        if (!opts.json) console.log(`Sending to ${opts.name} (${instance.agent})...`);

        const response = await callEnConvo(opts.message, sessionId, instance.agent, {
          url: config.enconvo.url,
          timeoutMs: config.enconvo.timeoutMs,
        });

        const parsed = parseResponse(response);

        if (!parsed.text && parsed.filePaths.length === 0) {
          if (opts.json) {
            console.log(JSON.stringify({ error: 'Empty response from EnConvo' }));
          } else {
            console.log('(EnConvo returned an empty response)');
          }
          return;
        }

        // Send response to Telegram chat
        const bot = new Bot(instance.token);

        if (parsed.text) {
          try {
            await bot.api.sendMessage(opts.chat, parsed.text, { parse_mode: 'Markdown' });
          } catch {
            await bot.api.sendMessage(opts.chat, parsed.text);
          }
        }

        for (const filePath of parsed.filePaths) {
          if (!fs.existsSync(filePath)) continue;
          const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
          if (IMAGE_EXTS.has(ext)) {
            await bot.api.sendPhoto(opts.chat, new InputFile(filePath));
          } else {
            await bot.api.sendDocument(opts.chat, new InputFile(filePath));
          }
        }

        if (opts.json) {
          console.log(JSON.stringify({
            instance: opts.name,
            chat: opts.chat,
            message: opts.message,
            response: parsed.text,
            files: parsed.filePaths,
          }, null, 2));
        } else {
          console.log(`\n${parsed.text ?? '(no text)'}`);
          if (parsed.filePaths.length > 0) {
            console.log(`\nFiles sent: ${parsed.filePaths.join(', ')}`);
          }
          console.log(`\n→ Delivered to chat ${opts.chat} via @${opts.name}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        outputError(opts, msg);
        process.exit(1);
      }
    });
}

function outputError(opts: { json?: boolean }, msg: string): void {
  if (opts.json) {
    console.log(JSON.stringify({ error: msg }));
  } else {
    console.error(`Error: ${msg}`);
  }
}
