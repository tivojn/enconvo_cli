import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('{}'),
    readdirSync: vi.fn().mockReturnValue([]),
  };
});

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('../../../config/store', () => ({
  getChannelInstance: vi.fn().mockReturnValue(null),
}));

import * as fs from 'fs';
import { execSync } from 'child_process';
import { checkAgent, checkTeamKB, checkEnConvoVersion, checkApiReachable, STATUS_ICON } from '../check';
import { getChannelInstance } from '../../../config/store';
import type { AgentMember } from '../../../config/agent-store';

function makeAgent(overrides: Partial<AgentMember> = {}): AgentMember {
  return {
    id: 'test',
    name: 'TestAgent',
    emoji: '🧪',
    role: 'Test',
    specialty: 'Testing',
    isLead: false,
    bindings: {
      agentPath: 'custom_bot/test123',
      telegramBot: '@TestBot',
      instanceName: 'test',
    },
    preferenceKey: 'custom_bot|test123',
    workspacePath: '/tmp/workspace-test',
    ...overrides,
  } as AgentMember;
}

describe('checkAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns fail for missing command file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const checks = checkAgent(makeAgent());
    const cmdCheck = checks.find(c => c.label === 'Command file');
    expect(cmdCheck?.status).toBe('fail');
  });

  it('returns ok when command file exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('custom_bot|test123.json');
    });
    const checks = checkAgent(makeAgent());
    const cmdCheck = checks.find(c => c.label === 'Command file');
    expect(cmdCheck?.status).toBe('ok');
  });

  it('returns fail for missing preference file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const checks = checkAgent(makeAgent());
    const prefCheck = checks.find(c => c.label === 'Preference');
    expect(prefCheck?.status).toBe('fail');
  });

  it('returns ok for synced prompt', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.includes('preferences') && s.includes('custom_bot|test123');
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ prompt: 'You are TestAgent the best' }));

    const checks = checkAgent(makeAgent());
    const syncCheck = checks.find(c => c.label === 'Prompt synced');
    expect(syncCheck?.status).toBe('ok');
  });

  it('returns warn for mismatched prompt', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const s = String(p);
      return s.includes('preferences') && s.includes('custom_bot|test123');
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ prompt: 'You are Claude, a helpful assistant' }));

    const checks = checkAgent(makeAgent());
    const syncCheck = checks.find(c => c.label === 'Prompt synced');
    expect(syncCheck?.status).toBe('warn');
  });

  it('returns fail when all workspace files missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const checks = checkAgent(makeAgent());
    const wsCheck = checks.find(c => c.label === 'Workspace');
    expect(wsCheck?.status).toBe('fail');
    expect(wsCheck?.detail).toContain('IDENTITY.md');
  });

  it('returns warn when telegram instance not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(getChannelInstance).mockReturnValue(undefined as any);
    const checks = checkAgent(makeAgent());
    const tgCheck = checks.find(c => c.label === 'Telegram');
    expect(tgCheck?.status).toBe('warn');
  });

  it('returns ok when telegram instance found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(getChannelInstance).mockReturnValue({ token: 'x', agent: 'y' } as any);
    const checks = checkAgent(makeAgent());
    const tgCheck = checks.find(c => c.label === 'Telegram');
    expect(tgCheck?.status).toBe('ok');
  });

  it('returns 5 checks total', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const checks = checkAgent(makeAgent());
    expect(checks).toHaveLength(5);
  });
});

describe('checkTeamKB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns warn when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = checkTeamKB();
    expect(result.status).toBe('warn');
  });

  it('returns ok with file count when directory exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['file1.md', 'file2.md'] as any);
    const result = checkTeamKB();
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('2 files');
  });

  it('excludes hidden files from count', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(['.DS_Store', 'README.md'] as any);
    const result = checkTeamKB();
    expect(result.detail).toContain('1 file');
  });
});

describe('checkEnConvoVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns warn when app not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const { result, current } = checkEnConvoVersion(undefined);
    expect(result.status).toBe('warn');
    expect(current).toBeNull();
  });

  it('returns ok with first check when no stored version', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockReturnValueOnce('1.2.3\n')
      .mockReturnValueOnce('456\n');

    const { result, current, changed } = checkEnConvoVersion(undefined);
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('first check');
    expect(current).toEqual({ version: '1.2.3', build: 456 });
    expect(changed).toBe(true);
  });

  it('returns ok when version matches stored', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockReturnValueOnce('1.2.3\n')
      .mockReturnValueOnce('456\n');

    const { result, changed } = checkEnConvoVersion({ version: '1.2.3', build: 456, lastChecked: '' });
    expect(result.status).toBe('ok');
    expect(result.detail).toContain('matches');
    expect(changed).toBe(false);
  });

  it('returns warn when version changed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(execSync)
      .mockReturnValueOnce('2.0.0\n')
      .mockReturnValueOnce('789\n');

    const { result, changed } = checkEnConvoVersion({ version: '1.2.3', build: 456, lastChecked: '' });
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('CHANGED');
    expect(changed).toBe(true);
  });
});

describe('checkApiReachable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok when curl succeeds', () => {
    vi.mocked(execSync).mockReturnValue('');
    const result = checkApiReachable('http://localhost:54535');
    expect(result.status).toBe('ok');
  });

  it('returns warn when curl fails', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('Connection refused'); });
    const result = checkApiReachable('http://localhost:54535');
    expect(result.status).toBe('warn');
    expect(result.detail).toContain('not reachable');
  });
});

describe('STATUS_ICON', () => {
  it('has icons for ok, warn, fail', () => {
    expect(STATUS_ICON.ok).toBeDefined();
    expect(STATUS_ICON.warn).toBeDefined();
    expect(STATUS_ICON.fail).toBeDefined();
  });
});
