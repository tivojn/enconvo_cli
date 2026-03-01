import * as fs from 'fs';
import * as path from 'path';

const MEDIA_BASE = '/tmp';

export function getMediaDir(channel: string): string {
  return path.join(MEDIA_BASE, `enconvo-${channel}-media`);
}

export function ensureMediaDir(channel: string): string {
  const dir = getMediaDir(channel);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
