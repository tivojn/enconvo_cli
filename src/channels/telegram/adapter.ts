import { Bot } from 'grammy';
import * as os from 'os';
import * as path from 'path';
import { ChannelAdapter, ChannelInfo, ChannelCapabilities, ChannelStatusResult, ChannelResolveResult } from '../../types/channel';

export class TelegramAdapter implements ChannelAdapter {
  private bot: Bot | null = null;
  private startedAt: Date | null = null;
  public instanceName: string | undefined;

  readonly info: ChannelInfo = {
    name: 'telegram',
    displayName: 'Telegram',
    version: '1.0.0',
    description: 'Telegram bot channel via Grammy (long polling)',
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
    if (!token) throw new Error('Telegram bot token is required');

    const agentPath = config.agent as string | undefined;
    const allowedUserIds = config.allowedUserIds as number[] | undefined;

    if (agentPath) {
      // Pinned mode — pass token, agentPath, allowedUserIds, instanceName directly
      const { createBot } = await import('./bot');
      this.bot = createBot(token, agentPath, allowedUserIds, this.instanceName);
    } else {
      // Legacy mode — set env var for config.ts, no pinned agent
      process.env.BOT_TOKEN = token;
      const { createBot } = await import('./bot');
      this.bot = createBot();
    }

    this.startedAt = new Date();

    await this.bot.start({
      onStart: (info) => {
        const label = this.instanceName ? ` [${this.instanceName}]` : '';
        console.log(`Bot @${info.username}${label} is running (long polling)`);
      },
    });
  }

  async stop(): Promise<void> {
    if (this.bot) {
      this.bot.stop();
      this.bot = null;
      this.startedAt = null;
    }
  }

  async getStatus(probe?: boolean): Promise<ChannelStatusResult> {
    const running = this.bot !== null;
    const details: Record<string, string> = {};

    if (running && this.startedAt) {
      const uptimeMs = Date.now() - this.startedAt.getTime();
      const secs = Math.floor(uptimeMs / 1000);
      const mins = Math.floor(secs / 60);
      const hrs = Math.floor(mins / 60);
      details.uptime = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m ${secs % 60}s`;
    }

    if (this.instanceName) {
      details.instance = this.instanceName;
    }

    if (probe && this.bot) {
      try {
        const me = await this.bot.api.getMe();
        details.botUsername = `@${me.username}`;
        details.botName = me.first_name;
      } catch (err) {
        return { running, details, error: `Probe failed: ${err}` };
      }
    }

    return { running, details };
  }

  async validateCredentials(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    const token = config.token as string;
    if (!token) return { valid: false, error: 'Token is required' };

    try {
      const tempBot = new Bot(token);
      const me = await tempBot.api.getMe();
      console.log(`Token valid: @${me.username} (${me.first_name})`);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Invalid token: ${err}` };
    }
  }

  getLogPaths(): { stdout: string; stderr: string } {
    const suffix = this.instanceName ?? 'adapter';
    return {
      stdout: path.join(os.homedir(), `Library/Logs/enconvo-telegram-${suffix}.log`),
      stderr: path.join(os.homedir(), `Library/Logs/enconvo-telegram-${suffix}-error.log`),
    };
  }

  async resolve(identifier: string, kind: string): Promise<ChannelResolveResult> {
    if (!this.bot) {
      return { found: false, identifier, kind, details: { error: 'Bot not running' } };
    }

    try {
      const chat = await this.bot.api.getChat(identifier);
      return {
        found: true,
        identifier,
        kind: chat.type,
        displayName: 'title' in chat ? chat.title : ('first_name' in chat ? chat.first_name : identifier),
        details: { type: chat.type, id: String(chat.id) },
      };
    } catch {
      return { found: false, identifier, kind };
    }
  }

  getServiceLabel(): string {
    const suffix = this.instanceName ?? 'adapter';
    return `com.enconvo.telegram-${suffix}`;
  }
}
