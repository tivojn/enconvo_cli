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

describe('agent list data operations', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-cmd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importModules() {
    const agentStore = await import('../../config/agent-store');
    const store = await import('../../config/store');
    return { agentStore, store };
  }

  it('agents list returns empty roster when none configured', async () => {
    const { agentStore } = await importModules();
    const roster = agentStore.loadAgentsRoster();
    expect(roster.team).toBe('EnConvo AI Team');
    expect(roster.members).toEqual([]);
  });

  it('agents list shows agents after add', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'mavis', name: 'Mavis', emoji: '👑',
      role: 'Team Lead', specialty: 'Coordination', isLead: true,
      bindings: { agentPath: 'chat_with_ai/chat', telegramBot: '@Mavis', instanceName: 'mavis' },
    });

    agentStore.addAgent({
      id: 'elena', name: 'Elena', emoji: '✍️',
      role: 'Content', specialty: 'Writing', isLead: false,
      bindings: { agentPath: 'custom_bot/abc', telegramBot: '@Elena', instanceName: 'elena' },
    });

    const roster = agentStore.loadAgentsRoster();
    expect(roster.members).toHaveLength(2);
    expect(roster.members[0].id).toBe('mavis');
    expect(roster.members[0].isLead).toBe(true);
    expect(roster.members[1].id).toBe('elena');
  });

  it('channels list shows instances after add', async () => {
    const { store } = await importModules();

    store.setChannelInstance('telegram', 'mavis', {
      enabled: true, token: 'tok-mavis', agent: 'chat_with_ai/chat',
      allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
    });

    store.setChannelInstance('telegram', 'elena', {
      enabled: true, token: 'tok-elena', agent: 'custom_bot/abc',
      allowedUserIds: [], service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
    });

    const instances = store.listChannelInstances('telegram');
    expect(Object.keys(instances)).toHaveLength(2);
    expect(instances.mavis.agent).toBe('chat_with_ai/chat');
    expect(instances.elena.agent).toBe('custom_bot/abc');
  });

  it('agent roster preserves order after add/delete/add', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'a', name: 'A', emoji: '1️⃣',
      role: 'R', specialty: 'S', isLead: false,
      bindings: { agentPath: 'x/a', telegramBot: '', instanceName: 'a' },
    });
    agentStore.addAgent({
      id: 'b', name: 'B', emoji: '2️⃣',
      role: 'R', specialty: 'S', isLead: false,
      bindings: { agentPath: 'x/b', telegramBot: '', instanceName: 'b' },
    });
    agentStore.addAgent({
      id: 'c', name: 'C', emoji: '3️⃣',
      role: 'R', specialty: 'S', isLead: false,
      bindings: { agentPath: 'x/c', telegramBot: '', instanceName: 'c' },
    });

    agentStore.removeAgent('b');
    const roster = agentStore.loadAgentsRoster();
    expect(roster.members.map(m => m.id)).toEqual(['a', 'c']);
  });

  it('agent updateAgent + list shows updated fields', async () => {
    const { agentStore } = await importModules();

    agentStore.addAgent({
      id: 'update-test', name: 'Original', emoji: '📝',
      role: 'Original Role', specialty: 'Original', isLead: false,
      bindings: { agentPath: 'x/y', telegramBot: '', instanceName: 'test' },
    });

    agentStore.updateAgent('update-test', { name: 'Updated', role: 'New Role' });

    const roster = agentStore.loadAgentsRoster();
    const agent = roster.members.find(m => m.id === 'update-test');
    expect(agent!.name).toBe('Updated');
    expect(agent!.role).toBe('New Role');
    expect(agent!.specialty).toBe('Original'); // unchanged
  });
});
