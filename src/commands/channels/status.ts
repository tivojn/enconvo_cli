import { Command } from 'commander';
import { listAdapterNames, createAdapterInstance } from '../../channels/registry';
import { listChannelInstances } from '../../config/store';
import { execSync } from 'child_process';

export function registerStatus(parent: Command): void {
  parent
    .command('status')
    .description('Show runtime status of channel instances')
    .option('--probe', 'Probe live connection (requires running service)')
    .option('--channel <name>', 'Check a specific channel type')
    .option('--name <name>', 'Check a specific instance')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const channelNames = opts.channel ? [opts.channel] : listAdapterNames();
      const results: Record<string, unknown>[] = [];

      for (const channelName of channelNames) {
        const instances = listChannelInstances(channelName);
        const instanceNames = opts.name ? [opts.name] : Object.keys(instances);

        if (instanceNames.length === 0) {
          results.push({ channel: channelName, instances: 'none configured' });
          continue;
        }

        for (const instName of instanceNames) {
          const instConfig = instances[instName];
          if (!instConfig && opts.name) {
            results.push({ channel: channelName, instance: instName, error: 'Instance not configured' });
            continue;
          }
          if (!instConfig) continue;

          const adapter = createAdapterInstance(channelName, instName);

          // Check if launchd service is running
          let serviceRunning = false;
          if (adapter) {
            try {
              const label = adapter.getServiceLabel();
              const output = execSync(`launchctl list ${label} 2>/dev/null`, { encoding: 'utf-8' });
              serviceRunning = !output.includes('"ExitCode"') || output.includes('"PID"');
            } catch {
              // Service not loaded
            }
          }

          const result: Record<string, unknown> = {
            channel: channelName,
            instance: instName,
            enabled: instConfig.enabled,
            agent: instConfig.agent || '(not set)',
            serviceRunning,
          };

          if (opts.probe && serviceRunning && adapter) {
            const logs = adapter.getLogPaths();
            result.logPath = logs.stdout;
            result.probe = 'Service is running (use `enconvo channels logs` to inspect)';
          }

          results.push(result);
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      for (const r of results) {
        if (r.error) {
          console.log(`${r.channel}/${r.instance}: ${r.error}`);
          continue;
        }
        if (r.instances === 'none configured') {
          console.log(`${r.channel}: no instances configured`);
          console.log();
          continue;
        }
        console.log(`${r.channel}/${r.instance}:`);
        console.log(`  Enabled:  ${r.enabled ? 'yes' : 'no'}`);
        console.log(`  Agent:    ${r.agent}`);
        console.log(`  Service:  ${r.serviceRunning ? 'running' : 'stopped'}`);
        if (r.probe) console.log(`  Probe:    ${r.probe}`);
        console.log();
      }
    });
}
