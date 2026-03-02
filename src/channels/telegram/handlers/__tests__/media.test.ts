import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCallEnConvo, mockParseResponse, mockStop } = vi.hoisted(() => ({
  mockCallEnConvo: vi.fn().mockResolvedValue('AI photo response'),
  mockParseResponse: vi.fn().mockReturnValue({ text: 'parsed', filePaths: [] }),
  mockStop: vi.fn(),
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
  sendParsedResponse: vi.fn(),
}));

vi.mock('../../../../services/enconvo-client', () => ({
  callEnConvo: (...args: unknown[]) => mockCallEnConvo(...args),
}));

vi.mock('../../../../services/response-parser', () => ({
  parseResponse: (...args: unknown[]) => mockParseResponse(...args),
}));

vi.mock('../../utils/telegram-io', () => ({
  createTelegramIO: vi.fn().mockReturnValue({
    maxMessageLength: 4096,
    sendText: vi.fn(),
    sendFile: vi.fn(),
    startTyping: vi.fn().mockReturnValue({ stop: mockStop }),
  }),
}));

vi.mock('../../../../utils/media-dir', () => ({
  ensureMediaDir: vi.fn().mockReturnValue('/tmp/test-media'),
}));

import { createPhotoHandler, createDocumentHandler } from '../media';
import { sendParsedResponse } from '../../../../services/handler-core';

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

  it('downloads largest photo and calls callEnConvo', async () => {
    const handler = createPhotoHandler('custom_bot/abc');
    await handler(makeCtx());
    // Should use the last (largest) photo
    expect(makeCtx().api.getFile).not.toHaveBeenCalled(); // different instance
    expect(mockCallEnConvo).toHaveBeenCalledWith(
      expect.stringContaining('Check this out'),
      'tg-123',
      'custom_bot/abc',
    );
  });

  it('includes image path ref in input text', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx());
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('[Attached image:');
    expect(inputText).toContain('.jpg');
  });

  it('uses caption fallback when no caption', async () => {
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    ctx.message.caption = undefined;
    await handler(ctx);
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('User sent a photo');
  });

  it('skips when no chatId', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx({ chat: undefined }));
    expect(mockCallEnConvo).not.toHaveBeenCalled();
  });

  it('skips when no photos', async () => {
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    ctx.message.photo = [];
    await handler(ctx);
    expect(mockCallEnConvo).not.toHaveBeenCalled();
  });

  it('stops typing and sends parsed response on success', async () => {
    const handler = createPhotoHandler();
    await handler(makeCtx());
    expect(mockStop).toHaveBeenCalled();
    expect(sendParsedResponse).toHaveBeenCalled();
  });

  it('stops typing and replies with error on failure', async () => {
    mockCallEnConvo.mockRejectedValueOnce(new Error('API down'));
    const handler = createPhotoHandler();
    const ctx = makeCtx();
    await handler(ctx);
    expect(mockStop).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Failed to process the photo.');
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

  it('downloads document and calls callEnConvo', async () => {
    const handler = createDocumentHandler('custom_bot/xyz');
    await handler(makeDocCtx());
    expect(mockCallEnConvo).toHaveBeenCalledWith(
      expect.stringContaining('Here is a PDF'),
      expect.anything(),
      'custom_bot/xyz',
    );
  });

  it('includes file path ref in input text', async () => {
    const handler = createDocumentHandler();
    await handler(makeDocCtx());
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('[Attached file:');
    expect(inputText).toContain('.pdf');
  });

  it('uses caption fallback when no caption', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.caption = undefined;
    await handler(ctx);
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('User sent a document');
  });

  it('skips when no chatId', async () => {
    const handler = createDocumentHandler();
    await handler(makeDocCtx({ chat: undefined }));
    expect(mockCallEnConvo).not.toHaveBeenCalled();
  });

  it('skips when no document', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = null;
    await handler(ctx);
    expect(mockCallEnConvo).not.toHaveBeenCalled();
  });

  it('stops typing and replies with error on failure', async () => {
    mockCallEnConvo.mockRejectedValueOnce(new Error('timeout'));
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    await handler(ctx);
    expect(mockStop).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Failed to process the document.');
  });

  it('uses .bin extension when file_name is missing', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = { file_id: 'doc-2', file_name: undefined };
    await handler(ctx);
    expect(mockCallEnConvo).toHaveBeenCalled();
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('.bin');
  });

  it('uses .bin extension when file has no extension', async () => {
    const handler = createDocumentHandler();
    const ctx = makeDocCtx();
    ctx.message.document = { file_id: 'doc-3', file_name: 'Makefile' };
    await handler(ctx);
    const inputText = mockCallEnConvo.mock.calls[0][0] as string;
    expect(inputText).toContain('.bin');
  });
});
