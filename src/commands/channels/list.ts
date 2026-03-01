import { Command } from 'commander';
import { listAdapters } from '../../channels/registry';
import { loadGlobalConfig } from '../../config/store';

export function registerList(parent: Command): void {
  parent
    .command('list')
    .description('List available channels and their instances')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const adapters = listAdapters();
      const config = loadGlobalConfig();

      const results = adapters.map((adapter) => {
        const channelData = config.channels[adapter.info.name];
        const instances = channelData?.instances ?? {};

        const instanceList = Object.entries(instances).map(([name, inst]) => ({
          name,
          enabled: inst.enabled,
          agent: inst.agent || '(not set)',
        }));

        return {
          channel: adapter.info.name,
          displayName: adapter.info.displayName,
          version: adapter.info.version,
          description: adapter.info.description,
          instances: instanceList,
        };
      });

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      if (results.length === 0) {
        console.log('No channels available.');
        return;
      }

      console.log('Available channels:\n');
      for (const ch of results) {
        console.log(`  ${ch.displayName} (${ch.channel}) v${ch.version}`);
        console.log(`    ${ch.description}`);

        if (ch.instances.length === 0) {
          console.log('    Instances: none configured');
        } else {
          console.log('    Instances:');
          for (const inst of ch.instances) {
            const status = inst.enabled ? 'enabled' : 'disabled';
            console.log(`      ${inst.name} — ${status} — agent: ${inst.agent}`);
          }
        }
        console.log();
      }
    });
}
