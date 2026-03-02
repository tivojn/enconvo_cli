import { describe, it, expect, vi } from 'vitest';
import { shouldRespond } from '../mention-gate';

function makeMessage(overrides: Record<string, any> = {}) {
  return {
    guild: { id: 'guild-1' },
    content: '',
    mentions: { has: vi.fn().mockReturnValue(false) },
    reference: null,
    channel: {
      messages: {
        fetch: vi.fn(),
      },
    },
    ...overrides,
  } as any;
}

function makeClient(userId = 'bot-123') {
  return {
    user: { id: userId },
  } as any;
}

describe('shouldRespond', () => {
  it('always responds to DMs (no guild)', async () => {
    const msg = makeMessage({ guild: null });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(true);
  });

  it('responds when bot is @mentioned', async () => {
    const client = makeClient();
    const msg = makeMessage({
      mentions: { has: vi.fn().mockReturnValue(true) },
    });
    const result = await shouldRespond(msg, client);
    expect(result).toBe(true);
  });

  it('responds when replying to bot message', async () => {
    const client = makeClient('bot-123');
    const msg = makeMessage({
      reference: { messageId: 'msg-456' },
    });
    msg.channel.messages.fetch.mockResolvedValue({ author: { id: 'bot-123' } });
    const result = await shouldRespond(msg, client);
    expect(result).toBe(true);
  });

  it('ignores replies to non-bot messages', async () => {
    const client = makeClient('bot-123');
    const msg = makeMessage({
      reference: { messageId: 'msg-456' },
    });
    msg.channel.messages.fetch.mockResolvedValue({ author: { id: 'other-user' } });
    const result = await shouldRespond(msg, client);
    expect(result).toBe(false);
  });

  it('responds to !reset command', async () => {
    const msg = makeMessage({ content: '!reset' });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(true);
  });

  it('responds to !status command', async () => {
    const msg = makeMessage({ content: '!status' });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(true);
  });

  it('responds to !help command', async () => {
    const msg = makeMessage({ content: '!help' });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(true);
  });

  it('is case insensitive for commands', async () => {
    const msg = makeMessage({ content: '!RESET' });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(true);
  });

  it('ignores regular guild messages', async () => {
    const msg = makeMessage({ content: 'hello everyone' });
    const result = await shouldRespond(msg, makeClient());
    expect(result).toBe(false);
  });

  it('handles fetch error gracefully on reply check', async () => {
    const client = makeClient('bot-123');
    const msg = makeMessage({
      reference: { messageId: 'deleted-msg' },
    });
    msg.channel.messages.fetch.mockRejectedValue(new Error('Unknown message'));
    const result = await shouldRespond(msg, client);
    expect(result).toBe(false);
  });
});
