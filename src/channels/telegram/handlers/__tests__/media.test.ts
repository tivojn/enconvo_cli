import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHandleMessage } = vi.hoisted(() => ({
  mockHandleMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, writeFileSync: vi.fn() };
});

vi.mock('../../../../services/session-manager', () => ({
  getSessionId: vi.fn().mockReturnValue('tg-123'),
  getAgent: vi.fn().mockReturnValue({ path: 'chat_with_ai/chat' }),
}));

vi.mock('../../../../services/handler-core', () => ({
  handleMessage: (...args: unknown[]) => mockHandleMessage(...args),
  buildRosterContext: vi.fn().mockReturnValue({ rosterIds: [], handleMap: {}, members: [] }),
}));

vi.mock('../../utils/telegram-io', () => ({
  createTelegramIO: vi.fn().mockReturnValue({
    maxMessageLength: 4096,
    sendText: vi.fn(),
    sendFile: vi.fn(),
    startTyping: vi.fn().mockReturnValue({ stop: vi.fn() }),
  }),
}));

vi.mock('../../../../utils/media-dir', () => ({
  ensureMediaDir: vi.fn().mockReturnValue('/tmp/test-media'),
}));

import { createPhotoHandler, createDocumentHandler } from '../media';

function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    chat: { id: 123 },
    message: {
      photo: [
        { file_id: 'small', width: 100, height: 100 },
        { file_id: 'large', width: 800, height: 800 },
      ],
      caption: 'Check this out',
      document: null,
    },
    api: {
      token: 'test-token',
      getFile: vi.fn().mockResolvedValue({
        file_unique_id: 'uniq1',
        file_path: 'photos/file_1.jpg',
      }),
    },
    reply: vi.fn(),
    ...overrides,
  };
}

describe('createPhotoHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);
  });

  it('downloads largest photo and calls handleMessage', async () => {
    const handler = createPhotoHandler('custom_bot/abc');
    await handler(makeCtx());

    expect(mockHandleMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        text: expect.stringContaining('Check this out'),
        agentPath: 'custom_bot/abc',
        channel: 'telegram',
        chatId: '123',
      }),
      expect.anything(),
    );
  });

  it('includes image path ref in input text', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx());
    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('[Attached image:');
    expect(ctx.text).toContain('.jpg');
  });

  it('uses caption fallback when no caption', async () => {
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    ctx.message.caption = undefined;
    await handler(ctx);
    const handlerCtx = mockHandleMessage.mock.calls[0][1];
    expect(handlerCtx.text).toContain('User sent a photo');
  });

  it('skips when no chatId', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx({ chat: undefined }));
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('skips when no photos', async () => {
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    ctx.message.photo = [];
    await handler(ctx);
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('replies with download error on fetch failure', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('Failed to download the photo.');
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('passes roster context to handleMessage', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx());
    const roster = mockHandleMessage.mock.calls[0][2];
    expect(roster).toEqual({ rosterIds: [], handleMap: {}, members: [] });
  });
});

describe('createDocumentHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);
  });

  function makeDocCtx(overrides: Record<string, unknown> = {}): any {
    return {
      chat: { id: 456 },
      message: {
        photo: null,
        caption: 'Here is a PDF',
        document: { file_id: 'doc-1', file_name: 'report.pdf' },
      },
      api: {
        token: 'test-token',
        getFile: vi.fn().mockResolvedValue({
          file_unique_id: 'uniq-doc',
          file_path: 'documents/file_2.pdf',
        }),
      },
      reply: vi.fn(),
      ...overrides,
    };
  }

  it('downloads document and calls handleMessage', async () => {
    const handler = createDocumentHandler('custom_bot/xyz');
    await handler(makeDocCtx());
    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('Here is a PDF');
    expect(ctx.agentPath).toBe('custom_bot/xyz');
    expect(ctx.channel).toBe('telegram');
    expect(ctx.chatId).toBe('456');
  });

  it('includes file path ref in input text', async () => {
    const handler = createDocumentHandler();
    await handler(makeDocCtx());
    const ctx = mockHandleMessage.mock.calls[0][1];
    expect(ctx.text).toContain('[Attached file:');
    expect(ctx.text).toContain('.pdf');
  });

  it('uses caption fallback when no caption', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.caption = undefined;
    await handler(ctx);
    const handlerCtx = mockHandleMessage.mock.calls[0][1];
    expect(handlerCtx.text).toContain('User sent a document');
  });

  it('skips when no chatId', async () => {
    const handler = createDocumentHandler();
    await handler(makeDocCtx({ chat: undefined }));
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('skips when no document', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = null;
    await handler(ctx);
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('replies with download error on fetch failure', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Disk full'));
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('Failed to download the document.');
    expect(mockHandleMessage).not.toHaveBeenCalled();
  });

  it('uses .bin extension when file_name is missing', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = { file_id: 'doc-2', file_name: undefined };
    await handler(ctx);
    const handlerCtx = mockHandleMessage.mock.calls[0][1];
    expect(handlerCtx.text).toContain('.bin');
  });

  it('uses .bin extension when file has no extension', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = { file_id: 'doc-3', file_name: 'Makefile' };
    await handler(ctx);
    const handlerCtx = mockHandleMessage.mock.calls[0][1];
    expect(handlerCtx.text).toContain('.bin');
  });
});
