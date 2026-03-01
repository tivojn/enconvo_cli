import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callEnConvo } from '../enconvo-client';

describe('callEnConvo', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls the correct URL with agent path', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    }) as any;

    await callEnConvo('hello', 'session-1', 'chat_with_ai/chat');
    expect(capturedUrl).toContain('/command/call/chat_with_ai/chat');
  });

  it('sends input_text and sessionId in body', async () => {
    let capturedBody: any;
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    }) as any;

    await callEnConvo('hello world', 'my-session');
    expect(capturedBody.input_text).toBe('hello world');
    expect(capturedBody.sessionId).toBe('my-session');
  });

  it('uses custom URL from options', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    }) as any;

    await callEnConvo('test', 'session', 'chat_with_ai/chat', { url: 'http://custom:9999' });
    expect(capturedUrl).toContain('http://custom:9999');
  });

  it('throws on non-200 response', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }) as any;

    await expect(callEnConvo('test', 'session')).rejects.toThrow('404');
  });

  it('returns parsed JSON response', async () => {
    const mockResponse = { type: 'messages', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }] };
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockResponse), { status: 200 });
    }) as any;

    const result = await callEnConvo('test', 'session');
    expect(result.type).toBe('messages');
    expect(result.messages).toHaveLength(1);
  });
});
