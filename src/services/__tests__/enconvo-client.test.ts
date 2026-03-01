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

  it('throws on 500 server error', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
    }) as any;

    await expect(callEnConvo('test', 'session')).rejects.toThrow('500');
  });

  it('throws on 503 service unavailable', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
    }) as any;

    await expect(callEnConvo('test', 'session')).rejects.toThrow('503');
  });

  it('throws on network error (fetch failed)', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as any;

    await expect(callEnConvo('test', 'session')).rejects.toThrow('fetch failed');
  });

  it('throws AbortError on timeout', async () => {
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      // Simulate waiting until the abort signal fires
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const err = new DOMException('The operation was aborted', 'AbortError');
          reject(err);
        });
      });
    }) as any;

    await expect(
      callEnConvo('test', 'session', 'chat_with_ai/chat', { timeoutMs: 50 }),
    ).rejects.toThrow('aborted');
  });

  it('uses default agent path when none specified', async () => {
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: any) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    }) as any;

    await callEnConvo('test', 'session');
    expect(capturedUrl).toContain('/command/call/chat_with_ai/chat');
  });

  it('uses custom timeout from options', async () => {
    let signalUsed = false;
    globalThis.fetch = vi.fn(async (_url: any, opts: any) => {
      signalUsed = opts.signal instanceof AbortSignal;
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
    }) as any;

    await callEnConvo('test', 'session', 'chat_with_ai/chat', { timeoutMs: 5000 });
    expect(signalUsed).toBe(true);
  });

  it('handles empty response body gracefully', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('{}', { status: 200 });
    }) as any;

    const result = await callEnConvo('test', 'session');
    expect(result).toEqual({});
  });

  it('includes error status text in error message', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('', { status: 429, statusText: 'Too Many Requests' });
    }) as any;

    await expect(callEnConvo('test', 'session')).rejects.toThrow('Too Many Requests');
  });
});
