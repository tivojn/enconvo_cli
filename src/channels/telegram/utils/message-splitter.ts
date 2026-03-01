import { splitMessage as _split, TELEGRAM_MAX_LENGTH } from '../../../utils/message-splitter';

/** Telegram-specific split (4096 chars) */
export function splitMessage(text: string): string[] {
  return _split(text, TELEGRAM_MAX_LENGTH);
}
