import { Command } from 'commander';
import { registerList } from './list';
import { registerStatus } from './status';
import { registerAdd } from './add';
import { registerRemove } from './remove';
import { registerLogin } from './login';
import { registerLogout } from './logout';
import { registerCapabilities } from './capabilities';
import { registerResolve } from './resolve';
import { registerLogs } from './logs';
import { registerSend } from './send';

export function registerChannelsCommands(program: Command): void {
  const channels = program
    .command('channels')
    .description('Manage messaging channels (Telegram, etc.)');

  registerList(channels);
  registerStatus(channels);
  registerAdd(channels);
  registerRemove(channels);
  registerLogin(channels);
  registerLogout(channels);
  registerCapabilities(channels);
  registerResolve(channels);
  registerLogs(channels);
  registerSend(channels);
}
