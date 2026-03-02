import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../middleware/typing', () => ({
  startTypingIndicator: vi.fn().mockReturnValue({ stop: vi.fn() }),
}));

vi.mock('discord.js', () => ({
  AttachmentBuilder: class AttachmentBuilder {
    path: string;
    constructor(p: string) { this.path = p; }
  },
}));

import { sendFile, createDiscordIO } from '../file-sender';

function makeMessage(overrides: Record<string, unknown> = {}): any {
  return {
    reply: vi.fn(),
    channel: { send: vi.fn(), sendTyping: vi.fn() },
    ...overrides,
  };
}

describe('sendFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replies with file when target is a Message', async () => {
    const msg = makeMessage();
    await sendFile(msg, '/tmp/file.txt');
    expect(msg.reply).toHaveBeenCalledWith({ files: [expect.anything()] });
  });

  it('sends to channel when target is a TextChannel', async () => {
    const channel = { send: vi.fn() } as any;
    await sendFile(channel, '/tmp/file.txt');
    expect(channel.send).toHaveBeenCalledWith({ files: [expect.anything()] });
  });
});

describe('createDiscordIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ChannelIO with correct maxMessageLength', () => {
    const io = createDiscordIO(makeMessage());
    expect(io.maxMessageLength).toBe(2000);
  });

  it('sendText replies to message', async () => {
    const msg = makeMessage();
    const io = createDiscordIO(msg);
    await io.sendText('Hello');
    expect(msg.reply).toHaveBeenCalledWith('Hello');
  });

  it('sendFile replies with file attachment', async () => {
    const msg = makeMessage();
    const io = createDiscordIO(msg);
    await io.sendFile('/tmp/data.csv');
    expect(msg.reply).toHaveBeenCalledWith({ files: [expect.anything()] });
  });

  it('startTyping returns object with stop method', () => {
    const io = createDiscordIO(makeMessage());
    const indicator = io.startTyping();
    expect(indicator).toHaveProperty('stop');
    expect(typeof indicator.stop).toBe('function');
  });
});
