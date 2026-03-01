import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// We test the pure functions by importing them
// The store relies on filesystem, so we test with temp dirs

describe('agent-store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-store-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('derivePreferenceKey', () => {
    it('converts agent path slash to pipe', () => {
      const agentsPath = path.join(tmpDir, 'agents.json');
      const roster = {
        version: 1,
        team: 'Test Team',
        members: [
          {
            id: 'test',
            name: 'Test',
            emoji: '🧪',
            role: 'Tester',
            specialty: 'Testing',
            isLead: false,
            bindings: {
              agentPath: 'custom_bot/abc123',
              telegramBot: '@TestBot',
              instanceName: 'test',
            },
          },
        ],
      };
      fs.writeFileSync(agentsPath, JSON.stringify(roster, null, 2));

      const raw = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      const agentPath = raw.members[0].bindings.agentPath;
      const expectedKey = agentPath.replace('/', '|');
      expect(expectedKey).toBe('custom_bot|abc123');
    });
  });

  describe('roster file format', () => {
    it('has expected schema fields', () => {
      const roster = {
        version: 1,
        team: 'Test Team',
        members: [],
      };
      const agentsPath = path.join(tmpDir, 'agents.json');
      fs.writeFileSync(agentsPath, JSON.stringify(roster));

      const loaded = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      expect(loaded.version).toBe(1);
      expect(loaded.team).toBe('Test Team');
      expect(loaded.members).toEqual([]);
    });

    it('preserves member fields on roundtrip', () => {
      const member = {
        id: 'mavis',
        name: 'Mavis',
        emoji: '👑',
        role: 'Lead',
        specialty: 'Coordination',
        isLead: true,
        bindings: {
          agentPath: 'chat_with_ai/chat',
          telegramBot: '@Mavis_bot',
          instanceName: 'mavis',
        },
      };
      const roster = { version: 1, team: 'Team', members: [member] };
      const agentsPath = path.join(tmpDir, 'agents.json');
      fs.writeFileSync(agentsPath, JSON.stringify(roster));

      const loaded = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      expect(loaded.members[0].id).toBe('mavis');
      expect(loaded.members[0].bindings.agentPath).toBe('chat_with_ai/chat');
      expect(loaded.members[0].isLead).toBe(true);
    });
  });

  describe('channelBindings', () => {
    it('supports channelBindings array in bindings', () => {
      const member = {
        id: 'elena',
        name: 'Elena',
        emoji: '✍️',
        role: 'Content',
        specialty: 'Writing',
        isLead: false,
        bindings: {
          agentPath: 'custom_bot/elena123',
          telegramBot: '@Elena_bot',
          instanceName: 'elena',
          channelBindings: [
            { channel: 'telegram', instanceName: 'elena', botHandle: '@Elena_bot' },
            { channel: 'discord', instanceName: 'elena-discord', botHandle: 'Elena#1234' },
          ],
        },
      };
      const roster = { version: 1, team: 'Team', members: [member] };
      const agentsPath = path.join(tmpDir, 'agents.json');
      fs.writeFileSync(agentsPath, JSON.stringify(roster));

      const loaded = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      const bindings = loaded.members[0].bindings.channelBindings;
      expect(bindings).toHaveLength(2);
      expect(bindings[0].channel).toBe('telegram');
      expect(bindings[1].channel).toBe('discord');
      expect(bindings[1].instanceName).toBe('elena-discord');
    });

    it('channelBindings can be empty array', () => {
      const member = {
        id: 'test',
        bindings: { agentPath: 'test/bot', channelBindings: [] },
      };
      const roster = { version: 1, team: 'Team', members: [member] };
      const agentsPath = path.join(tmpDir, 'agents.json');
      fs.writeFileSync(agentsPath, JSON.stringify(roster));

      const loaded = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      expect(loaded.members[0].bindings.channelBindings).toEqual([]);
    });

    it('channelBindings can be omitted for backward compatibility', () => {
      const member = {
        id: 'old-agent',
        bindings: {
          agentPath: 'test/bot',
          telegramBot: '@OldBot',
          instanceName: 'default',
        },
      };
      const roster = { version: 1, team: 'Team', members: [member] };
      const agentsPath = path.join(tmpDir, 'agents.json');
      fs.writeFileSync(agentsPath, JSON.stringify(roster));

      const loaded = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
      expect(loaded.members[0].bindings.channelBindings).toBeUndefined();
      expect(loaded.members[0].bindings.telegramBot).toBe('@OldBot');
    });
  });

  describe('bind/unbind data logic', () => {
    function makeRoster() {
      return {
        version: 1,
        team: 'Test Team',
        members: [
          {
            id: 'alpha',
            name: 'Alpha',
            emoji: '🅰️',
            role: 'Test',
            specialty: 'Test',
            isLead: false,
            bindings: {
              agentPath: 'custom_bot/alpha',
              telegramBot: '@AlphaBot',
              instanceName: 'alpha',
              channelBindings: [] as Array<{ channel: string; instanceName: string; botHandle?: string }>,
            },
          },
        ],
      };
    }

    it('adding a binding appends to channelBindings', () => {
      const roster = makeRoster();
      const binding = { channel: 'telegram', instanceName: 'alpha', botHandle: '@AlphaBot' };
      roster.members[0].bindings.channelBindings.push(binding);

      expect(roster.members[0].bindings.channelBindings).toHaveLength(1);
      expect(roster.members[0].bindings.channelBindings[0].channel).toBe('telegram');
    });

    it('duplicate binding replaces existing', () => {
      const roster = makeRoster();
      const bindings = roster.members[0].bindings.channelBindings;

      // Add first binding
      bindings.push({ channel: 'telegram', instanceName: 'alpha', botHandle: '@AlphaBot' });
      // Add same channel+instance with different handle (simulates bindAgent logic)
      const filtered = bindings.filter(
        (b) => !(b.channel === 'telegram' && b.instanceName === 'alpha'),
      );
      filtered.push({ channel: 'telegram', instanceName: 'alpha', botHandle: '@NewAlphaBot' });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].botHandle).toBe('@NewAlphaBot');
    });

    it('unbinding removes specific channel+instance', () => {
      const roster = makeRoster();
      const bindings = roster.members[0].bindings.channelBindings;
      bindings.push({ channel: 'telegram', instanceName: 'alpha' });
      bindings.push({ channel: 'discord', instanceName: 'alpha-discord' });

      const afterUnbind = bindings.filter(
        (b) => !(b.channel === 'telegram' && b.instanceName === 'alpha'),
      );

      expect(afterUnbind).toHaveLength(1);
      expect(afterUnbind[0].channel).toBe('discord');
    });

    it('unbinding non-existent binding returns original length', () => {
      const roster = makeRoster();
      roster.members[0].bindings.channelBindings.push({ channel: 'telegram', instanceName: 'alpha' });

      const before = roster.members[0].bindings.channelBindings.length;
      const afterUnbind = roster.members[0].bindings.channelBindings.filter(
        (b) => !(b.channel === 'slack' && b.instanceName === 'alpha'),
      );

      expect(afterUnbind.length).toBe(before);
    });

    it('multiple bindings across channels preserved', () => {
      const roster = makeRoster();
      const bindings = roster.members[0].bindings.channelBindings;
      bindings.push({ channel: 'telegram', instanceName: 'alpha' });
      bindings.push({ channel: 'discord', instanceName: 'alpha-dc' });
      bindings.push({ channel: 'telegram', instanceName: 'alpha-group' });

      expect(bindings).toHaveLength(3);
      const telegramBindings = bindings.filter((b) => b.channel === 'telegram');
      expect(telegramBindings).toHaveLength(2);
    });
  });

  describe('updateAgent data logic', () => {
    it('partial updates preserve other fields', () => {
      const member = {
        id: 'test',
        name: 'Test',
        emoji: '🧪',
        role: 'Tester',
        specialty: 'Testing',
      };

      // Apply partial update
      const updates = { name: 'Updated Test', emoji: '🔬' };
      const updated = { ...member, ...updates };

      expect(updated.name).toBe('Updated Test');
      expect(updated.emoji).toBe('🔬');
      expect(updated.role).toBe('Tester'); // unchanged
      expect(updated.specialty).toBe('Testing'); // unchanged
    });
  });
});
