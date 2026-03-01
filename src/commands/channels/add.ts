import { Command } from 'commander';
import { getAdapter } from '../../channels/registry';
import { setChannelInstance, getChannelInstance, InstanceConfig } from '../../config/store';

export function registerAdd(parent: Command): void {
  parent
    .command('add')
    .description('Configure a channel instance')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis, elena)')
    .option('--token <token>', 'Bot/API token')
    .option('--agent <path>', 'Agent path (e.g. chat_with_ai/chat)')
    .option('--validate', 'Validate credentials before saving')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const adapter = getAdapter(opts.channel);
      if (!adapter) {
        const msg = `Unknown channel: ${opts.channel}`;
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      const existing = getChannelInstance(opts.channel, opts.name);

      const instance: InstanceConfig = {
        enabled: existing?.enabled ?? true,
        token: opts.token ?? existing?.token ?? '',
        agent: opts.agent ?? existing?.agent ?? '',
        allowedUserIds: existing?.allowedUserIds ?? [],
        service: existing?.service ?? {
          plistLabel: `com.enconvo.${opts.channel}-${opts.name}`,
          logPath: `~/Library/Logs/enconvo-${opts.channel}-${opts.name}.log`,
          errorLogPath: `~/Library/Logs/enconvo-${opts.channel}-${opts.name}-error.log`,
        },
      };

      if (!instance.token) {
        const msg = 'Token is required. Use --token <token>';
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      // Validate if requested
      if (opts.validate) {
        console.log('Validating credentials...');
        const result = await adapter.validateCredentials({ token: instance.token });
        if (!result.valid) {
          const msg = `Validation failed: ${result.error}`;
          if (opts.json) {
            console.log(JSON.stringify({ error: msg }));
          } else {
            console.error(msg);
          }
          process.exit(1);
        }
      }

      setChannelInstance(opts.channel, opts.name, instance);

      const output = { channel: opts.channel, instance: opts.name, action: existing ? 'updated' : 'added', config: instance };
      if (opts.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(`Instance "${opts.name}" for channel "${opts.channel}" configured and enabled.`);
        if (instance.agent) {
          console.log(`  Agent: ${instance.agent}`);
        }
        console.log(`Config saved to ~/.enconvo_cli/config.json`);
      }
    });
}
