import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { loadAgentsRoster, AgentMember } from '../../config/agent-store';
import { generatePrompt } from '../../services/team-prompt';
import { ENCONVO_PREFERENCES_DIR, BACKUPS_DIR } from '../../config/paths';

export function registerSync(parent: Command): void {
  parent
    .command('sync')
    .description('Sync agent prompts to EnConvo preferences')
    .option('--dry-run', 'Preview prompts without writing')
    .option('--agent <id>', 'Sync a specific agent only')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const roster = loadAgentsRoster();

      if (roster.members.length === 0) {
        if (opts.json) {
          console.log(JSON.stringify({ error: 'No agents configured' }));
        } else {
          console.error('No agents configured. Run "enconvo agents add" first.');
        }
        process.exit(1);
      }

      let targets: AgentMember[];
      if (opts.agent) {
        const agent = roster.members.find((m) => m.id === opts.agent);
        if (!agent) {
          const msg = `Agent "${opts.agent}" not found`;
          if (opts.json) {
            console.log(JSON.stringify({ error: msg }));
          } else {
            console.error(msg);
          }
          process.exit(1);
        }
        targets = [agent];
      } else {
        targets = roster.members;
      }

      const results: Array<{ id: string; preferenceKey: string; status: string; prompt?: string }> = [];

      for (const agent of targets) {
        const prompt = generatePrompt(agent);
        const prefFile = path.join(ENCONVO_PREFERENCES_DIR, `${agent.preferenceKey}.json`);

        if (opts.dryRun) {
          results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'dry-run', prompt });

          if (!opts.json) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`${agent.emoji} ${agent.name} (${agent.id})`);
            console.log(`Preference: ${agent.preferenceKey}`);
            console.log(`File: ${prefFile}`);
            console.log(`${'='.repeat(60)}`);
            console.log(prompt);
          }
          continue;
        }

        // Check if preference file exists
        if (!fs.existsSync(prefFile)) {
          results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'skipped — preference file not found' });
          if (!opts.json) {
            console.log(`  ${agent.emoji} ${agent.name}: skipped — ${prefFile} not found`);
          }
          continue;
        }

        try {
          // Read existing preference
          const raw = fs.readFileSync(prefFile, 'utf-8');
          const pref = JSON.parse(raw);

          // Backup before modifying
          if (!fs.existsSync(BACKUPS_DIR)) {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
          }
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(BACKUPS_DIR, `${agent.preferenceKey}_${ts}.json`);
          fs.writeFileSync(backupFile, raw);

          // Update prompt field only
          pref.prompt = prompt;
          fs.writeFileSync(prefFile, JSON.stringify(pref, null, 2));

          results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: 'synced' });

          if (!opts.json) {
            console.log(`  ${agent.emoji} ${agent.name}: synced → ${prefFile}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({ id: agent.id, preferenceKey: agent.preferenceKey, status: `error: ${msg}` });
          if (!opts.json) {
            console.error(`  ${agent.emoji} ${agent.name}: error — ${msg}`);
          }
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ action: opts.dryRun ? 'dry-run' : 'sync', results }, null, 2));
      } else if (!opts.dryRun) {
        console.log(`\nSynced ${results.filter((r) => r.status === 'synced').length}/${targets.length} agents.`);
      }
    });
}
