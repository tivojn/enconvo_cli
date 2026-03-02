import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-data')),
  };
});

// Mock grammy
const mockSendMessage = vi.fn().mockResolvedValue({});
const mockSendPhoto = vi.fn().mockResolvedValue({});
const mockSendDocument = vi.fn().mockResolvedValue({});

vi.mock('grammy', () => {
  class MockBot {
    api = {
      sendMessage: mockSendMessage,
      sendPhoto: mockSendPhoto,
      sendDocument: mockSendDocument,
    };
  }
  class MockInputFile {
    path: string;
    constructor(p: string) { this.path = p; }
  }
  return { Bot: MockBot, InputFile: MockInputFile };
});

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  text: vi.fn().mockResolvedValue(''),
});
vi.stubGlobal('fetch', mockFetch);

import * as fs from 'fs';
import { deliverTelegram, deliverDiscord } from '../channel-deliver';
import { ParsedResponse } from '../response-parser';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.existsSync).mockReturnValue(true);
  mockFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue('') });
});

describe('deliverTelegram', () => {
  it('sends text with Markdown parse mode', async () => {
    const parsed: ParsedResponse = { text: 'Hello!', filePaths: [], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendMessage).toHaveBeenCalledWith('123', 'Hello!', { parse_mode: 'Markdown' });
  });

  it('falls back to plain text when Markdown fails', async () => {
    mockSendMessage
      .mockRejectedValueOnce(new Error('parse error'))
      .mockResolvedValueOnce({});
    const parsed: ParsedResponse = { text: 'Hello **bad**', filePaths: [], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    // Second call should be plain text (no parse_mode)
    expect(mockSendMessage).toHaveBeenLastCalledWith('123', 'Hello **bad**');
  });

  it('skips text when empty', async () => {
    const parsed: ParsedResponse = { text: '', filePaths: ['/tmp/x.jpg'], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends image files as photos', async () => {
    const parsed: ParsedResponse = { text: '', filePaths: ['/tmp/pic.jpg'], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendPhoto).toHaveBeenCalledTimes(1);
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it('sends non-image files as documents', async () => {
    const parsed: ParsedResponse = { text: '', filePaths: ['/tmp/doc.pdf'], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendDocument).toHaveBeenCalledTimes(1);
    expect(mockSendPhoto).not.toHaveBeenCalled();
  });

  it('skips files that do not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const parsed: ParsedResponse = { text: '', filePaths: ['/tmp/gone.pdf'], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendPhoto).not.toHaveBeenCalled();
    expect(mockSendDocument).not.toHaveBeenCalled();
  });

  it('handles both text and files', async () => {
    const parsed: ParsedResponse = { text: 'Hi', filePaths: ['/tmp/a.pdf'], delegations: [] };
    await deliverTelegram('token', '123', parsed);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendDocument).toHaveBeenCalledTimes(1);
  });
});

describe('deliverDiscord', () => {
  it('sends text via Discord REST API', async () => {
    const parsed: ParsedResponse = { text: 'Hello!', filePaths: [], delegations: [] };
    await deliverDiscord('token', 'ch1', parsed);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://discord.com/api/v10/channels/ch1/messages');
    expect(JSON.parse(call[1].body)).toEqual({ content: 'Hello!' });
  });

  it('includes correct auth headers', async () => {
    const parsed: ParsedResponse = { text: 'hi', filePaths: [], delegations: [] };
    await deliverDiscord('mytoken', 'ch1', parsed);
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bot mytoken');
  });

  it('skips text when empty', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const parsed: ParsedResponse = { text: '', filePaths: [], delegations: [] };
    await deliverDiscord('token', 'ch1', parsed);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('Forbidden'),
    });
    const parsed: ParsedResponse = { text: 'hi', filePaths: [], delegations: [] };
    await expect(deliverDiscord('token', 'ch1', parsed)).rejects.toThrow('Discord API 403');
  });

  it('skips files that do not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const parsed: ParsedResponse = { text: 'msg', filePaths: ['/tmp/gone.pdf'], delegations: [] };
    await deliverDiscord('token', 'ch1', parsed);
    // Only one fetch call for text, none for file
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws on file upload failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') }) // text ok
      .mockResolvedValueOnce({ ok: false, status: 413, text: vi.fn().mockResolvedValue('Too large') }); // file fail

    const parsed: ParsedResponse = { text: 'hi', filePaths: ['/tmp/big.pdf'], delegations: [] };
    await expect(deliverDiscord('token', 'ch1', parsed)).rejects.toThrow('Discord file upload 413');
  });
});
