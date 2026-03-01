import { Command } from 'commander';
import { registerList } from './list';
import { registerAdd } from './add';
import { registerDelete } from './delete';
import { registerSetIdentity } from './set-identity';
import { registerSync } from './sync';
import { registerBindings } from './bindings';
import { registerBind } from './bind';
import { registerUnbind } from './unbind';
import { registerRefresh } from './refresh';
import { registerCheck } from './check';

export function registerAgentsCommands(program: Command): void {
  const agents = program
    .command('agents')
    .description('Manage the agent team roster and workspaces');

  registerList(agents);
  registerAdd(agents);
  registerDelete(agents);
  registerSetIdentity(agents);
  registerSync(agents);
  registerBindings(agents);
  registerBind(agents);
  registerUnbind(agents);
  registerRefresh(agents);
  registerCheck(agents);
}
