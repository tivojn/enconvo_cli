import { Client, Events, GatewayIntentBits } from 'discord.js';
import { ChannelAdapter, ChannelInfo, ChannelCapabilities, ChannelStatusResult, ChannelResolveResult } from '../../types/channel';
import { buildLogPaths, buildServiceLabel, formatUptime } from '../shared/adapter-helpers';

export class DiscordAdapter implements ChannelAdapter {
  private client: Client | null = null;
  private startedAt: Date | null = null;
  public instanceName: string | undefined;

  readonly info: ChannelInfo = {
    name: 'discord',
    displayName: 'Discord',
    version: '1.0.0',
    description: 'Discord bot channel via discord.js',
  };

  readonly capabilities: ChannelCapabilities = {
    text: true,
    images: true,
    documents: true,
    audio: false,
    video: false,
    groupChats: true,
    multiAccount: true,
  };

  async start(config: Record<string, unknown>): Promise<void> {
    const token = config.token as string;
    if (!token) throw new Error('Discord bot token is required');

    const agentPath = config.agent as string | undefined;
    const allowedUserIds = config.allowedUserIds as (number | string)[] | undefined;

    const { createDiscordBot } = await import('./bot');
    const { client, loginPromise } = createDiscordBot(token, agentPath, allowedUserIds, this.instanceName);
    this.client = client;
    this.startedAt = new Date();

    await loginPromise;
  }

  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.startedAt = null;
    }
  }

  async getStatus(probe?: boolean): Promise<ChannelStatusResult> {
    const running = this.client !== null;
    const details: Record<string, string> = {};

    if (running && this.startedAt) {
      details.uptime = formatUptime(this.startedAt);
    }

    if (this.instanceName) {
      details.instance = this.instanceName;
    }

    if (probe && this.client) {
      try {
        const user = this.client.user;
        if (user) {
          details.botTag = user.tag;
          details.botName = user.displayName ?? user.username;
        }
      } catch (err) {
        return { running, details, error: `Probe failed: ${err}` };
      }
    }

    return { running, details };
  }

  async validateCredentials(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    const token = config.token as string;
    if (!token) return { valid: false, error: 'Token is required' };

    const tempClient = new Client({ intents: [GatewayIntentBits.Guilds] });

    try {
      const readyPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Login timed out after 15s')), 15000);
        tempClient.once(Events.ClientReady, (c) => {
          clearTimeout(timeout);
          resolve(c.user.tag);
        });
      });

      await tempClient.login(token);
      const tag = await readyPromise;
      console.log(`Token valid: ${tag}`);
      tempClient.destroy();
      return { valid: true };
    } catch (err) {
      tempClient.destroy();
      return { valid: false, error: `Invalid token: ${err}` };
    }
  }

  getLogPaths(): { stdout: string; stderr: string } {
    return buildLogPaths('discord', this.instanceName);
  }

  async resolve(identifier: string, kind: string): Promise<ChannelResolveResult> {
    if (!this.client) {
      return { found: false, identifier, kind, details: { error: 'Bot not running' } };
    }

    try {
      const channel = await this.client.channels.fetch(identifier);
      if (!channel) {
        return { found: false, identifier, kind };
      }

      const details: Record<string, string> = { type: channel.type.toString(), id: channel.id };
      let displayName = identifier;

      if ('name' in channel && channel.name) {
        displayName = channel.name as string;
      }
      if ('guild' in channel && channel.guild) {
        details.guild = channel.guild.name;
      }

      return { found: true, identifier, kind: channel.type.toString(), displayName, details };
    } catch {
      return { found: false, identifier, kind };
    }
  }

  getServiceLabel(): string {
    return buildServiceLabel('discord', this.instanceName);
  }
}
