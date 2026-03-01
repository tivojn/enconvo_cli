import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createWorkspace } from '../workspace';
import type { AgentMember, AgentsRoster } from '../../config/agent-store';

function makeAgent(overrides: Partial<AgentMember> = {}): AgentMember {
  return {
    id: 'test-agent',
    name: 'TestBot',
    emoji: '🤖',
    role: 'Tester',
    specialty: 'Testing',
    isLead: false,
    bindings: {
      agentPath: 'custom_bot/test123',
      telegramBot: '@TestBot',
      instanceName: 'test',
    },
    preferenceKey: 'custom_bot|test123',
    workspacePath: '/tmp/test-workspace',
    ...overrides,
  };
}

const testRoster: AgentsRoster = {
  version: 1,
  team: 'Test Team',
  members: [],
};

describe('createWorkspace', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates workspace directory', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath });
    createWorkspace(agent, testRoster);
    expect(fs.existsSync(wsPath)).toBe(true);
  });

  it('generates IDENTITY.md', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath, name: 'Aria' });
    createWorkspace(agent, testRoster);

    const identity = fs.readFileSync(path.join(wsPath, 'IDENTITY.md'), 'utf-8');
    expect(identity).toContain('# IDENTITY.md');
    expect(identity).toContain('**Name:** Aria');
    expect(identity).toContain('**Role:** Tester');
    expect(identity).toContain('**Emoji:** 🤖');
  });

  it('includes Chinese name when present', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath, chineseName: '小测' });
    createWorkspace(agent, testRoster);

    const identity = fs.readFileSync(path.join(wsPath, 'IDENTITY.md'), 'utf-8');
    expect(identity).toContain('**Chinese Name:** 小测');
  });

  it('generates SOUL.md with core truths', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath });
    createWorkspace(agent, testRoster);

    const soul = fs.readFileSync(path.join(wsPath, 'SOUL.md'), 'utf-8');
    expect(soul).toContain('# SOUL.md');
    expect(soul).toContain('Be genuinely helpful');
    expect(soul).toContain('Have opinions');
    expect(soul).toContain('Language Rule');
  });

  it('generates AGENTS.md with team roster', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath, id: 'alpha' });
    const beta = makeAgent({
      id: 'beta',
      name: 'Beta',
      emoji: '🅱️',
      role: 'Helper',
      specialty: 'Helping',
      bindings: { agentPath: 'custom_bot/beta', telegramBot: '@BetaBot', instanceName: 'beta' },
    });
    const roster: AgentsRoster = {
      version: 1,
      team: 'Test Team',
      members: [{ ...agent, id: 'alpha' }, beta],
    };

    createWorkspace(agent, roster);

    const agents = fs.readFileSync(path.join(wsPath, 'AGENTS.md'), 'utf-8');
    expect(agents).toContain('# AGENTS.md');
    expect(agents).toContain("That's you!");
    expect(agents).toContain('@BetaBot');
    expect(agents).toContain('Delegation Guide');
  });

  it('marks lead agents differently in identity', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({ workspacePath: wsPath, isLead: true });
    createWorkspace(agent, testRoster);

    const identity = fs.readFileSync(path.join(wsPath, 'IDENTITY.md'), 'utf-8');
    expect(identity).toContain('coordinate a team');
  });

  it('generates specialist intro for known agents', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({
      workspacePath: wsPath,
      id: 'vivienne',
      name: 'Vivienne',
      specialty: 'Finance',
    });
    createWorkspace(agent, testRoster);

    const identity = fs.readFileSync(path.join(wsPath, 'IDENTITY.md'), 'utf-8');
    expect(identity).toContain('numbers and money');
  });

  it('generates appearance for known agents', () => {
    const wsPath = path.join(tmpDir, 'workspace-test');
    const agent = makeAgent({
      workspacePath: wsPath,
      id: 'mavis',
      name: 'Mavis',
      isLead: true,
    });
    createWorkspace(agent, testRoster);

    const identity = fs.readFileSync(path.join(wsPath, 'IDENTITY.md'), 'utf-8');
    expect(identity).toContain('My Appearance');
    expect(identity).toContain('Hair');
  });
});
