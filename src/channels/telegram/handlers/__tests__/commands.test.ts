import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/session-manager', () => ({
  resetSession: vi.fn().mockReturnValue('tg-123-abc12345'),
  getSessionId: vi.fn().mockReturnValue('tg-123'),
  getAgent: vi.fn().mockReturnValue({ id: 'default', name: 'Default Agent', path: 'chat_with_ai/chat', description: 'General AI' }),
  setAgent: vi.fn().mockReturnValue({ name: 'Custom Bot', description: 'A custom bot' }),
}));

vi.mock('../../../../config/store', () => ({
  loadGlobalConfig: vi.fn().mockReturnValue({
    enconvo: {
      url: 'http://localhost:54535',
      timeoutMs: 30000,
      agents: [
        { id: 'default', name: 'Default Agent', path: 'chat_with_ai/chat', description: 'General AI' },
        { id: 'custom', name: 'Custom Bot', path: 'custom_bot/abc', description: 'Specialized bot' },
      ],
    },
  }),
}));

import { registerCommands } from '../commands';
import { setAgent } from '../../../../services/session-manager';

type CommandHandler = (ctx: any) => Promise<void>;

// Capture handlers registered via bot.command()
function createMockBot() {
  const handlers = new Map<string, CommandHandler>();
  const bot = {
    command: vi.fn((nameOrNames: string | string[], handler: CommandHandler) => {
      const names = Array.isArray(nameOrNames) ? nameOrNames : [nameOrNames];
      for (const name of names) {
        handlers.set(name, handler);
      }
    }),
  } as any;
  return { bot, handlers };
}

function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    chat: { id: 123, type: 'private' },
    me: { username: 'TestBot', id: 99 },
    message: { text: '' },
    reply: vi.fn(),
    ...overrides,
  };
}

describe('registerCommands (pinned mode)', () => {
  let handlers: Map<string, CommandHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockBot();
    handlers = mock.handlers;
    registerCommands(mock.bot, 'custom_bot/abc', 'mavis');
  });

  it('registers start, help, agent, reset, status commands', () => {
    expect(handlers.has('start')).toBe(true);
    expect(handlers.has('help')).toBe(true);
    expect(handlers.has('agent')).toBe(true);
    expect(handlers.has('reset')).toBe(true);
    expect(handlers.has('status')).toBe(true);
  });

  it('/start shows dedicated agent message', async () => {
    const ctx = makeCtx();
    await handlers.get('start')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('custom_bot/abc'));
  });

  it('/start includes group tip in group chat', async () => {
    const ctx = makeCtx({ chat: { id: 123, type: 'group' } });
    await handlers.get('start')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('@TestBot'));
  });

  it('/help shows pinned agent info', async () => {
    const ctx = makeCtx();
    await handlers.get('help')!(ctx);
    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('dedicated instance');
    expect(text).toContain('custom_bot/abc');
  });

  it('/agent tells user switching is not available', async () => {
    const ctx = makeCtx({ message: { text: '/agent' } });
    await handlers.get('agent')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not available'));
  });

  it('/reset calls resetSession and replies', async () => {
    const ctx = makeCtx();
    await handlers.get('reset')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Session reset'));
  });

  it('/status with healthy EnConvo shows Connected', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    const ctx = makeCtx();
    await handlers.get('status')!(ctx);
    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('Connected');
    expect(text).toContain('custom_bot/abc (pinned)');
  });

  it('/status with failed health check shows error code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    const ctx = makeCtx();
    await handlers.get('status')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('/status with unreachable EnConvo shows error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const ctx = makeCtx();
    await handlers.get('status')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Cannot reach'));
  });
});

describe('registerCommands (legacy mode)', () => {
  let handlers: Map<string, CommandHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mock = createMockBot();
    handlers = mock.handlers;
    registerCommands(mock.bot); // no pinned path
  });

  it('/start shows current agent name', async () => {
    const ctx = makeCtx();
    await handlers.get('start')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Default Agent'));
  });

  it('/help shows agent switching command', async () => {
    const ctx = makeCtx();
    await handlers.get('help')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('/agent'));
  });

  it('/agent with no args lists available agents', async () => {
    const ctx = makeCtx({ message: { text: '/agent' } });
    await handlers.get('agent')!(ctx);
    const text = ctx.reply.mock.calls[0][0] as string;
    expect(text).toContain('Default Agent');
    expect(text).toContain('Custom Bot');
    expect(text).toContain('(active)');
  });

  it('/agent with valid id switches agent', async () => {
    const ctx = makeCtx({ message: { text: '/agent custom' } });
    await handlers.get('agent')!(ctx);
    expect(setAgent).toHaveBeenCalledWith(123, 'custom');
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Switched to Custom Bot'));
  });

  it('/agent with unknown id shows error', async () => {
    vi.mocked(setAgent).mockReturnValueOnce(null as any);
    const ctx = makeCtx({ message: { text: '/agent nonexistent' } });
    await handlers.get('agent')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Unknown agent'));
  });

  it('/status shows agent name (not pinned)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
    const ctx = makeCtx();
    await handlers.get('status')!(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Default Agent'));
  });
});
