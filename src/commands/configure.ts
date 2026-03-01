import { Command } from 'commander';
import * as readline from 'readline';
import { loadGlobalConfig, saveGlobalConfig, setChannelInstance, InstanceConfig } from '../config/store';
import { addAgent } from '../config/agent-store';
import { listAdapterNames } from '../channels/registry';

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function promptWithDefault(rl: readline.Interface, question: string, defaultValue: string): Promise<string> {
  return new Promise((resolve) =>
    rl.question(`${question} [${defaultValue}]: `, (answer) => resolve(answer.trim() || defaultValue)),
  );
}

export function registerConfigureCommand(program: Command): void {
  program
    .command('configure')
    .description('Interactive setup wizard for EnConvo CLI')
    .option('--channel <name>', 'Configure a specific channel only')
    .option('--agent', 'Configure agents only')
    .option('--non-interactive', 'Show current config and exit')
    .action(async (opts) => {
      if (opts.nonInteractive) {
        showCurrentConfig();
        return;
      }

      if (opts.agent) {
        await configureAgent();
        return;
      }

      if (opts.channel) {
        await configureChannel(opts.channel);
        return;
      }

      await runFullWizard();
    });
}

function showCurrentConfig(): void {
  const config = loadGlobalConfig();
  console.log('\n=== EnConvo CLI Configuration ===\n');
  console.log(`API URL:     ${config.enconvo.url}`);
  console.log(`Timeout:     ${config.enconvo.timeoutMs}ms`);
  console.log(`Default Agent: ${config.enconvo.defaultAgent}`);

  const channelNames = Object.keys(config.channels);
  if (channelNames.length === 0) {
    console.log('\nNo channels configured.');
  } else {
    console.log(`\nChannels (${channelNames.length}):`);
    for (const ch of channelNames) {
      const instances = Object.keys(config.channels[ch].instances);
      console.log(`  ${ch}: ${instances.length} instance(s) — ${instances.join(', ')}`);
    }
  }

  console.log('\nRun `enconvo configure` without --non-interactive to modify.');
}

async function runFullWizard(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const config = loadGlobalConfig();

  console.log('\n=== EnConvo CLI Setup Wizard ===\n');

  // Step 1: API settings
  console.log('Step 1: EnConvo API Settings');
  config.enconvo.url = await promptWithDefault(rl, '  API URL', config.enconvo.url);
  const timeoutStr = await promptWithDefault(rl, '  Timeout (ms)', String(config.enconvo.timeoutMs));
  config.enconvo.timeoutMs = parseInt(timeoutStr, 10) || 120000;

  // Step 2: Test connectivity
  console.log('\n  Testing connectivity...');
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${config.enconvo.url}/command/call/chat_with_ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input_text: 'ping', sessionId: 'configure-probe' }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      console.log('  EnConvo API is reachable.');
    } else {
      console.log(`  Warning: API returned ${res.status}. Continuing anyway.`);
    }
  } catch {
    console.log('  Warning: Cannot reach EnConvo API. Is it running? Continuing anyway.');
  }

  saveGlobalConfig(config);
  console.log('\n  API settings saved.');

  // Step 3: Channel setup
  const adapters = listAdapterNames();
  console.log(`\nStep 2: Channel Setup (available: ${adapters.join(', ')})`);
  const addChannel = await prompt(rl, '  Add a channel instance? (y/n): ');

  if (addChannel.toLowerCase() === 'y') {
    const channel = await promptWithDefault(rl, '  Channel', 'telegram');
    if (!adapters.includes(channel)) {
      console.log(`  Unknown channel "${channel}". Available: ${adapters.join(', ')}`);
    } else {
      const instanceName = await promptWithDefault(rl, '  Instance name', 'default');
      const token = await prompt(rl, '  Bot token: ');
      const agentPath = await promptWithDefault(rl, '  Agent path', 'chat_with_ai/chat');

      if (token.trim()) {
        const instance: InstanceConfig = {
          enabled: true,
          token: token.trim(),
          agent: agentPath.trim(),
          allowedUserIds: [],
          service: {
            plistLabel: `com.enconvo.${channel}-${instanceName}`,
            logPath: `~/Library/Logs/enconvo-${channel}-${instanceName}.log`,
            errorLogPath: `~/Library/Logs/enconvo-${channel}-${instanceName}-error.log`,
          },
        };
        setChannelInstance(channel, instanceName, instance);
        console.log(`  Instance "${instanceName}" added to ${channel}.`);
      } else {
        console.log('  Skipped — no token provided.');
      }
    }
  }

  // Step 4: Agent setup
  console.log('\nStep 3: Agent Setup');
  const addAgentQ = await prompt(rl, '  Add an agent to the team roster? (y/n): ');

  if (addAgentQ.toLowerCase() === 'y') {
    await promptAndAddAgent(rl);
  }

  rl.close();
  console.log('\n=== Configuration complete! ===');
  console.log('Run `enconvo status` to verify everything is working.');
  console.log('Run `enconvo configure --non-interactive` to review settings.\n');
}

async function configureChannel(channel: string): Promise<void> {
  const adapters = listAdapterNames();
  if (!adapters.includes(channel)) {
    console.error(`Unknown channel "${channel}". Available: ${adapters.join(', ')}`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`\n=== Configure ${channel} ===\n`);
  const instanceName = await promptWithDefault(rl, 'Instance name', 'default');
  const token = await prompt(rl, 'Bot token: ');
  const agentPath = await promptWithDefault(rl, 'Agent path', 'chat_with_ai/chat');

  if (token.trim()) {
    const instance: InstanceConfig = {
      enabled: true,
      token: token.trim(),
      agent: agentPath.trim(),
      allowedUserIds: [],
      service: {
        plistLabel: `com.enconvo.${channel}-${instanceName}`,
        logPath: `~/Library/Logs/enconvo-${channel}-${instanceName}.log`,
        errorLogPath: `~/Library/Logs/enconvo-${channel}-${instanceName}-error.log`,
      },
    };
    setChannelInstance(channel, instanceName, instance);
    console.log(`Instance "${instanceName}" saved.`);
  } else {
    console.log('Skipped — no token provided.');
  }

  rl.close();
}

async function configureAgent(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('\n=== Add Agent ===\n');
  await promptAndAddAgent(rl);
  rl.close();
}

async function promptAndAddAgent(rl: readline.Interface): Promise<void> {
  const id = await prompt(rl, '  Agent ID (e.g. mavis): ');
  if (!id.trim()) { console.log('  Skipped — no ID.'); return; }

  const name = await promptWithDefault(rl, '  Display name', id.trim());
  const emoji = await promptWithDefault(rl, '  Emoji', '🤖');
  const role = await promptWithDefault(rl, '  Role', 'Assistant');
  const specialty = await promptWithDefault(rl, '  Specialty', 'General');
  const agentPath = await promptWithDefault(rl, '  Agent path (e.g. custom_bot/abc)', 'chat_with_ai/chat');
  const telegramBot = await prompt(rl, '  Telegram bot handle (optional, e.g. @MyBot): ');
  const instanceName = await promptWithDefault(rl, '  Instance name', id.trim());

  try {
    const agent = addAgent({
      id: id.trim(),
      name: name.trim(),
      emoji: emoji.trim(),
      role: role.trim(),
      specialty: specialty.trim(),
      isLead: false,
      bindings: {
        agentPath: agentPath.trim(),
        telegramBot: telegramBot.trim() || '',
        instanceName: instanceName.trim(),
      },
    });
    console.log(`  Agent "${agent.name}" added (workspace: ${agent.workspacePath})`);
  } catch (err) {
    console.error(`  Error: ${err instanceof Error ? err.message : err}`);
  }
}
