import { describe, it, expect } from 'vitest';
import { splitMessage, TELEGRAM_MAX_LENGTH, DISCORD_MAX_LENGTH } from '../message-splitter';

describe('splitMessage', () => {
  it('returns single chunk for short text', () => {
    const result = splitMessage('Hello world');
    expect(result).toEqual(['Hello world']);
  });

  it('returns single chunk at exact max length', () => {
    const text = 'a'.repeat(100);
    const result = splitMessage(text, 100);
    expect(result).toEqual([text]);
  });

  it('splits at paragraph boundary', () => {
    const para1 = 'a'.repeat(60);
    const para2 = 'b'.repeat(60);
    const text = `${para1}\n\n${para2}`;
    const result = splitMessage(text, 80);
    expect(result).toEqual([para1, para2]);
  });

  it('splits at line boundary when no paragraph break', () => {
    const line1 = 'a'.repeat(60);
    const line2 = 'b'.repeat(60);
    const text = `${line1}\n${line2}`;
    const result = splitMessage(text, 80);
    expect(result).toEqual([line1, line2]);
  });

  it('splits at space when no line break', () => {
    const word1 = 'a'.repeat(50);
    const word2 = 'b'.repeat(50);
    const text = `${word1} ${word2}`;
    const result = splitMessage(text, 70);
    expect(result).toEqual([word1, word2]);
  });

  it('hard splits when no natural boundary', () => {
    const text = 'a'.repeat(200);
    const result = splitMessage(text, 100);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(100);
    expect(result[1]).toHaveLength(100);
  });

  it('uses Telegram max by default', () => {
    const text = 'a'.repeat(4096);
    const result = splitMessage(text);
    expect(result).toHaveLength(1);
  });

  it('handles custom maxLength for Discord', () => {
    const text = 'a'.repeat(2001);
    const result = splitMessage(text, DISCORD_MAX_LENGTH);
    expect(result).toHaveLength(2);
  });

  it('preserves content across all chunks', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const result = splitMessage(text, 100);
    const rejoined = result.join(' ');
    // All original words should be present
    for (const word of words) {
      expect(rejoined).toContain(word);
    }
  });

  it('trims whitespace at chunk boundaries', () => {
    const text = 'aaa bbb';
    const result = splitMessage(text, 4);
    expect(result[0]).toBe('aaa');
    expect(result[1]).toBe('bbb');
  });
});

describe('constants', () => {
  it('exports correct Telegram limit', () => {
    expect(TELEGRAM_MAX_LENGTH).toBe(4096);
  });

  it('exports correct Discord limit', () => {
    expect(DISCORD_MAX_LENGTH).toBe(2000);
  });
});
