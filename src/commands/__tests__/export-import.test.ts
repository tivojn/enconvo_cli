import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;

vi.mock('../../config/paths', () => {
  return {
    get ENCONVO_CLI_DIR() { return tmpDir; },
    get ENCONVO_CLI_CONFIG_PATH() { return path.join(tmpDir, 'config.json'); },
    get AGENTS_CONFIG_PATH() { return path.join(tmpDir, 'agents.json'); },
    get BACKUPS_DIR() { return path.join(tmpDir, 'backups'); },
    get WORKSPACES_DIR() { return tmpDir; },
    get TEAM_KB_DIR() { return path.join(tmpDir, 'kb'); },
    get ENCONVO_PREFERENCES_DIR() { return path.join(tmpDir, 'preferences'); },
    get ENCONVO_COMMANDS_DIR() { return path.join(tmpDir, 'commands'); },
    ENCONVO_APP_PLIST: '/Applications/EnConvo.app/Contents/Info.plist',
  };
});

describe('export/import round-trip', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-import-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importModules() {
    const store = await import('../../config/store');
    const agentStore = await import('../../config/agent-store');
    return { store, agentStore };
  }

  it('export creates a valid JSON bundle', async () => {
    const { store, agentStore } = await importModules();

    // Set up some data
    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'secret-token', agent: 'chat_with_ai/chat',
      allowedUserIds: [123],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    agentStore.addAgent({
      id: 'test-agent', name: 'Test', emoji: '🤖',
      role: 'Tester', specialty: 'Testing', isLead: false,
      bindings: { agentPath: 'test/agent', telegramBot: '@TestBot', instanceName: 'test' },
    });

    // Export
    const config = store.loadGlobalConfig();
    const agents = agentStore.loadAgentsRoster();

    const bundle = {
      exportedAt: new Date().toISOString(),
      cliVersion: '2.0.0',
      config,
      agents,
    };

    const exportPath = path.join(tmpDir, 'export.json');
    fs.writeFileSync(exportPath, JSON.stringify(bundle, null, 2));

    // Verify export file
    const loaded = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(loaded.cliVersion).toBe('2.0.0');
    expect(loaded.config.channels.telegram.instances.test.token).toBe('secret-token');
    expect(loaded.agents.members).toHaveLength(1);
    expect(loaded.agents.members[0].id).toBe('test-agent');
  });

  it('export with strip-tokens redacts tokens', async () => {
    const { store } = await importModules();

    store.setChannelInstance('telegram', 'test', {
      enabled: true, token: 'secret-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    const config = store.loadGlobalConfig();
    // Strip tokens
    for (const ch of Object.values(config.channels)) {
      for (const inst of Object.values(ch.instances)) {
        inst.token = '***REDACTED***';
      }
    }

    expect(config.channels.telegram.instances.test.token).toBe('***REDACTED***');
  });

  it('import replaces config', async () => {
    const { store, agentStore } = await importModules();

    // Start with some data
    store.setChannelInstance('telegram', 'old', {
      enabled: true, token: 'old-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    // Create import bundle
    const importBundle = {
      exportedAt: new Date().toISOString(),
      cliVersion: '2.0.0',
      config: {
        version: 2,
        enconvo: { url: 'http://custom:9999', timeoutMs: 60000, agents: [], defaultAgent: '' },
        channels: {
          discord: {
            instances: {
              imported: {
                enabled: true, token: 'new-token', agent: 'imported/agent',
                allowedUserIds: [],
                service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
              },
            },
          },
        },
      },
      agents: { version: 1, team: 'Imported Team', members: [] },
    };

    // Replace
    store.saveGlobalConfig(importBundle.config);
    agentStore.saveAgentsRoster(importBundle.agents);

    const config = store.loadGlobalConfig();
    expect(config.enconvo.url).toBe('http://custom:9999');
    expect(config.channels.discord?.instances?.imported).toBeDefined();
    // Old telegram config should be gone (replaced)
    expect(config.channels.telegram).toBeUndefined();
  });

  it('import with merge preserves existing', async () => {
    const { store } = await importModules();

    // Existing
    store.setChannelInstance('telegram', 'existing', {
      enabled: true, token: 'existing-token', agent: 'a',
      allowedUserIds: [],
      service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    // Import bundle with new channel
    const currentConfig = store.loadGlobalConfig();
    currentConfig.channels.discord = {
      instances: {
        merged: {
          enabled: true, token: 'merged-token', agent: 'b',
          allowedUserIds: [],
          service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
        },
      },
    };
    store.saveGlobalConfig(currentConfig);

    const config = store.loadGlobalConfig();
    // Both should exist
    expect(config.channels.telegram.instances.existing).toBeDefined();
    expect(config.channels.discord.instances.merged).toBeDefined();
  });
});
