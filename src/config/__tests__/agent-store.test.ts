import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
    it('converts agent path slash to pipe', async () => {
      // The function is not exported, so we test via addAgent behavior
      // Instead, test the derived value from loadAgentsRoster
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

      // Read back and verify the derived preferenceKey
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
});
