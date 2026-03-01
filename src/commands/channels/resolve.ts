import { Command } from 'commander';
import { createAdapterInstance } from '../../channels/registry';

export function registerResolve(parent: Command): void {
  parent
    .command('resolve')
    .description('Resolve a user or group identifier')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis)')
    .argument('<identifier>', 'User/group identifier to resolve (e.g. @username, chat ID)')
    .option('--kind <kind>', 'Type hint (user, group, channel)', 'user')
    .option('--json', 'Output as JSON')
    .action(async (identifier: string, opts) => {
      const adapter = createAdapterInstance(opts.channel, opts.name);
      if (!adapter) {
        if (opts.json) {
          console.log(JSON.stringify({ error: `Unknown channel: ${opts.channel}` }));
        } else {
          console.error(`Unknown channel: ${opts.channel}`);
        }
        process.exit(1);
      }

      const result = await adapter.resolve(identifier, opts.kind);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!result.found) {
        console.log(`Could not resolve "${identifier}" on ${opts.channel}/${opts.name}.`);
        if (result.details?.error) console.log(`  Reason: ${result.details.error}`);
      } else {
        console.log(`Resolved: ${result.displayName ?? identifier}`);
        console.log(`  Kind: ${result.kind}`);
        if (result.details) {
          for (const [k, v] of Object.entries(result.details)) {
            console.log(`  ${k}: ${v}`);
          }
        }
      }
    });
}
