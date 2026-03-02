import { Command } from 'commander';
import { Bot, InputFile } from 'grammy';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getChannelInstance, resolveChatId } from '../../config/store';
import { callEnConvo } from '../../services/enconvo-client';
import { parseResponse, ParsedResponse } from '../../services/response-parser';
import { loadGlobalConfig } from '../../config/store';
import { isImageFile } from '../../utils/file-types';
import { outputError } from '../../utils/command-output';

async function deliverTelegram(token: string, chatId: string, parsed: ParsedResponse): Promise<void> {
  const bot = new Bot(token);

  if (parsed.text) {
    try {
      await bot.api.sendMessage(chatId, parsed.text, { parse_mode: 'Markdown' });
    } catch {
      await bot.api.sendMessage(chatId, parsed.text);
    }
  }

  for (const filePath of parsed.filePaths) {
    if (!fs.existsSync(filePath)) continue;
    if (isImageFile(filePath)) {
      await bot.api.sendPhoto(chatId, new InputFile(filePath));
    } else {
      await bot.api.sendDocument(chatId, new InputFile(filePath));
    }
  }
}

async function deliverDiscord(token: string, channelId: string, parsed: ParsedResponse): Promise<void> {
  const baseUrl = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const headers = {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
  };

  if (parsed.text) {
    // Split at 2000 chars (Discord limit)
    const { splitMessage } = await import('../../channels/discord/utils/message-splitter');
    const chunks = splitMessage(parsed.text);
    for (const chunk of chunks) {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: chunk }),
      });
      if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`);
    }
  }

  for (const filePath of parsed.filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const form = new FormData();
    const fileData = fs.readFileSync(filePath);
    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
    form.append('files[0]', new Blob([fileData]), fileName);
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
      },
      body: form,
    });
    if (!res.ok) throw new Error(`Discord file upload ${res.status}: ${await res.text()}`);
  }
}

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
      const sessionId = opts.reset
        ? `${channel}-${chatId}-${opts.name}-${crypto.randomUUID().slice(0, 8)}`
        : `${channel}-${chatId}-${opts.name}`;

      try {
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

        // Deliver to the appropriate channel
        switch (channel) {
          case 'telegram':
            await deliverTelegram(instance.token, chatId, parsed);
            break;
          case 'discord':
            await deliverDiscord(instance.token, chatId, parsed);
            break;
          default:
            throw new Error(`Channel "${channel}" does not support send yet.`);
        }

        if (opts.json) {
          console.log(JSON.stringify({
            instance: opts.name,
            channel,
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
