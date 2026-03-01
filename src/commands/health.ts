import { Command } from 'commander';
import { loadGlobalConfig } from '../config/store';

export function registerHealthCommand(program: Command): void {
  program
    .command('health')
    .description('Check EnConvo API connectivity')
    .option('--json', 'Output as JSON')
    .option('--timeout <ms>', 'Timeout in milliseconds', '5000')
    .action(async (opts: { json?: boolean; timeout: string }) => {
      const config = loadGlobalConfig();
      const url = config.enconvo.url;
      const timeout = parseInt(opts.timeout, 10);
      const start = Date.now();

      let reachable = false;
      let statusCode: number | null = null;
      let error: string | null = null;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const resp = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timer);
        reachable = resp.ok;
        statusCode = resp.status;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const latency = Date.now() - start;

      if (opts.json) {
        console.log(JSON.stringify({ url, reachable, statusCode, latency, error }, null, 2));
        return;
      }

      if (reachable) {
        console.log(`EnConvo is reachable at ${url} (${latency}ms)`);
      } else {
        console.log(`EnConvo is NOT reachable at ${url}`);
        if (error) console.log(`  Error: ${error}`);
        process.exit(1);
      }
    });
}
