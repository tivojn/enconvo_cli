import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/store', () => ({
  loadGlobalConfig: vi.fn(),
}));

import { getSessionId, resetSession, getAgent, setAgent } from '../session-manager';
import { loadGlobalConfig } from '../../config/store';

const mockedLoadGlobalConfig = vi.mocked(loadGlobalConfig);

describe('session-manager', () => {
  describe('getSessionId', () => {
    it('generates default session ID from chatId', () => {
      const id = getSessionId(12345);
      expect(id).toBe('telegram-12345');
    });

    it('includes instanceId when provided', () => {
      const id = getSessionId(12345, 'mavis');
      expect(id).toBe('telegram-12345-mavis');
    });

    it('returns consistent ID for same chatId', () => {
      const id1 = getSessionId(99999);
      const id2 = getSessionId(99999);
      expect(id1).toBe(id2);
    });
  });

  describe('resetSession', () => {
    it('returns a new unique session ID', () => {
      const original = getSessionId(88888);
      const reset = resetSession(88888);
      expect(reset).not.toBe(original);
      expect(reset).toContain('telegram-88888');
    });

    it('subsequent getSessionId returns the reset ID', () => {
      const reset = resetSession(77777);
      const get = getSessionId(77777);
      expect(get).toBe(reset);
    });

    it('includes instanceId in reset', () => {
      const reset = resetSession(66666, 'elena');
      expect(reset).toContain('telegram-66666-elena-');
    });

    it('generates different IDs on each reset', () => {
      const reset1 = resetSession(55555);
      const reset2 = resetSession(55555);
      expect(reset1).not.toBe(reset2);
    });
  });

  describe('getAgent', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const makeConfig = (agents: Array<{ id: string; name: string; path: string; description: string }>, defaultAgent = '') => ({
      version: 2,
      enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents, defaultAgent },
      channels: { telegram: { instances: {} }, discord: { instances: {} } },
    });

    it('returns agent matching defaultAgent', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'chat', name: 'Chat', path: 'chat_with_ai/chat', description: 'Default' },
        { id: 'custom', name: 'Custom', path: 'custom_bot/abc', description: 'Custom bot' },
      ], 'custom'));

      const agent = getAgent(11111);
      expect(agent.id).toBe('custom');
      expect(agent.path).toBe('custom_bot/abc');
    });

    it('falls back to first agent when defaultAgent not found', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'chat', name: 'Chat', path: 'chat_with_ai/chat', description: 'Default' },
      ], 'nonexistent'));

      const agent = getAgent(22222);
      expect(agent.id).toBe('chat');
    });

    it('throws when no agents configured', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([], ''));
      expect(() => getAgent(33333)).toThrow('No agents configured');
    });

    it('uses agent override when set', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'chat', name: 'Chat', path: 'chat_with_ai/chat', description: 'Default' },
        { id: 'custom', name: 'Custom', path: 'custom_bot/abc', description: 'Custom bot' },
      ], 'chat'));

      // Set override
      setAgent(44444, 'custom');
      const agent = getAgent(44444);
      expect(agent.id).toBe('custom');
    });
  });

  describe('setAgent', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    const makeConfig = (agents: Array<{ id: string; name: string; path: string; description: string }>) => ({
      version: 2,
      enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents, defaultAgent: '' },
      channels: { telegram: { instances: {} }, discord: { instances: {} } },
    });

    it('returns agent when found', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'custom', name: 'Custom', path: 'custom_bot/abc', description: 'Custom bot' },
      ]));

      const result = setAgent(55555, 'custom');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('custom');
    });

    it('returns null when agent not found', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'chat', name: 'Chat', path: 'chat_with_ai/chat', description: 'Default' },
      ]));

      const result = setAgent(66666, 'nonexistent');
      expect(result).toBeNull();
    });

    it('persists override for getAgent', () => {
      mockedLoadGlobalConfig.mockReturnValue(makeConfig([
        { id: 'a', name: 'A', path: 'a/a', description: 'A' },
        { id: 'b', name: 'B', path: 'b/b', description: 'B' },
      ]));

      setAgent(77777, 'b');
      const agent = getAgent(77777);
      expect(agent.id).toBe('b');
    });
  });
});
