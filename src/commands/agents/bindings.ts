import { Command } from 'commander';
import { loadAgentsRoster } from '../../config/agent-store';

export function registerBindings(parent: Command): void {
  parent
    .command('bindings')
    .description('Show agent-to-channel bindings')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ bindings: [] }));
        } else {
          console.log('No agents configured.');
        }
        return;
      }

      const bindings = roster.members.map((m) => ({
        id: m.id,
        name: m.name,
        emoji: m.emoji,
        agentPath: m.bindings.agentPath,
        telegramBot: m.bindings.telegramBot,
        instanceName: m.bindings.instanceName,
        preferenceKey: m.preferenceKey,
      }));

      if (opts.json) {
        console.log(JSON.stringify({ bindings }, null, 2));
        return;
      }

      console.log('Agent Bindings:\n');
      for (const b of bindings) {
        console.log(`  ${b.emoji} ${b.name} (${b.id})`);
        console.log(`    EnConvo:  ${b.agentPath} → ${b.preferenceKey}`);
        console.log(`    Telegram: ${b.telegramBot} → instance "${b.instanceName}"`);

        // Show multi-channel bindings if present
        const member = roster.members.find(m => m.id === b.id);
        if (member?.bindings.channelBindings?.length) {
          for (const cb of member.bindings.channelBindings) {
            if (cb.channel === 'telegram') continue; // Already shown above
            const handle = cb.botHandle ? ` (${cb.botHandle})` : '';
            console.log(`    ${cb.channel}: instance "${cb.instanceName}"${handle}`);
          }
        }
        console.log();
      }
    });
}
