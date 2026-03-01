import { Command } from 'commander';
import { Bot, InputFile } from 'grammy';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getChannelInstance, resolveChatId } from '../../config/store';
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
    .option('--chat <id>', 'Chat ID to send response to')
    .option('--group <name>', 'Named group (resolves to chat ID)')
    .requiredOption('--message <text>', 'Message to send')
    .option('--reset', 'Start a fresh conversation (new session ID)')
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
      const sessionId = opts.reset
        ? `telegram-${chatId}-${opts.name}-${crypto.randomUUID().slice(0, 8)}`
        : `telegram-${chatId}-${opts.name}`;

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
            await bot.api.sendMessage(chatId, parsed.text, { parse_mode: 'Markdown' });
          } catch {
            await bot.api.sendMessage(chatId, parsed.text);
          }
        }

        for (const filePath of parsed.filePaths) {
          if (!fs.existsSync(filePath)) continue;
          const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
          if (IMAGE_EXTS.has(ext)) {
            await bot.api.sendPhoto(chatId, new InputFile(filePath));
          } else {
            await bot.api.sendDocument(chatId, new InputFile(filePath));
          }
        }

        if (opts.json) {
          console.log(JSON.stringify({
            instance: opts.name,
            chat: chatId,
            message: opts.message,
            response: parsed.text,
            files: parsed.filePaths,
          }, null, 2));
        } else {
          console.log(`\n${parsed.text ?? '(no text)'}`);
          if (parsed.filePaths.length > 0) {
            console.log(`\nFiles sent: ${parsed.filePaths.join(', ')}`);
          }
          console.log(`\n→ Delivered to chat ${chatId} via @${opts.name}`);
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
