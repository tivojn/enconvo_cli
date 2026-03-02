import { Command } from 'commander';
import { getPackageVersion, getEnConvoAppVersion } from './info';

export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Show CLI and EnConvo app version information')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const cliVersion = getPackageVersion();
      const appVersion = getEnConvoAppVersion();
      const nodeVersion = process.version;

      if (opts.json) {
        console.log(JSON.stringify({
          cli: cliVersion,
          enconvoApp: appVersion,
          node: nodeVersion,
          platform: process.platform,
          arch: process.arch,
        }, null, 2));
      } else {
        console.log(`enconvo-cli  ${cliVersion}`);
        console.log(`EnConvo.app  ${appVersion ?? 'not found'}`);
        console.log(`Node.js      ${nodeVersion}`);
        console.log(`Platform     ${process.platform} ${process.arch}`);
      }
    });
}
