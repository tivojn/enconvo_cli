import { describe, it, expect, vi } from 'vitest';
import { createAuthMiddleware } from '../auth';

function makeCtx(userId?: number) {
  return {
    from: userId !== undefined ? { id: userId } : undefined,
    reply: vi.fn(),
  } as any;
}

describe('createAuthMiddleware', () => {
  it('passes through when allowlist is empty (open mode)', async () => {
    const middleware = createAuthMiddleware([]);
    const next = vi.fn();
    await middleware(makeCtx(12345), next);
    expect(next).toHaveBeenCalled();
  });

  it('passes through when no allowlist provided (open mode)', async () => {
    const middleware = createAuthMiddleware();
    const next = vi.fn();
    await middleware(makeCtx(12345), next);
    expect(next).toHaveBeenCalled();
  });

  it('allows user on the allowlist', async () => {
    const middleware = createAuthMiddleware([111, 222]);
    const next = vi.fn();
    await middleware(makeCtx(222), next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks user not on the allowlist', async () => {
    const middleware = createAuthMiddleware([111, 222]);
    const ctx = makeCtx(999);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Access denied'));
  });

  it('blocks when ctx.from is undefined', async () => {
    const middleware = createAuthMiddleware([111]);
    const ctx = makeCtx(undefined);
    ctx.from = undefined;
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });
});
