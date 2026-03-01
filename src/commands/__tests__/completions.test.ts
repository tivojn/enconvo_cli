import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerCompletionsCommand } from '../completions';

describe('completions command', () => {
  it('registers as a command', () => {
    const program = new Command();
    registerCompletionsCommand(program);
    const names = program.commands.map(c => c.name());
    expect(names).toContain('completions');
  });

  it('has a shell argument', () => {
    const program = new Command();
    registerCompletionsCommand(program);
    const cmd = program.commands.find(c => c.name() === 'completions');
    expect(cmd).toBeDefined();
    // Commander stores args info
    const args = cmd!.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
  });
});
