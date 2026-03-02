import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testTelegram, testDiscord } from '../test';

describe('testTelegram', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with bot username on valid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { username: 'MyTestBot' } }),
    } as Response);

    const result = await testTelegram('valid-token');
    expect(result.success).toBe(true);
    expect(result.botUsername).toBe('@MyTestBot');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('returns failure on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const result = await testTelegram('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('returns failure when API returns error description', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: false, description: 'Invalid token' }),
    } as Response);

    const result = await testTelegram('invalid');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid token');
  });

  it('returns failure on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await testTelegram('token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('calls correct Telegram API URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { username: 'Bot' } }),
    } as Response);

    await testTelegram('my-secret-token');
    expect(fetchSpy).toHaveBeenCalledWith('https://api.telegram.org/botmy-secret-token/getMe');
  });
});

describe('testDiscord', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with bot username on valid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ username: 'DiscordBot', discriminator: '1234' }),
    } as Response);

    const result = await testDiscord('valid-token');
    expect(result.success).toBe(true);
    expect(result.botUsername).toBe('DiscordBot#1234');
  });

  it('uses discriminator 0 when not provided', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ username: 'NewBot' }),
    } as Response);

    const result = await testDiscord('token');
    expect(result.botUsername).toBe('NewBot#0');
  });

  it('returns failure on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const result = await testDiscord('bad-token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('401');
  });

  it('returns failure when username missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await testDiscord('token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not read bot info');
  });

  it('returns failure on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('DNS resolution failed'));

    const result = await testDiscord('token');
    expect(result.success).toBe(false);
    expect(result.error).toContain('DNS');
  });

  it('sends correct authorization header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ username: 'Bot' }),
    } as Response);

    await testDiscord('my-discord-token');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://discord.com/api/v10/users/@me');
    expect((init as RequestInit).headers).toEqual(expect.objectContaining({
      Authorization: 'Bot my-discord-token',
    }));
  });
});
