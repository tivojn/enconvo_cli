import { describe, it, expect, vi, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { buildLogPaths, buildServiceLabel, formatUptime } from '../adapter-helpers';

describe('buildLogPaths', () => {
  it('uses "adapter" suffix by default', () => {
    const paths = buildLogPaths('telegram');
    expect(paths.stdout).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-adapter.log'));
    expect(paths.stderr).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-adapter-error.log'));
  });

  it('uses instanceName when provided', () => {
    const paths = buildLogPaths('discord', 'mavis');
    expect(paths.stdout).toContain('enconvo-discord-mavis.log');
    expect(paths.stderr).toContain('enconvo-discord-mavis-error.log');
  });

  it('works with any channel name', () => {
    const paths = buildLogPaths('slack', 'bot1');
    expect(paths.stdout).toContain('enconvo-slack-bot1.log');
  });
});

describe('buildServiceLabel', () => {
  it('uses "adapter" suffix by default', () => {
    expect(buildServiceLabel('telegram')).toBe('com.enconvo.telegram-adapter');
  });

  it('uses instanceName when provided', () => {
    expect(buildServiceLabel('discord', 'elena')).toBe('com.enconvo.discord-elena');
  });
});

describe('formatUptime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats seconds correctly', () => {
    vi.useFakeTimers();
    const start = new Date(Date.now() - 45_000); // 45 seconds ago
    expect(formatUptime(start)).toBe('0m 45s');
  });

  it('formats minutes and seconds', () => {
    vi.useFakeTimers();
    const start = new Date(Date.now() - 185_000); // 3m 5s
    expect(formatUptime(start)).toBe('3m 5s');
  });

  it('formats hours and minutes', () => {
    vi.useFakeTimers();
    const start = new Date(Date.now() - 7500_000); // 2h 5m
    expect(formatUptime(start)).toBe('2h 5m');
  });

  it('shows 0m 0s for just-started', () => {
    vi.useFakeTimers();
    const start = new Date(Date.now());
    expect(formatUptime(start)).toBe('0m 0s');
  });
});
