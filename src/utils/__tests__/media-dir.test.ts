import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import { getMediaDir, ensureMediaDir } from '../media-dir';

describe('media-dir', () => {
  const testDirs: string[] = [];

  afterEach(() => {
    for (const dir of testDirs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    testDirs.length = 0;
  });

  it('generates correct dir for telegram', () => {
    expect(getMediaDir('telegram')).toBe('/tmp/enconvo-telegram-media');
  });

  it('generates correct dir for discord', () => {
    expect(getMediaDir('discord')).toBe('/tmp/enconvo-discord-media');
  });

  it('generates unique dirs per channel', () => {
    expect(getMediaDir('telegram')).not.toBe(getMediaDir('discord'));
  });

  it('ensureMediaDir creates directory', () => {
    // Use a unique channel name to avoid collisions
    const channel = `test-${Date.now()}`;
    const dir = ensureMediaDir(channel);
    testDirs.push(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('ensureMediaDir returns the dir path', () => {
    const channel = `test-return-${Date.now()}`;
    const dir = ensureMediaDir(channel);
    testDirs.push(dir);
    expect(dir).toBe(getMediaDir(channel));
  });

  it('ensureMediaDir is idempotent', () => {
    const channel = `test-idem-${Date.now()}`;
    const dir1 = ensureMediaDir(channel);
    const dir2 = ensureMediaDir(channel);
    testDirs.push(dir1);
    expect(dir1).toBe(dir2);
    expect(fs.existsSync(dir1)).toBe(true);
  });
});
