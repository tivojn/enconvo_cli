import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testTelegram, testDiscord } from '../channels/test';

describe('testTelegram', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns success with bot username on valid token', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { username: 'TestBot' } }),
    } as Response);

    const result = await testTelegram('valid-token');
    expect(result.success).toBe(true);
    expect(result.botUsername).toBe('@TestBot');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns failure on HTTP error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const result = await testTelegram('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('returns failure on API error response', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, description: 'Invalid token' }),
    } as Response);

    const result = await testTelegram('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('handles network errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('Network unreachable'));

    const result = await testTelegram('any-token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network unreachable');
  });
});

describe('testDiscord', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns success with bot username on valid token', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ username: 'DiscordBot', discriminator: '1234' }),
    } as Response);

    const result = await testDiscord('valid-token');
    expect(result.success).toBe(true);
    expect(result.botUsername).toBe('DiscordBot#1234');
  });

  it('handles zero discriminator', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ username: 'ModernBot', discriminator: '0' }),
    } as Response);

    const result = await testDiscord('valid-token');
    expect(result.success).toBe(true);
    expect(result.botUsername).toBe('ModernBot#0');
  });

  it('returns failure on HTTP error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const result = await testDiscord('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('returns failure when username missing', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '12345' }),
    } as Response);

    const result = await testDiscord('weird-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read bot info');
  });

  it('handles network errors gracefully', async () => {
    fetchSpy.mockRejectedValue(new Error('Connection refused'));

    const result = await testDiscord('any-token');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});
