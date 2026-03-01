import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelIO, HandlerContext, RosterContext, handleMessage, sendParsedResponse } from '../handler-core';

// Mock dependencies
vi.mock('../enconvo-client', () => ({
  callEnConvo: vi.fn(),
}));

vi.mock('../response-parser', () => ({
  parseResponse: vi.fn(),
}));

vi.mock('../agent-router', () => ({
  routeToAgent: vi.fn(),
}));

import { callEnConvo } from '../enconvo-client';
import { parseResponse } from '../response-parser';
import { routeToAgent } from '../agent-router';

function createMockIO(): ChannelIO & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { sendText: [], sendFile: [], startTyping: [] };
  return {
    calls,
    maxMessageLength: 4096,
    sendText: vi.fn(async (text: string) => { calls.sendText.push([text]); }),
    sendFile: vi.fn(async (path: string) => { calls.sendFile.push([path]); }),
    startTyping: vi.fn(() => {
      calls.startTyping.push([]);
      return { stop: vi.fn() };
    }),
  };
}

function createCtx(overrides?: Partial<HandlerContext>): HandlerContext {
  return {
    text: 'hello',
    sessionId: 'test-session',
    agentPath: 'chat_with_ai/chat',
    channel: 'telegram',
    chatId: '12345',
    ...overrides,
  };
}

function createRoster(overrides?: Partial<RosterContext>): RosterContext {
  return {
    rosterIds: [],
    handleMap: {},
    members: [],
    ...overrides,
  };
}

describe('handleMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls EnConvo and sends text response', async () => {
    const io = createMockIO();
    const mockResponse = { type: 'messages', messages: [] };
    vi.mocked(callEnConvo).mockResolvedValue(mockResponse);
    vi.mocked(parseResponse).mockReturnValue({ text: 'Hello!', filePaths: [], delegations: [] });

    await handleMessage(io, createCtx(), createRoster());

    expect(callEnConvo).toHaveBeenCalledWith('hello', 'test-session', 'chat_with_ai/chat', undefined);
    expect(io.sendText).toHaveBeenCalledWith('Hello!');
  });

  it('starts and stops typing indicator', async () => {
    const io = createMockIO();
    const stopFn = vi.fn();
    vi.mocked(io.startTyping).mockReturnValue({ stop: stopFn });
    vi.mocked(callEnConvo).mockResolvedValue({});
    vi.mocked(parseResponse).mockReturnValue({ text: 'ok', filePaths: [], delegations: [] });

    await handleMessage(io, createCtx(), createRoster());

    expect(io.startTyping).toHaveBeenCalled();
    expect(stopFn).toHaveBeenCalled();
  });

  it('sends empty response message when no text or files', async () => {
    const io = createMockIO();
    vi.mocked(callEnConvo).mockResolvedValue({});
    vi.mocked(parseResponse).mockReturnValue({ text: '', filePaths: [], delegations: [] });

    await handleMessage(io, createCtx(), createRoster());

    expect(io.sendText).toHaveBeenCalledWith('(EnConvo returned an empty response)');
  });

  it('handles AbortError with timeout message', async () => {
    const io = createMockIO();
    const stopFn = vi.fn();
    vi.mocked(io.startTyping).mockReturnValue({ stop: stopFn });
    const err = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(callEnConvo).mockRejectedValue(err);

    await handleMessage(io, createCtx(), createRoster());

    expect(stopFn).toHaveBeenCalled();
    expect(io.sendText).toHaveBeenCalledWith('Request timed out. EnConvo took too long to respond.');
  });

  it('handles fetch failed with connectivity message', async () => {
    const io = createMockIO();
    vi.mocked(io.startTyping).mockReturnValue({ stop: vi.fn() });
    vi.mocked(callEnConvo).mockRejectedValue(new TypeError('fetch failed'));

    await handleMessage(io, createCtx(), createRoster());

    expect(io.sendText).toHaveBeenCalledWith('Cannot reach EnConvo API. Is it running on localhost:54535?');
  });

  it('handles generic error with fallback message', async () => {
    const io = createMockIO();
    vi.mocked(io.startTyping).mockReturnValue({ stop: vi.fn() });
    vi.mocked(callEnConvo).mockRejectedValue(new Error('unknown issue'));

    await handleMessage(io, createCtx(), createRoster());

    expect(io.sendText).toHaveBeenCalledWith('Something went wrong while processing your message.');
  });

  it('handles delegations when currentAgent is set', async () => {
    const io = createMockIO();
    vi.mocked(callEnConvo).mockResolvedValue({});
    vi.mocked(parseResponse).mockReturnValue({
      text: 'Main response',
      filePaths: [],
      delegations: [{ targetAgentId: 'elena', message: 'Help with content' }],
    });
    vi.mocked(routeToAgent).mockResolvedValue({
      text: 'Content help here',
      filePaths: [],
      delegations: [],
    });

    const roster = createRoster({
      currentAgent: {
        id: 'mavis', name: 'Mavis', emoji: '👑', role: 'Lead',
        specialty: 'General', isLead: true,
        preferenceKey: 'chat_with_ai|chat',
        workspacePath: '/tmp/test',
        bindings: { agentPath: 'chat_with_ai/chat', telegramBot: '@Bot', instanceName: 'mavis' },
      },
      members: [
        {
          id: 'elena', name: 'Elena', emoji: '✍️', role: 'Content',
          specialty: 'Content', isLead: false,
          preferenceKey: 'custom_bot|abc',
          workspacePath: '/tmp/test2',
          bindings: { agentPath: 'custom_bot/abc', telegramBot: '@ElenaBot', instanceName: 'elena' },
        },
      ],
    });

    await handleMessage(io, createCtx({ channel: 'telegram', chatId: '123' }), roster);

    expect(routeToAgent).toHaveBeenCalledWith(
      'Mavis',
      { targetAgentId: 'elena', message: 'Help with content' },
      { chatId: '123', channel: 'telegram', instanceId: undefined },
    );
    // Should have sent main response + delegation header + delegation text
    expect(io.sendText).toHaveBeenCalledTimes(2);
  });

  it('skips delegations when no currentAgent', async () => {
    const io = createMockIO();
    vi.mocked(callEnConvo).mockResolvedValue({});
    vi.mocked(parseResponse).mockReturnValue({
      text: 'Response',
      filePaths: [],
      delegations: [{ targetAgentId: 'elena', message: 'test' }],
    });

    await handleMessage(io, createCtx(), createRoster());

    expect(routeToAgent).not.toHaveBeenCalled();
  });

  it('passes API options to callEnConvo', async () => {
    const io = createMockIO();
    vi.mocked(callEnConvo).mockResolvedValue({});
    vi.mocked(parseResponse).mockReturnValue({ text: 'ok', filePaths: [], delegations: [] });

    const apiOpts = { url: 'http://custom:9999', timeoutMs: 5000 };
    await handleMessage(io, createCtx({ apiOptions: apiOpts }), createRoster());

    expect(callEnConvo).toHaveBeenCalledWith('hello', 'test-session', 'chat_with_ai/chat', apiOpts);
  });
});

describe('sendParsedResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends text chunks', async () => {
    const io = createMockIO();
    await sendParsedResponse(io, { text: 'Hello world', filePaths: [], delegations: [] });
    expect(io.sendText).toHaveBeenCalledWith('Hello world');
  });

  it('reports failed file count', async () => {
    const io = createMockIO();
    await sendParsedResponse(io, {
      text: 'Response',
      filePaths: ['/nonexistent/file.txt'],
      delegations: [],
    });
    expect(io.sendText).toHaveBeenCalledWith('Response');
    expect(io.sendText).toHaveBeenCalledWith('(1 file(s) could not be delivered)');
  });

  it('sends empty response message', async () => {
    const io = createMockIO();
    await sendParsedResponse(io, { text: '', filePaths: [], delegations: [] });
    expect(io.sendText).toHaveBeenCalledWith('(EnConvo returned an empty response)');
  });
});
