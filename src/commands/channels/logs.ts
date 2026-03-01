import { Command } from 'commander';
import { createAdapterInstance } from '../../channels/registry';
import { getChannelInstance } from '../../config/store';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

function expandHome(p: string): string {
  return p.replace(/^~/, os.homedir());
}

export function registerLogs(parent: Command): void {
  parent
    .command('logs')
    .description('Tail channel instance log files')
    .requiredOption('--channel <name>', 'Channel type (e.g. telegram)')
    .requiredOption('--name <name>', 'Instance name (e.g. mavis)')
    .option('--lines <n>', 'Number of lines to show', '50')
    .option('--follow', 'Follow log output (tail -f)', false)
    .option('--error', 'Show error log instead of stdout log')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      // Try to get log path from instance config first, fall back to adapter default
      const instanceConfig = getChannelInstance(opts.channel, opts.name);
      let logPath: string;

      if (instanceConfig?.service) {
        const raw = opts.error ? instanceConfig.service.errorLogPath : instanceConfig.service.logPath;
        logPath = expandHome(raw);
      } else {
        const adapter = createAdapterInstance(opts.channel, opts.name);
        if (!adapter) {
          if (opts.json) {
            console.log(JSON.stringify({ error: `Unknown channel: ${opts.channel}` }));
          } else {
            console.error(`Unknown channel: ${opts.channel}`);
          }
          process.exit(1);
        }
        const logPaths = adapter.getLogPaths();
        logPath = opts.error ? logPaths.stderr : logPaths.stdout;
      }

      if (!fs.existsSync(logPath)) {
        const msg = `Log file not found: ${logPath}`;
        if (opts.json) {
          console.log(JSON.stringify({ error: msg, path: logPath }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      if (opts.json) {
        try {
          const output = execSync(`tail -n ${opts.lines} "${logPath}"`, { encoding: 'utf-8' });
          console.log(JSON.stringify({ path: logPath, lines: output.split('\n').filter(Boolean) }));
        } catch {
          console.log(JSON.stringify({ error: `Failed to read log: ${logPath}` }));
        }
        return;
      }

      console.log(`Log: ${logPath}\n`);
      const followFlag = opts.follow ? '-f' : '';
      try {
        execSync(`tail ${followFlag} -n ${opts.lines} "${logPath}"`, { stdio: 'inherit' });
      } catch {
        // tail -f exits on SIGINT, that's fine
      }
    });
}
