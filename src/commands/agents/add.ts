import { Command } from 'commander';
import { addAgent } from '../../config/agent-store';
import { createWorkspace } from '../../services/workspace';
import { loadAgentsRoster } from '../../config/agent-store';
import { getChannelInstance } from '../../config/store';

export function registerAdd(parent: Command): void {
  parent
    .command('add')
    .description('Add an agent to the team roster')
    .requiredOption('--id <id>', 'Agent ID (e.g. mavis, elena)')
    .requiredOption('--name <name>', 'Display name')
    .requiredOption('--role <role>', 'Role title')
    .requiredOption('--specialty <specialty>', 'Specialty description')
    .requiredOption('--agent-path <path>', 'EnConvo agent path (e.g. chat_with_ai/chat)')
    .requiredOption('--telegram-bot <username>', 'Telegram bot username (e.g. @Mavis_bot)')
    .requiredOption('--instance-name <name>', 'Instance name in config.json')
    .option('--channel <channel>', 'Channel type to validate instance against', 'telegram')
    .option('--chinese-name <name>', 'Chinese name')
    .option('--emoji <emoji>', 'Agent emoji', '🤖')
    .option('--lead', 'Designate as team lead')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      try {
        // Validate instance exists in config
        const instance = getChannelInstance(opts.channel, opts.instanceName);
        if (!instance) {
          const warn = `Warning: Instance "${opts.instanceName}" not found for channel "${opts.channel}". Binding may be invalid.`;
          if (!opts.json) console.warn(warn);
        }

        const member = addAgent({
          id: opts.id,
          name: opts.name,
          chineseName: opts.chineseName,
          emoji: opts.emoji,
          role: opts.role,
          specialty: opts.specialty,
          isLead: opts.lead ?? false,
          bindings: {
            agentPath: opts.agentPath,
            telegramBot: opts.telegramBot,
            instanceName: opts.instanceName,
          },
        });

        // Create workspace
        const roster = loadAgentsRoster();
        createWorkspace(member, roster);

        if (opts.json) {
          console.log(JSON.stringify({ action: 'added', agent: member }, null, 2));
        } else {
          console.log(`Added ${member.emoji} ${member.name} (${member.id}) as ${member.role}`);
          console.log(`  Workspace: ${member.workspacePath}`);
          console.log(`  Preference: ${member.preferenceKey}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(`Error: ${msg}`);
        }
        process.exit(1);
      }
    });
}
