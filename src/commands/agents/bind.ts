import { Command } from 'commander';
import { bindAgent, getAgent } from '../../config/agent-store';
import { getChannelInstance } from '../../config/store';

export function registerBind(parent: Command): void {
  parent
    .command('bind')
    .description('Add a channel binding to an agent')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--channel <channel>', 'Channel name (telegram, discord)')
    .requiredOption('--instance <name>', 'Instance name in config')
    .option('--bot-handle <handle>', 'Bot handle (e.g. @MyBot)')
    .action((opts: { agentId: string; channel: string; instance: string; botHandle?: string }) => {
      const agent = getAgent(opts.agentId);
      if (!agent) {
        console.error(`Agent "${opts.agentId}" not found`);
        process.exit(1);
      }

      // Validate instance exists
      const instance = getChannelInstance(opts.channel, opts.instance);
      if (!instance) {
        console.error(`Instance "${opts.instance}" not found for channel "${opts.channel}"`);
        process.exit(1);
      }

      const result = bindAgent(opts.agentId, {
        channel: opts.channel,
        instanceName: opts.instance,
        botHandle: opts.botHandle,
      });

      if (result) {
        console.log(`Bound ${result.emoji} ${result.name} → ${opts.channel}/${opts.instance}`);
      }
    });
}
