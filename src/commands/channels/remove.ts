import { Command } from 'commander';
import { removeChannelInstance } from '../../config/store';

export function registerRemove(parent: Command): void {
  parent
    .command('remove')
    .description('Remove or disable a channel instance')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis)')
    .option('--delete', 'Permanently delete config (default: just disable)')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const removed = removeChannelInstance(opts.channel, opts.name, !!opts.delete);

      const result = {
        channel: opts.channel,
        instance: opts.name,
        action: opts.delete ? 'deleted' : 'disabled',
        success: removed,
      };

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!removed) {
        console.log(`Instance "${opts.name}" for channel "${opts.channel}" is not configured.`);
      } else if (opts.delete) {
        console.log(`Instance "${opts.name}" for channel "${opts.channel}" deleted.`);
      } else {
        console.log(`Instance "${opts.name}" for channel "${opts.channel}" disabled.`);
      }
    });
}
