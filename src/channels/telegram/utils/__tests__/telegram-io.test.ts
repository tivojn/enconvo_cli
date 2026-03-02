import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/typing', () => ({
  startTypingIndicator: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

vi.mock('grammy', () => ({
  InputFile: class InputFile { path: string; constructor(p: string) { this.path = p; } },
}));

vi.mock('../../../../utils/file-types', () => ({
  isImageFile: vi.fn((p: string) => p.endsWith('.jpg') || p.endsWith('.png')),
}));

import { createTelegramIO } from '../telegram-io';

function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    reply: vi.fn(),
    replyWithPhoto: vi.fn(),
    replyWithDocument: vi.fn(),
    ...overrides,
  };
}

describe('createTelegramIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ChannelIO with correct maxMessageLength', () => {
    const io = createTelegramIO(makeCtx());
    expect(io.maxMessageLength).toBe(4096);
  });

  describe('sendText', () => {
    it('sends with Markdown parse_mode', async () => {
      const ctx = makeCtx();
      const io = createTelegramIO(ctx);
      await io.sendText('Hello **bold**');
      expect(ctx.reply).toHaveBeenCalledWith('Hello **bold**', { parse_mode: 'Markdown' });
    });

    it('falls back to plain text when Markdown fails', async () => {
      const ctx = makeCtx();
      ctx.reply.mockRejectedValueOnce(new Error('Bad Request: can\'t parse'));
      const io = createTelegramIO(ctx);
      await io.sendText('Unmatched * asterisk');
      expect(ctx.reply).toHaveBeenCalledTimes(2);
      expect(ctx.reply).toHaveBeenLastCalledWith('Unmatched * asterisk');
    });
  });

  describe('sendFile', () => {
    it('sends images with replyWithPhoto', async () => {
      const ctx = makeCtx();
      const io = createTelegramIO(ctx);
      await io.sendFile('/tmp/photo.jpg');
      expect(ctx.replyWithPhoto).toHaveBeenCalled();
      expect(ctx.replyWithDocument).not.toHaveBeenCalled();
    });

    it('sends non-images with replyWithDocument', async () => {
      const ctx = makeCtx();
      const io = createTelegramIO(ctx);
      await io.sendFile('/tmp/report.pdf');
      expect(ctx.replyWithDocument).toHaveBeenCalled();
      expect(ctx.replyWithPhoto).not.toHaveBeenCalled();
    });
  });

  describe('startTyping', () => {
    it('returns an object with stop method', () => {
      const ctx = makeCtx();
      const io = createTelegramIO(ctx);
      const indicator = io.startTyping();
      expect(indicator).toHaveProperty('stop');
      expect(typeof indicator.stop).toBe('function');
    });
  });
});
