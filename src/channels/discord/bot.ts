import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { shouldRespond } from './middleware/mention-gate';
import { handleCommand } from './handlers/commands';
import { createTextMessageHandler } from './handlers/message';
import { createMediaHandler } from './handlers/media';

/**
 * Create a Discord.js client with all handlers wired up.
 *
 * - token: Discord bot token
 * - agentPath: pinned EnConvo agent path (e.g. 'chat_with_ai/chat')
 * - allowedUserIds: if non-empty, only these Discord user IDs may interact
 * - instanceId: instance name for session namespacing
 *
 * Returns { client, loginPromise } — caller should await loginPromise.
 */
export function createDiscordBot(
  token: string,
  agentPath?: string,
  allowedUserIds?: (number | string)[],
  instanceId?: string,
) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Ready event — log bot tag
  const readyPromise = new Promise<void>((resolve) => {
    client.once(Events.ClientReady, (readyClient) => {
      const label = instanceId ? ` [${instanceId}]` : '';
      console.log(`Ready! Logged in as ${readyClient.user.tag}${label}`);
      resolve();
    });
  });

  // Wire up handlers
  const textHandler = createTextMessageHandler(client, agentPath, instanceId);
  const mediaHandler = createMediaHandler(agentPath, instanceId);

  client.on(Events.MessageCreate, async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Mention gate — only respond in DMs, when mentioned, replied to, or on !commands
    if (!(await shouldRespond(message, client))) return;

    // Auth check
    if (allowedUserIds && allowedUserIds.length > 0) {
      if (!allowedUserIds.map(String).includes(message.author.id)) {
        await message.reply('Access denied. Your user ID is not in the allowlist.');
        return;
      }
    }

    // Commands (!reset, !status, !help)
    const handled = await handleCommand(message, agentPath, instanceId);
    if (handled) return;

    // Media (attachments)
    if (message.attachments.size > 0) {
      await mediaHandler(message);
      return;
    }

    // Text
    await textHandler(message);
  });

  client.on('error', (err) => {
    console.error('Discord client error:', err);
  });

  const loginPromise = client.login(token).then(() => readyPromise);

  return { client, loginPromise };
}
