import { Command } from 'commander';
import { registerMessageSend } from './send';

export function registerMessageCommands(program: Command): void {
  const message = program
    .command('message')
    .description('Send and read messages (OpenClaw-compatible)');

  registerMessageSend(message);
}
