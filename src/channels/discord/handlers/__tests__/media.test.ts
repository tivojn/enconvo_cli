import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandleMessage } = vi.hoisted(() => ({
  mockHandleMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, writeFileSync: vi.fn() };
});

vi.mock('../../../../config/store', () => ({
  loadGlobalConfig: vi.fn().mockReturnValue({
    enconvo: { url: 'http://localhost:54535', timeoutMs: 30000 },
  }),
}));

vi.mock('../../../../services/handler-core', () => ({
  handleMessage: (...args: unknown[]) => mockHandleMessage(...args),
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
  getSessionId: vi.fn().mockReturnValue('discord-ch1'),
}));

vi.mock('../../../../utils/media-dir', () => ({
  ensureMediaDir: vi.fn().mockReturnValue('/tmp/test-media'),
}));

import { createMediaHandler } from '../media';

function makeMessage(overrides: Record<string, unknown> = {}): any {
  const attachments = new Map();
  return {
    content: 'Check this file',
    channel: { id: 'ch1' },
    attachments,
    reply: vi.fn(),
    ...overrides,
  };
}

function addAttachment(msg: any, name: string, url: string) {
  msg.attachments.set(name, { name, url });
}

describe('createMediaHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);
  });

  it('downloads attachments and calls handleMessage', async () => {
    const handler = createMediaHandler('custom_bot/abc', 'mavis');
    const msg = makeMessage();
    addAttachment(msg, 'photo.jpg', 'https://cdn.discord.com/photo.jpg');
    await handler(msg);

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.discord.com/photo.jpg');
    expect(mockHandleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        text: expect.stringContaining('Check this file'),
        agentPath: 'custom_bot/abc',
        channel: 'discord',
        chatId: 'ch1',
        instanceId: 'mavis',
      }),
      expect.anything(),
    );
  });

  it('includes file path references in input text', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'doc.pdf', 'https://cdn.discord.com/doc.pdf');
    await handler(msg);

    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('[Attached file:');
    expect(ctx.text).toContain('doc.pdf');
  });

  it('handles multiple attachments', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'a.jpg', 'https://cdn.discord.com/a.jpg');
    addAttachment(msg, 'b.png', 'https://cdn.discord.com/b.png');
    await handler(msg);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('a.jpg');
    expect(ctx.text).toContain('b.png');
  });

  it('uses caption fallback when no content', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage({ content: '' });
    addAttachment(msg, 'file.bin', 'https://cdn.discord.com/file.bin');
    await handler(msg);

    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('User sent a file');
  });

  it('replies with download error on fetch failure', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'y.txt', 'https://cdn.discord.com/y.txt');
    await handler(msg);

    expect(msg.reply).toHaveBeenCalledWith('Failed to download the attachment.');
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('defaults agentPath to chat_with_ai/chat', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'z.txt', 'https://cdn.discord.com/z.txt');
    await handler(msg);

    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.agentPath).toBe('chat_with_ai/chat');
  });

  it('passes apiOptions from global config', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'img.png', 'https://cdn.discord.com/img.png');
    await handler(msg);

    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.apiOptions).toEqual({
      url: 'http://localhost:54535',
      timeoutMs: 30000,
    });
  });

  it('passes roster context to handleMessage', async () => {
    const handler = createMediaHandler();
    const msg = makeMessage();
    addAttachment(msg, 'x.txt', 'https://cdn.discord.com/x.txt');
    await handler(msg);

    const roster = mockHandleMessage.mock.calls[0][2];
    expect(roster).toEqual({ rosterIds: [], handleMap: {}, members: [] });
  });
});
