import { splitMessage as _split, DISCORD_MAX_LENGTH } from '../../../utils/message-splitter';

/** Discord-specific split (2000 chars) */
export function splitMessage(text: string): string[] {
  return _split(text, DISCORD_MAX_LENGTH);
}
