/**
 * Split a long message into chunks that fit within a max character limit.
 * Prefers splitting at paragraph boundaries, then line breaks, then spaces.
 *
 * @param text The text to split
 * @param maxLength Maximum characters per chunk (default: 4096 for Telegram)
 */
export function splitMessage(text: string, maxLength: number = 4096): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let splitAt = -1;

    // Try to split at paragraph boundary
    const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.3) {
      splitAt = paragraphBreak;
    }

    // Try line boundary
    if (splitAt === -1) {
      const lineBreak = remaining.lastIndexOf('\n', maxLength);
      if (lineBreak > maxLength * 0.3) {
        splitAt = lineBreak;
      }
    }

    // Try space
    if (splitAt === -1) {
      const space = remaining.lastIndexOf(' ', maxLength);
      if (space > maxLength * 0.3) {
        splitAt = space;
      }
    }

    // Hard split as last resort
    if (splitAt === -1) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

/** Telegram message limit */
export const TELEGRAM_MAX_LENGTH = 4096;

/** Discord message limit */
export const DISCORD_MAX_LENGTH = 2000;
