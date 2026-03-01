import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerChannelsCommands } from '../commands/channels/index';
import { registerAgentsCommands } from '../commands/agents/index';
import { registerConfigCommands } from '../commands/config/index';
import { registerMessageCommands } from '../commands/message/index';
import { registerStatusCommand } from '../commands/status';
import { registerDoctorCommand } from '../commands/doctor';
import { registerHealthCommand } from '../commands/health';
import { registerSessionsCommand } from '../commands/sessions';
import { registerLogsCommand } from '../commands/logs';
import { registerInfoCommand } from '../commands/info';
import { registerConfigureCommand } from '../commands/configure';
import { registerExportCommand, registerImportCommand } from '../commands/export-import';
import { registerVersionCommand } from '../commands/version';
import { registerResetCommand } from '../commands/reset';
import { registerCompletionsCommand } from '../commands/completions';

function getCommandNames(program: Command): string[] {
  return program.commands.map((c) => c.name());
}

function getSubcommandNames(program: Command, parentName: string): string[] {
  const parent = program.commands.find((c) => c.name() === parentName);
  if (!parent) return [];
  return parent.commands.map((c) => c.name());
}

describe('CLI command registration', () => {
  let program: Command;

  it('registers all top-level commands', () => {
    program = new Command();
    program.name('enconvo').version('2.0.0');

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
    registerResetCommand(program);
    registerCompletionsCommand(program);

    const names = getCommandNames(program);
    const expected = [
      'channels', 'agents', 'config', 'message',
      'status', 'doctor', 'health', 'sessions',
      'logs', 'info', 'configure', 'export', 'import',
      'version', 'reset', 'completions',
    ];
    for (const cmd of expected) {
      expect(names).toContain(cmd);
    }
  });

  it('registers all channels subcommands', () => {
    program = new Command();
    registerChannelsCommands(program);

    const subs = getSubcommandNames(program, 'channels');
    const expected = ['list', 'status', 'add', 'remove', 'login', 'logout', 'capabilities', 'resolve', 'logs', 'send', 'groups'];
    for (const cmd of expected) {
      expect(subs).toContain(cmd);
    }
    expect(subs.length).toBe(expected.length);
  });

  it('registers all agents subcommands', () => {
    program = new Command();
    registerAgentsCommands(program);

    const subs = getSubcommandNames(program, 'agents');
    const expected = ['list', 'add', 'delete', 'set-identity', 'sync', 'bindings', 'bind', 'unbind', 'refresh', 'check'];
    for (const cmd of expected) {
      expect(subs).toContain(cmd);
    }
    expect(subs.length).toBe(expected.length);
  });

  it('registers config subcommands', () => {
    program = new Command();
    registerConfigCommands(program);

    const subs = getSubcommandNames(program, 'config');
    expect(subs).toContain('get');
    expect(subs).toContain('set');
    expect(subs).toContain('unset');
    expect(subs).toContain('path');
  });

  it('registers message subcommands', () => {
    program = new Command();
    registerMessageCommands(program);

    const subs = getSubcommandNames(program, 'message');
    expect(subs).toContain('send');
    expect(subs).toContain('broadcast');
  });
});
