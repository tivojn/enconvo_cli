import { Command } from 'commander';
import { unbindAgent, getAgent } from '../../config/agent-store';

export function registerUnbind(parent: Command): void {
  parent
    .command('unbind')
    .description('Remove a channel binding from an agent')
    .requiredOption('--agent-id <id>', 'Agent ID')
    .requiredOption('--channel <channel>', 'Channel name (telegram, discord)')
    .requiredOption('--instance <name>', 'Instance name in config')
    .action((opts: { agentId: string; channel: string; instance: string }) => {
      const agent = getAgent(opts.agentId);
      if (!agent) {
        console.error(`Agent "${opts.agentId}" not found`);
        process.exit(1);
      }

      const removed = unbindAgent(opts.agentId, opts.channel, opts.instance);
      if (removed) {
        console.log(`Unbound ${agent.emoji} ${agent.name} from ${opts.channel}/${opts.instance}`);
      } else {
        console.error(`No binding found for ${opts.channel}/${opts.instance}`);
        process.exit(1);
      }
    });
}
