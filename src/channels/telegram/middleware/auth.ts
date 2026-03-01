import { Context, NextFunction } from 'grammy';

export function createAuthMiddleware(pinnedAllowedUserIds?: number[]) {
  return async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
    const allowedIds = pinnedAllowedUserIds ?? [];

    // Empty list = open mode (anyone can use)
    if (allowedIds.length === 0) {
      return next();
    }

    const userId = ctx.from?.id;
    if (userId && allowedIds.includes(userId)) {
      return next();
    }

    await ctx.reply('Access denied. Your user ID is not in the allowlist.');
  };
}

// Legacy export — open mode (no filtering)
export const authMiddleware = createAuthMiddleware();
