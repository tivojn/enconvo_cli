import { Command } from 'commander';
import { loadGlobalConfig, saveGlobalConfig } from '../../config/store';
import { setByPath, parseValue } from '../../utils/dot-path';

export function registerSet(parent: Command): void {
  parent
    .command('set <path> <value>')
    .description('Set a config value by dot-separated path')
    .option('--json', 'Parse value as strict JSON')
    .action((dotPath: string, rawValue: string, opts: { json?: boolean }) => {
      const config = loadGlobalConfig();

      let value: unknown;
      if (opts.json) {
        try {
          value = JSON.parse(rawValue);
        } catch {
          console.error(`Invalid JSON: ${rawValue}`);
          process.exit(1);
        }
      } else {
        value = parseValue(rawValue);
      }

      setByPath(config as unknown as Record<string, unknown>, dotPath, value);
      saveGlobalConfig(config);
      console.log(`Set ${dotPath} = ${JSON.stringify(value)}`);
    });
}
