import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the dependencies before importing
vi.mock('../enconvo-client', () => ({
  callEnConvo: vi.fn(),
}));

vi.mock('../../config/agent-store', () => ({
  loadAgentsRoster: vi.fn(),
}));

import { routeToAgent } from '../agent-router';
import { callEnConvo } from '../enconvo-client';
import { loadAgentsRoster } from '../../config/agent-store';

const mockedCallEnConvo = vi.mocked(callEnConvo);
const mockedLoadAgentsRoster = vi.mocked(loadAgentsRoster);

describe('routeToAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLoadAgentsRoster.mockReturnValue({
      version: 1,
      team: 'Test Team',
      members: [
        {
          id: 'elena',
          name: 'Elena',
          emoji: '✍️',
          role: 'Content Creator',
          specialty: 'Writing',
          isLead: false,
          bindings: {
            agentPath: 'custom_bot/elena123',
            telegramBot: '@Elena_bot',
            instanceName: 'elena',
          },
          preferenceKey: 'custom_bot|elena123',
          workspacePath: '/tmp/workspace-elena',
        },
      ],
    });
  });

  it('routes to target agent and returns parsed response', async () => {
    mockedCallEnConvo.mockResolvedValue({
      result: 'Here is the content you requested.',
    });

    const result = await routeToAgent(
      'Mavis',
      { targetAgentId: 'elena', message: 'Write a tagline.' },
      { chatId: '12345', channel: 'telegram' },
    );

    expect(result).not.toBeNull();
    expect(result!.text).toBe('Here is the content you requested.');

    // Verify callEnConvo was called with correct args
    expect(mockedCallEnConvo).toHaveBeenCalledWith(
      '[From Mavis]: Write a tagline.',
      'telegram-12345-team',
      'custom_bot/elena123',
    );
  });

  it('returns null for unknown target agent', async () => {
    const result = await routeToAgent(
      'Mavis',
      { targetAgentId: 'nonexistent', message: 'Hello' },
      { chatId: '12345', channel: 'telegram' },
    );

    expect(result).toBeNull();
    expect(mockedCallEnConvo).not.toHaveBeenCalled();
  });

  it('returns null on API error', async () => {
    mockedCallEnConvo.mockRejectedValue(new Error('API down'));

    const result = await routeToAgent(
      'Mavis',
      { targetAgentId: 'elena', message: 'Hello' },
      { chatId: '12345', channel: 'telegram' },
    );

    expect(result).toBeNull();
  });

  it('uses shared team session ID', async () => {
    mockedCallEnConvo.mockResolvedValue({ result: 'ok' });

    await routeToAgent(
      'Mavis',
      { targetAgentId: 'elena', message: 'Hello' },
      { chatId: 'abc', channel: 'discord', instanceId: 'mavis-discord' },
    );

    // Session should be channel-chatId-team
    expect(mockedCallEnConvo).toHaveBeenCalledWith(
      expect.any(String),
      'discord-abc-team',
      expect.any(String),
    );
  });
});
