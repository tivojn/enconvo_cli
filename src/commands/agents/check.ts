import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Command } from 'commander';
import { loadAgentsRoster, AgentMember } from '../../config/agent-store';
import { loadGlobalConfig, saveGlobalConfig, EnConvoAppInfo } from '../../config/store';
import { getChannelInstance } from '../../config/store';
import {
  ENCONVO_PREFERENCES_DIR,
  ENCONVO_COMMANDS_DIR,
  ENCONVO_APP_PLIST,
  TEAM_KB_DIR,
} from '../../config/paths';

interface CheckResult {
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

interface AgentCheckReport {
  id: string;
  name: string;
  emoji: string;
  checks: CheckResult[];
}

interface VersionInfo {
  version: string;
  build: number;
}

function getEnConvoVersion(): VersionInfo | null {
  if (!fs.existsSync(ENCONVO_APP_PLIST)) return null;
  try {
    const version = execSync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${ENCONVO_APP_PLIST}"`,
      { encoding: 'utf-8' },
    ).trim();
    const buildStr = execSync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "${ENCONVO_APP_PLIST}"`,
      { encoding: 'utf-8' },
    ).trim();
    return { version, build: parseInt(buildStr, 10) || 0 };
  } catch {
    return null;
  }
}

function checkAgent(agent: AgentMember): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Command file exists
  const cmdFile = path.join(ENCONVO_COMMANDS_DIR, `${agent.preferenceKey}.json`);
  checks.push(
    fs.existsSync(cmdFile)
      ? { label: 'Command file', status: 'ok', detail: `${agent.preferenceKey}.json` }
      : { label: 'Command file', status: 'fail', detail: `${agent.preferenceKey}.json not found` },
  );

  // 2. Preference file exists
  const prefFile = path.join(ENCONVO_PREFERENCES_DIR, `${agent.preferenceKey}.json`);
  const prefExists = fs.existsSync(prefFile);
  checks.push(
    prefExists
      ? { label: 'Preference', status: 'ok', detail: `${agent.preferenceKey}.json` }
      : { label: 'Preference', status: 'fail', detail: `${agent.preferenceKey}.json not found` },
  );

  // 3. Prompt synced — check if preference prompt starts with expected header
  if (prefExists) {
    try {
      const pref = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
      const prompt: string = pref.prompt ?? '';
      const expectedStart = `You are ${agent.name}`;
      checks.push(
        prompt.startsWith(expectedStart)
          ? { label: 'Prompt synced', status: 'ok', detail: 'lean prompt detected' }
          : { label: 'Prompt synced', status: 'warn', detail: "prompt doesn't match (run: enconvo agents sync)" },
      );
    } catch {
      checks.push({ label: 'Prompt synced', status: 'fail', detail: 'could not read preference file' });
    }
  } else {
    checks.push({ label: 'Prompt synced', status: 'fail', detail: 'preference file missing' });
  }

  // 4. Workspace exists with key files
  const workspaceFiles = ['IDENTITY.md', 'SOUL.md', 'AGENTS.md'];
  const existingFiles = workspaceFiles.filter((f) => fs.existsSync(path.join(agent.workspacePath, f)));
  if (existingFiles.length === workspaceFiles.length) {
    checks.push({ label: 'Workspace', status: 'ok', detail: workspaceFiles.join(', ') });
  } else {
    const missing = workspaceFiles.filter((f) => !existingFiles.includes(f));
    checks.push({ label: 'Workspace', status: 'fail', detail: `missing: ${missing.join(', ')}` });
  }

  // 5. Telegram instance configured
  const instance = getChannelInstance('telegram', agent.bindings.instanceName);
  checks.push(
    instance
      ? { label: 'Telegram', status: 'ok', detail: `instance "${agent.bindings.instanceName}" configured` }
      : { label: 'Telegram', status: 'warn', detail: `instance "${agent.bindings.instanceName}" not found` },
  );

  return checks;
}

function checkTeamKB(): CheckResult {
  if (!fs.existsSync(TEAM_KB_DIR)) {
    return { label: 'Team KB', status: 'warn', detail: `${TEAM_KB_DIR} not found` };
  }
  const files = fs.readdirSync(TEAM_KB_DIR).filter((f) => !f.startsWith('.'));
  return {
    label: 'Team KB',
    status: 'ok',
    detail: `${TEAM_KB_DIR} (${files.length} file${files.length !== 1 ? 's' : ''})`,
  };
}

function checkEnConvoVersion(stored: EnConvoAppInfo | undefined): {
  result: CheckResult;
  current: VersionInfo | null;
  changed: boolean;
} {
  const current = getEnConvoVersion();
  if (!current) {
    return {
      result: { label: 'EnConvo app', status: 'warn', detail: 'not found at /Applications/EnConvo.app' },
      current: null,
      changed: false,
    };
  }

  const versionStr = `v${current.version} (build ${current.build})`;

  if (!stored) {
    return {
      result: { label: 'EnConvo app', status: 'ok', detail: `${versionStr} — first check, storing version` },
      current,
      changed: true,
    };
  }

  const changed = stored.version !== current.version || stored.build !== current.build;
  if (changed) {
    return {
      result: {
        label: 'EnConvo app',
        status: 'warn',
        detail: `${versionStr} — CHANGED from v${stored.version} (build ${stored.build})! Re-check agent paths.`,
      },
      current,
      changed: true,
    };
  }

  return {
    result: { label: 'EnConvo app', status: 'ok', detail: `${versionStr} — matches stored version` },
    current,
    changed: false,
  };
}

function checkApiReachable(url: string): CheckResult {
  try {
    execSync(`curl -sf -o /dev/null --connect-timeout 2 "${url}"`, { encoding: 'utf-8' });
    return { label: 'API reachable', status: 'ok', detail: url };
  } catch {
    return { label: 'API reachable', status: 'warn', detail: `${url} — not reachable` };
  }
}

const STATUS_ICON: Record<CheckResult['status'], string> = { ok: '\u2713', warn: '\u2717', fail: '\u2717' };

export function registerCheck(parent: Command): void {
  parent
    .command('check')
    .description('Health-check agents, EnConvo version, and API connectivity')
    .option('--agent <id>', 'Check a specific agent only')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const roster = loadAgentsRoster();
      const config = loadGlobalConfig();

      if (roster.members.length === 0) {
        outputError(opts, 'No agents configured. Run "enconvo agents add" first.');
        process.exit(1);
      }

      // Filter targets
      let targets: AgentMember[];
      if (opts.agent) {
        const agent = roster.members.find((m) => m.id === opts.agent);
        if (!agent) {
          outputError(opts, `Agent "${opts.agent}" not found`);
          process.exit(1);
        }
        targets = [agent];
      } else {
        targets = roster.members;
      }

      // Version check
      const versionCheck = checkEnConvoVersion(config.enconvoApp);

      // Update stored version if changed
      if (versionCheck.current && versionCheck.changed) {
        config.enconvoApp = {
          version: versionCheck.current.version,
          build: versionCheck.current.build,
          lastChecked: new Date().toISOString(),
        };
        saveGlobalConfig(config);
      } else if (config.enconvoApp) {
        // Update lastChecked timestamp
        config.enconvoApp.lastChecked = new Date().toISOString();
        saveGlobalConfig(config);
      }

      // API check
      const apiCheck = checkApiReachable(config.enconvo.url);

      // Agent checks
      const agentReports: AgentCheckReport[] = targets.map((agent) => ({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        checks: checkAgent(agent),
      }));

      // Team KB check
      const kbCheck = checkTeamKB();

      // Tally
      const allChecks = [
        versionCheck.result,
        apiCheck,
        ...agentReports.flatMap((r) => r.checks),
        kbCheck,
      ];
      const passed = allChecks.filter((c) => c.status === 'ok').length;
      const warnings = allChecks.filter((c) => c.status === 'warn').length;
      const failures = allChecks.filter((c) => c.status === 'fail').length;

      if (opts.json) {
        console.log(JSON.stringify({
          action: 'check',
          enconvoApp: versionCheck.current
            ? { version: versionCheck.current.version, build: versionCheck.current.build, changed: versionCheck.changed }
            : null,
          api: { status: apiCheck.status, url: config.enconvo.url },
          agents: agentReports.map((r) => ({
            id: r.id,
            name: r.name,
            checks: r.checks,
          })),
          teamKB: kbCheck,
          summary: { total: allChecks.length, passed, warnings, failures },
        }, null, 2));
        return;
      }

      // Human-readable output
      // Version line
      if (versionCheck.current) {
        const icon = STATUS_ICON[versionCheck.result.status];
        console.log(`EnConvo v${versionCheck.current.version} (build ${versionCheck.current.build}) — ${versionCheck.result.detail.split(' — ')[1] ?? 'detected'} ${icon}`);
      } else {
        console.log(`EnConvo app — ${versionCheck.result.detail}`);
      }

      // API line
      console.log(`API: ${apiCheck.status === 'ok' ? 'reachable' : 'not reachable'} (${config.enconvo.url}) ${STATUS_ICON[apiCheck.status]}`);
      console.log('');

      // Agent reports
      for (const report of agentReports) {
        console.log(`${report.emoji} ${report.name}:`);
        for (const check of report.checks) {
          const icon = STATUS_ICON[check.status];
          console.log(`  ${check.label.padEnd(15)} ${icon} ${check.detail}`);
        }
        console.log('');
      }

      // KB
      console.log(`Team KB: ${STATUS_ICON[kbCheck.status]} ${kbCheck.detail}`);
      console.log('');

      // Summary
      const parts: string[] = [];
      if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? 's' : ''}`);
      if (failures > 0) parts.push(`${failures} failure${failures !== 1 ? 's' : ''}`);
      const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      console.log(`All checks passed: ${passed}/${allChecks.length}${suffix}`);
    });
}

function outputError(opts: { json?: boolean }, msg: string): void {
  if (opts.json) {
    console.log(JSON.stringify({ error: msg }));
  } else {
    console.error(`Error: ${msg}`);
  }
}
