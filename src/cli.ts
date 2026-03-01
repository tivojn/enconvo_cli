#!/usr/bin/env -S npx tsx
import { Command } from 'commander';
import { registerChannelsCommands } from './commands/channels/index';
import { registerAgentsCommands } from './commands/agents/index';
import { registerConfigCommands } from './commands/config/index';
import { registerMessageCommands } from './commands/message/index';
import { registerStatusCommand } from './commands/status';
import { registerDoctorCommand } from './commands/doctor';
import { registerHealthCommand } from './commands/health';
import { registerSessionsCommand } from './commands/sessions';
import { registerLogsCommand } from './commands/logs';
import { registerInfoCommand } from './commands/info';
import { registerConfigureCommand } from './commands/configure';
import { registerExportCommand, registerImportCommand } from './commands/export-import';
import { registerVersionCommand } from './commands/version';

const program = new Command();

program
  .name('enconvo')
  .description('EnConvo CLI — manage channels, agents, and more')
  .version('2.0.0');

registerChannelsCommands(program);
registerAgentsCommands(program);
registerConfigCommands(program);
registerMessageCommands(program);
registerStatusCommand(program);
registerDoctorCommand(program);
registerHealthCommand(program);
registerSessionsCommand(program);
registerLogsCommand(program);
registerInfoCommand(program);
registerConfigureCommand(program);
registerExportCommand(program);
registerImportCommand(program);
registerVersionCommand(program);

program.parse();
