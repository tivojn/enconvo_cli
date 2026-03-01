import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ENCONVO_APP_PLIST } from '../config/paths';

export function registerVersionCommand(program: Command): void {
  program
    .command('version')
    .description('Show CLI and EnConvo app version information')
    .option('--json', 'Output as JSON')
    .action((opts) => {
      const cliVersion = getCliVersion();
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

function getCliVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function getEnConvoAppVersion(): string | null {
  try {
    const content = fs.readFileSync(ENCONVO_APP_PLIST, 'utf-8');
    const versionMatch = content.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
    return versionMatch?.[1] ?? null;
  } catch {
    return null;
  }
}
