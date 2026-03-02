import { Command } from 'commander';
import { createAdapterInstance } from '../../channels/registry';
import { getChannelInstance } from '../../config/store';
import { execSync } from 'child_process';
import { outputError } from '../../utils/command-output';

export function registerLogin(parent: Command): void {
  parent
    .command('login')
    .description('Start a channel instance')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis)')
    .option('-f, --foreground', 'Run in foreground (blocking)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const instanceConfig = getChannelInstance(opts.channel, opts.name);

      if (!instanceConfig) {
        outputError(opts, `Instance "${opts.name}" for channel "${opts.channel}" is not configured. Run: enconvo channels add --channel ${opts.channel} --name ${opts.name} --token <token> --agent <path>`);
        process.exit(1);
      }

      if (!instanceConfig.enabled) {
        outputError(opts, `Instance "${opts.name}" for channel "${opts.channel}" is disabled. Run: enconvo channels add --channel ${opts.channel} --name ${opts.name}`);
        process.exit(1);
      }

      const adapter = createAdapterInstance(opts.channel, opts.name);
      if (!adapter) {
        outputError(opts, `Unknown channel type: ${opts.channel}`);
        process.exit(1);
      }

      if (opts.foreground) {
        if (!opts.json) {
          console.log(`Starting ${opts.channel}/${opts.name} in foreground...`);
          if (instanceConfig.agent) {
            console.log(`  Agent: ${instanceConfig.agent}`);
          }
        }

        const shutdown = () => {
          console.log('\nShutting down...');
          adapter.stop().then(() => process.exit(0));
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        try {
          await adapter.start(instanceConfig as unknown as Record<string, unknown>);
        } catch (err) {
          outputError(opts, `Failed to start: ${err}`);
          process.exit(1);
        }
      } else {
        const label = adapter.getServiceLabel();
        try {
          execSync(`launchctl start ${label}`, { stdio: 'inherit' });
          const result = { channel: opts.channel, instance: opts.name, action: 'started', method: 'launchd', label };
          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(`Service "${label}" started.`);
            console.log(`Run 'enconvo channels logs --channel ${opts.channel} --name ${opts.name}' to view output.`);
          }
        } catch {
          outputError(opts, `Failed to start service "${label}". Is it installed?`);
          process.exit(1);
        }
      }
    });
}
