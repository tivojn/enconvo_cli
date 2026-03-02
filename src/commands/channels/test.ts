import { Command } from 'commander';
import { getChannelInstance } from '../../config/store';
import { outputError } from '../../utils/command-output';

interface TestResult {
  channel: string;
  instance: string;
  success: boolean;
  botUsername?: string;
  error?: string;
  latencyMs?: number;
}

export async function testTelegram(token: string): Promise<{ success: boolean; botUsername?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}`, latencyMs };
    }
    const data = await res.json();
    if (data.ok && data.result?.username) {
      return { success: true, botUsername: `@${data.result.username}`, latencyMs };
    }
    return { success: false, error: data.description ?? 'Unknown error', latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

export async function testDiscord(token: string): Promise<{ success: boolean; botUsername?: string; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DiscordBot (https://enconvo.com, 1.0)',
      },
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}`, latencyMs };
    }
    const data = await res.json();
    if (data.username) {
      return { success: true, botUsername: `${data.username}#${data.discriminator ?? '0'}`, latencyMs };
    }
    return { success: false, error: 'Could not read bot info', latencyMs };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

export function registerTest(parent: Command): void {
  parent
    .command('test')
    .description('Test a channel instance connection (validates bot token)')
    .requiredOption('--channel <name>', 'Channel type (telegram, discord)')
    .requiredOption('--name <name>', 'Instance name')
    .option('--json', 'Output as JSON')
    .action(async (opts: { channel: string; name: string; json?: boolean }) => {
      const instance = getChannelInstance(opts.channel, opts.name);
      if (!instance) {
        outputError(opts, `Instance "${opts.name}" not found for channel "${opts.channel}"`);
        process.exit(1);
      }

      if (!instance.token) {
        outputError(opts, 'No token configured for this instance');
        process.exit(1);
      }

      if (!opts.json) console.log(`Testing ${opts.channel}/${opts.name}...`);

      let probe: { success: boolean; botUsername?: string; error?: string; latencyMs: number };

      switch (opts.channel) {
        case 'telegram':
          probe = await testTelegram(instance.token);
          break;
        case 'discord':
          probe = await testDiscord(instance.token);
          break;
        default:
          outputError(opts, `Channel "${opts.channel}" does not support test yet`);
          process.exit(1);
          return; // for TypeScript flow
      }

      const result: TestResult = {
        channel: opts.channel,
        instance: opts.name,
        success: probe.success,
        botUsername: probe.botUsername,
        error: probe.error,
        latencyMs: probe.latencyMs,
      };

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.success) {
        console.log(`  Connected as ${result.botUsername} (${result.latencyMs}ms)`);
        console.log(`  Agent: ${instance.agent}`);
        console.log(`  Enabled: ${instance.enabled}`);
      } else {
        console.error(`  Failed: ${result.error}`);
      }

      if (!result.success) process.exit(1);
    });
}
