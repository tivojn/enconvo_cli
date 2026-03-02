import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTextMessageHandler } from '../message';

vi.mock('../../../../config/store', () => ({
  loadGlobalConfig: vi.fn().mockReturnValue({
    enconvo: { url: 'http://localhost:54535', timeoutMs: 30000 },
  }),
}));

vi.mock('../../../../services/handler-core', () => ({
  handleMessage: vi.fn(),
  buildRosterContext: vi.fn().mockReturnValue({ rosterIds: [], handleMap: {}, members: [] }),
}));

vi.mock('../../utils/file-sender', () => ({
  createDiscordIO: vi.fn().mockReturnValue({
    maxMessageLength: 2000,
    sendText: vi.fn(),
    sendFile: vi.fn(),
    startTyping: vi.fn().mockReturnValue({ stop: vi.fn() }),
  }),
}));

vi.mock('../commands', () => ({
  getSessionId: vi.fn().mockReturnValue('discord-ch1-mavis'),
}));

vi.mock('../../../../utils/mention', () => ({
  stripDiscordMention: vi.fn((text: string, _id: string) => text.replace(/<@!?\d+>/g, '').trim()),
}));

import { handleMessage } from '../../../../services/handler-core';
import { stripDiscordMention } from '../../../../utils/mention';

function makeClient(userId = '999') {
  return { user: { id: userId } } as any;
}

function makeMessage(content: string, overrides: Record<string, unknown> = {}): any {
  return {
    content,
    channel: { id: 'ch1', messages: { fetch: vi.fn() } },
    reference: null,
    ...overrides,
  };
}

describe('createTextMessageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handleMessage with text content', async () => {
    const handler = createTextMessageHandler(makeClient(), 'custom_bot/abc', 'mavis');
    const msg = makeMessage('Hello world');
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hello world', agentPath: 'custom_bot/abc' }),
      expect.anything(),
    );
  });

  it('skips empty messages', async () => {
    const handler = createTextMessageHandler(makeClient());
    const msg = makeMessage('');
    await handler(msg);
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it('strips bot mention from text', async () => {
    const handler = createTextMessageHandler(makeClient('999'));
    const msg = makeMessage('<@999> Hello');
    await handler(msg);
    expect(stripDiscordMention).toHaveBeenCalledWith('<@999> Hello', '999');
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hello' }),
      expect.anything(),
    );
  });

  it('uses fallback nudge on bare mention with no reference', async () => {
    // stripDiscordMention returns '' for bare mention
    vi.mocked(stripDiscordMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler(makeClient('999'));
    const msg = makeMessage('<@999>');
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hey, what can I help you with?' }),
      expect.anything(),
    );
  });

  it('fetches referenced message on bare mention with reply', async () => {
    vi.mocked(stripDiscordMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler(makeClient('999'));
    const fetchFn = vi.fn().mockResolvedValue({ content: 'Previously said' });
    const msg = makeMessage('<@999>', {
      reference: { messageId: 'ref-123' },
      channel: { id: 'ch1', messages: { fetch: fetchFn } },
    });
    await handler(msg);
    expect(fetchFn).toHaveBeenCalledWith('ref-123');
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Previously said' }),
      expect.anything(),
    );
  });

  it('falls back to nudge when referenced message fetch fails', async () => {
    vi.mocked(stripDiscordMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler(makeClient('999'));
    const fetchFn = vi.fn().mockRejectedValue(new Error('deleted'));
    const msg = makeMessage('<@999>', {
      reference: { messageId: 'ref-gone' },
      channel: { id: 'ch1', messages: { fetch: fetchFn } },
    });
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hey, what can I help you with?' }),
      expect.anything(),
    );
  });

  it('falls back to nudge when referenced message has empty content', async () => {
    vi.mocked(stripDiscordMention).mockReturnValueOnce('');
    const handler = createTextMessageHandler(makeClient('999'));
    const fetchFn = vi.fn().mockResolvedValue({ content: '' });
    const msg = makeMessage('<@999>', {
      reference: { messageId: 'ref-empty' },
      channel: { id: 'ch1', messages: { fetch: fetchFn } },
    });
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Hey, what can I help you with?' }),
      expect.anything(),
    );
  });

  it('uses default agentPath when none provided', async () => {
    const handler = createTextMessageHandler(makeClient());
    const msg = makeMessage('Hi');
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ agentPath: 'chat_with_ai/chat' }),
      expect.anything(),
    );
  });

  it('passes instanceId and channel correctly', async () => {
    const handler = createTextMessageHandler(makeClient(), undefined, 'elena');
    const msg = makeMessage('Test');
    await handler(msg);
    expect(handleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ channel: 'discord', instanceId: 'elena' }),
      expect.anything(),
    );
  });
});
