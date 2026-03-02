import { Command } from 'commander';
import * as fs from 'fs';
import { loadGlobalConfig, GlobalConfig } from '../config/store';
import { loadAgentsRoster, AgentsRoster } from '../config/agent-store';
import { ENCONVO_CLI_DIR, ENCONVO_CLI_CONFIG_PATH, AGENTS_CONFIG_PATH } from '../config/paths';

export interface Issue {
  level: 'error' | 'warn' | 'info';
  message: string;
  fix?: string;
}

/**
 * Detect configuration issues (pure function, no side effects).
 * Checks: config dir, config file, version, URL, channel tokens, allowed users,
 * duplicate agent paths, roster leads, workspace existence.
 */
export function detectIssues(opts: {
  configDirExists: boolean;
  configFileExists: boolean;
  agentsFileExists: boolean;
  config: GlobalConfig | null;
  roster: AgentsRoster | null;
  rosterParseError?: string;
}): Issue[] {
  const issues: Issue[] = [];

  if (!opts.configDirExists) {
    issues.push({
      level: 'error',
      message: 'Config directory missing',
      fix: `Run: mkdir -p ${ENCONVO_CLI_DIR}`,
    });
  }

  if (!opts.configFileExists) {
    issues.push({
      level: 'error',
      message: 'Config file missing — run any command to auto-create',
    });
  }

  const config = opts.config;
  if (config) {
    if (config.version < 2) {
      issues.push({ level: 'warn', message: 'Config using legacy v1 format — auto-migration will run on next save' });
    }

    if (!config.enconvo?.url) {
      issues.push({ level: 'error', message: 'EnConvo URL not configured' });
    }

    // Check channel instances for missing tokens
    for (const channelName of Object.keys(config.channels ?? {})) {
      const instances = config.channels[channelName]?.instances ?? {};
      for (const [name, inst] of Object.entries(instances)) {
        if (!inst.token) {
          issues.push({ level: 'error', message: `${channelName}.${name}: missing token` });
        }
        if (inst.enabled && inst.allowedUserIds.length === 0) {
          issues.push({ level: 'warn', message: `${channelName}.${name}: no allowed users — bot will ignore all messages` });
        }
      }
    }

    // Check for duplicate agents across instances
    const agentPaths = new Map<string, string[]>();
    for (const channelName of Object.keys(config.channels ?? {})) {
      const instances = config.channels[channelName]?.instances ?? {};
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
  if (opts.rosterParseError) {
    issues.push({ level: 'error', message: `Agents roster parse error: ${opts.rosterParseError}` });
  } else if (opts.roster) {
    const leads = opts.roster.members.filter(m => m.isLead);
    if (leads.length === 0) {
      issues.push({ level: 'warn', message: 'No team lead configured' });
    }
    if (leads.length > 1) {
      issues.push({ level: 'info', message: `Multiple team leads: ${leads.map(l => l.name).join(', ')}` });
    }

    for (const member of opts.roster.members) {
      if (member.workspacePath && !fs.existsSync(member.workspacePath)) {
        issues.push({
          level: 'warn',
          message: `Agent "${member.id}" workspace missing: ${member.workspacePath}`,
          fix: `Run: enconvo agents sync --regen`,
        });
      }
    }
  } else if (!opts.agentsFileExists) {
    issues.push({ level: 'info', message: 'No agents roster found — run: enconvo agents add' });
  }

  return issues;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check configuration and report issues')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let config: GlobalConfig | null = null;
      try {
        config = loadGlobalConfig();
      } catch (e) {
        // Will be handled via detectIssues
      }

      let roster: AgentsRoster | null = null;
      let rosterParseError: string | undefined;
      if (fs.existsSync(AGENTS_CONFIG_PATH)) {
        try {
          roster = loadAgentsRoster();
        } catch (e) {
          rosterParseError = e instanceof Error ? e.message : String(e);
        }
      }

      const issues = detectIssues({
        configDirExists: fs.existsSync(ENCONVO_CLI_DIR),
        configFileExists: fs.existsSync(ENCONVO_CLI_CONFIG_PATH),
        agentsFileExists: fs.existsSync(AGENTS_CONFIG_PATH),
        config,
        roster,
        rosterParseError,
      });

      // Probe EnConvo (network — not in detectIssues)
      if (config) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          await fetch(`${config.enconvo.url}/health`, { signal: controller.signal });
          clearTimeout(timer);
        } catch {
          issues.push({ level: 'warn', message: `EnConvo not reachable at ${config.enconvo.url} — is it running?` });
        }
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
