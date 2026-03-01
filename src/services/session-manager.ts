import * as crypto from 'crypto';

const overrides = new Map<number, string>();

export function getSessionId(chatId: number): string {
  return overrides.get(chatId) ?? `telegram-${chatId}`;
}

export function resetSession(chatId: number): string {
  const newId = `telegram-${chatId}-${crypto.randomUUID().slice(0, 8)}`;
  overrides.set(chatId, newId);
  return newId;
}
