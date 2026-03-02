import { describe, it, expect } from 'vitest';
import { detectIssues } from '../doctor';
import type { GlobalConfig } from '../../config/store';
import type { AgentMember } from '../../config/agent-store';

function makeConfig(overrides?: Partial<GlobalConfig>): GlobalConfig {
  return {
    version: 2,
    enconvo: {
      url: 'http://localhost:54535',
      timeoutMs: 120000,
      agents: [],
      defaultAgent: 'mavis',
    },
    channels: {},
    ...overrides,
  };
}

function makeMember(id: string, overrides?: Partial<AgentMember>): AgentMember {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    emoji: '🤖',
    role: 'Agent',
    specialty: 'General',
    isLead: false,
    bindings: { agentPath: `custom_bot/${id}`, telegramBot: '', instanceName: id },
    preferenceKey: `custom_bot|${id}`,
    workspacePath: `/tmp/nonexistent-workspace-${id}`,
    ...overrides,
  };
}

describe('detectIssues', () => {
  it('reports no issues when everything is valid', () => {
    const issues = detectIssues({
      configDirExists: true,
      configFileExists: true,
      agentsFileExists: true,
      config: makeConfig(),
      roster: { version: 1, team: 'Test', members: [makeMember('lead', { isLead: true, workspacePath: '' })] },
    });
    expect(issues).toHaveLength(0);
  });

  it('reports missing config directory', () => {
    const issues = detectIssues({
      configDirExists: false,
      configFileExists: false,
      agentsFileExists: false,
      config: null,
      roster: null,
    });
    expect(issues.some(i => i.level === 'error' && i.message.includes('Config directory missing'))).toBe(true);
  });

  it('reports missing config file', () => {
    const issues = detectIssues({
      configDirExists: true,
      configFileExists: false,
      agentsFileExists: false,
      config: null,
      roster: null,
    });
    expect(issues.some(i => i.level === 'error' && i.message.includes('Config file missing'))).toBe(true);
  });

  it('warns about legacy v1 config', () => {
    const issues = detectIssues({
      configDirExists: true,
      configFileExists: true,
      agentsFileExists: false,
      config: makeConfig({ version: 1 }),
      roster: null,
    });
    expect(issues.some(i => i.level === 'warn' && i.message.includes('legacy v1'))).toBe(true);
  });

  it('reports missing token on channel instance', () => {
    const config = makeConfig({
      channels: {
        telegram: {
          instances: {
            broken: {
              enabled: true, token: '', agent: 'a/b',
              allowedUserIds: [123], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
            },
          },
        },
      },
    });
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: false,
      config, roster: null,
    });
    expect(issues.some(i => i.level === 'error' && i.message.includes('telegram.broken: missing token'))).toBe(true);
  });

  it('warns about empty allowedUserIds', () => {
    const config = makeConfig({
      channels: {
        telegram: {
          instances: {
            open: {
              enabled: true, token: 'tok', agent: 'a/b',
              allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
            },
          },
        },
      },
    });
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: false,
      config, roster: null,
    });
    expect(issues.some(i => i.level === 'warn' && i.message.includes('no allowed users'))).toBe(true);
  });

  it('does not warn about allowedUserIds on disabled instance', () => {
    const config = makeConfig({
      channels: {
        telegram: {
          instances: {
            off: {
              enabled: false, token: 'tok', agent: 'a/b',
              allowedUserIds: [], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
            },
          },
        },
      },
    });
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: false,
      config, roster: null,
    });
    expect(issues.some(i => i.message.includes('no allowed users'))).toBe(false);
  });

  it('reports duplicate agent paths across instances', () => {
    const config = makeConfig({
      channels: {
        telegram: {
          instances: {
            bot1: {
              enabled: true, token: 'tok1', agent: 'chat_with_ai/chat',
              allowedUserIds: [1], service: { plistLabel: 'x', logPath: '/x', errorLogPath: '/x' },
            },
          },
        },
        discord: {
          instances: {
            bot2: {
              enabled: true, token: 'tok2', agent: 'chat_with_ai/chat',
              allowedUserIds: ['123'], service: { plistLabel: 'y', logPath: '/y', errorLogPath: '/y' },
            },
          },
        },
      },
    });
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: true,
      config, roster: { version: 1, team: 'T', members: [makeMember('lead', { isLead: true, workspacePath: '' })] },
    });
    expect(issues.some(i => i.level === 'info' && i.message.includes('used by multiple instances'))).toBe(true);
  });

  it('warns when no team lead configured', () => {
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: true,
      config: makeConfig(),
      roster: { version: 1, team: 'T', members: [makeMember('worker')] },
    });
    expect(issues.some(i => i.level === 'warn' && i.message.includes('No team lead'))).toBe(true);
  });

  it('info when multiple team leads', () => {
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: true,
      config: makeConfig(),
      roster: {
        version: 1, team: 'T',
        members: [
          makeMember('a', { isLead: true, workspacePath: '' }),
          makeMember('b', { isLead: true, workspacePath: '' }),
        ],
      },
    });
    expect(issues.some(i => i.level === 'info' && i.message.includes('Multiple team leads'))).toBe(true);
  });

  it('warns about missing workspace path', () => {
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: true,
      config: makeConfig(),
      roster: {
        version: 1, team: 'T',
        members: [makeMember('x', { isLead: true, workspacePath: '/tmp/nonexistent-doctor-test-ws-' + Date.now() })],
      },
    });
    expect(issues.some(i => i.level === 'warn' && i.message.includes('workspace missing'))).toBe(true);
  });

  it('reports roster parse error', () => {
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: true,
      config: makeConfig(),
      roster: null,
      rosterParseError: 'Unexpected token } in JSON',
    });
    expect(issues.some(i => i.level === 'error' && i.message.includes('Agents roster parse error'))).toBe(true);
  });

  it('info when no agents file', () => {
    const issues = detectIssues({
      configDirExists: true, configFileExists: true, agentsFileExists: false,
      config: makeConfig(),
      roster: null,
    });
    expect(issues.some(i => i.level === 'info' && i.message.includes('No agents roster found'))).toBe(true);
  });
});
