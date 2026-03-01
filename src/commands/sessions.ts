import { Command } from 'commander';
import { listChannelInstances, loadGlobalConfig } from '../config/store';

export function registerSessionsCommand(program: Command): void {
  program
    .command('sessions')
    .description('List active channel sessions')
    .option('--json', 'Output as JSON')
    .action((opts: { json?: boolean }) => {
      const config = loadGlobalConfig();
      const sessions: Array<{ channel: string; instance: string; agent: string; enabled: boolean }> = [];

      for (const channelName of Object.keys(config.channels ?? {})) {
        const instances = listChannelInstances(channelName);
        for (const [name, inst] of Object.entries(instances)) {
          sessions.push({
            channel: channelName,
            instance: name,
            agent: inst.agent || '(none)',
            enabled: inst.enabled,
          });
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ sessions }, null, 2));
        return;
      }

      if (sessions.length === 0) {
        console.log('No channel sessions configured.');
        return;
      }

      console.log('Channel Sessions:\n');
      for (const s of sessions) {
        const status = s.enabled ? 'enabled' : 'disabled';
        console.log(`  ${s.channel}/${s.instance} → ${s.agent} [${status}]`);
      }
      console.log(`\nTotal: ${sessions.length} session(s)`);
    });
}
