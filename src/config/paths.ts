import * as path from 'path';
import * as os from 'os';

export const ENCONVO_CLI_DIR = path.join(os.homedir(), '.enconvo_cli');
export const ENCONVO_CLI_CONFIG_PATH = path.join(ENCONVO_CLI_DIR, 'config.json');
export const AGENTS_CONFIG_PATH = path.join(ENCONVO_CLI_DIR, 'agents.json');
export const BACKUPS_DIR = path.join(ENCONVO_CLI_DIR, 'backups');
export const WORKSPACES_DIR = ENCONVO_CLI_DIR; // workspaces live directly in ~/.enconvo_cli/
export const TEAM_KB_DIR = path.join(ENCONVO_CLI_DIR, 'kb');
export const ENCONVO_PREFERENCES_DIR = path.join(os.homedir(), '.config', 'enconvo', 'installed_preferences');
export const ENCONVO_COMMANDS_DIR = path.join(os.homedir(), '.config', 'enconvo', 'installed_commands');
export const ENCONVO_APP_PLIST = '/Applications/EnConvo.app/Contents/Info.plist';
