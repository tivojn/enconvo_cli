import { Command } from 'commander';
import * as fs from 'fs';
import { loadGlobalConfig, listChannelInstances } from '../config/store';
import { loadAgentsRoster } from '../config/agent-store';
import { ENCONVO_CLI_DIR, ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH } from '../config/paths';

interface Issue {
  level: 'error' | 'warn' | 'info';
  message: string;
  fix?: string;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check configuration and report issues')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const issues: Issue[] = [];

      // Check config dir exists
      if (!fs.existsSync(ENCONVO_CLI_DIR)) {
        issues.push({
          level: 'error',
          message: 'Config directory missing',
          fix: `Run: mkdir -p ${ENCONVO_CLI_DIR}`,
        });
      }

      // Check config file
      if (!fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
        issues.push({
          level: 'error',
          message: 'Config file missing — run any command to auto-create',
        });
      }

      let config;
      try {
        config = loadGlobalConfig();
      } catch (e) {
        issues.push({
          level: 'error',
          message: `Config file parse error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }

      if (config) {
        // Check config version
        if (config.version < 2) {
          issues.push({ level: 'warn', message: 'Config using legacy v1 format — auto-migration will run on next save' });
        }

        // Check EnConvo URL
        if (!config.enconvo?.url) {
          issues.push({ level: 'error', message: 'EnConvo URL not configured' });
        }

        // Probe EnConvo
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          await fetch(`${config.enconvo.url}/health`, { signal: controller.signal });
          clearTimeout(timer);
        } catch {
          issues.push({ level: 'warn', message: `EnConvo not reachable at ${config.enconvo.url} — is it running?` });
        }

        // Check channel instances for missing tokens
        for (const channelName of Object.keys(config.channels ?? {})) {
          const instances = listChannelInstances(channelName);
          for (const [name, inst] of Object.entries(instances)) {
            if (!inst.token) {
              issues.push({ level: 'error', message: `${channelName}.${name}: missing token` });
            }
            if (inst.enabled && inst.allowedUserIds.length === 0) {
              issues.push({ level: 'warn', message: `${channelName}.${name}: no allowed users — bot will ignore all messages` });
            }
          }
        }
      }

      // Check for duplicate agents across instances
      if (config) {
        const agentPaths = new Map<string, string[]>();
        for (const channelName of Object.keys(config.channels ?? {})) {
          const instances = listChannelInstances(channelName);
          for (const [name, inst] of Object.entries(instances)) {
            if (inst.agent) {
              const key = inst.agent;
              if (!agentPaths.has(key)) agentPaths.set(key, []);
              agentPaths.get(key)!.push(`${channelName}/${name}`);
            }
          }
        }
        for (const [agent, usedBy] of agentPaths) {
          if (usedBy.length > 1) {
            issues.push({
              level: 'info',
              message: `Agent "${agent}" used by multiple instances: ${usedBy.join(', ')}`,
            });
          }
        }
      }

      // Check agents roster
      if (fs.existsSync(AGENTS_CONFIG_PATH)) {
        try {
          const roster = loadAgentsRoster();
          const leads = roster.members.filter(m => m.isLead);
          if (leads.length === 0) {
            issues.push({ level: 'warn', message: 'No team lead configured' });
          }
          if (leads.length > 1) {
            issues.push({ level: 'info', message: `Multiple team leads: ${leads.map(l => l.name).join(', ')}` });
          }

          // Check workspace existence
          for (const member of roster.members) {
            if (member.workspacePath && !fs.existsSync(member.workspacePath)) {
              issues.push({
                level: 'warn',
                message: `Agent "${member.id}" workspace missing: ${member.workspacePath}`,
                fix: `Run: enconvo agents sync --regen`,
              });
            }
          }
        } catch (e) {
          issues.push({
            level: 'error',
            message: `Agents roster parse error: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      } else {
        issues.push({ level: 'info', message: 'No agents roster found — run: enconvo agents add' });
      }

      // Output
      if (opts.json) {
        console.log(JSON.stringify({ issues }, null, 2));
        return;
      }

      if (issues.length === 0) {
        console.log('No issues found.');
        return;
      }

      const icons = { error: 'x', warn: '!', info: 'i' };
      for (const issue of issues) {
        const icon = icons[issue.level];
        console.log(`  [${icon}] ${issue.message}`);
        if (issue.fix) {
          console.log(`      Fix: ${issue.fix}`);
        }
      }

      const errors = issues.filter(i => i.level === 'error').length;
      const warns = issues.filter(i => i.level === 'warn').length;
      console.log();
      console.log(`${errors} error(s), ${warns} warning(s), ${issues.length - errors - warns} info`);

      if (errors > 0) process.exit(1);
    });
}
