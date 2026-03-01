const MAX_LENGTH = 4096;

export function splitMessage(text: string): string[] {
  if (text.length <= MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > MAX_LENGTH) {
    let splitAt = -1;

    // Try to split at paragraph boundary
    const paragraphBreak = remaining.lastIndexOf('\n\n', MAX_LENGTH);
    if (paragraphBreak > MAX_LENGTH * 0.3) {
      splitAt = paragraphBreak;
    }

    // Try line boundary
    if (splitAt === -1) {
      const lineBreak = remaining.lastIndexOf('\n', MAX_LENGTH);
      if (lineBreak > MAX_LENGTH * 0.3) {
        splitAt = lineBreak;
      }
    }

    // Try space
    if (splitAt === -1) {
      const space = remaining.lastIndexOf(' ', MAX_LENGTH);
      if (space > MAX_LENGTH * 0.3) {
        splitAt = space;
      }
    }

    // Hard split as last resort
    if (splitAt === -1) {
      splitAt = MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
