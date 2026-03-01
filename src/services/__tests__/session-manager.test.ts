import { describe, it, expect } from 'vitest';
import { getSessionId, resetSession } from '../session-manager';

describe('session-manager', () => {
  describe('getSessionId', () => {
    it('generates default session ID from chatId', () => {
      const id = getSessionId(12345);
      expect(id).toBe('telegram-12345');
    });

    it('includes instanceId when provided', () => {
      const id = getSessionId(12345, 'mavis');
      expect(id).toBe('telegram-12345-mavis');
    });

    it('returns consistent ID for same chatId', () => {
      const id1 = getSessionId(99999);
      const id2 = getSessionId(99999);
      expect(id1).toBe(id2);
    });
  });

  describe('resetSession', () => {
    it('returns a new unique session ID', () => {
      const original = getSessionId(88888);
      const reset = resetSession(88888);
      expect(reset).not.toBe(original);
      expect(reset).toContain('telegram-88888');
    });

    it('subsequent getSessionId returns the reset ID', () => {
      const reset = resetSession(77777);
      const get = getSessionId(77777);
      expect(get).toBe(reset);
    });

    it('includes instanceId in reset', () => {
      const reset = resetSession(66666, 'elena');
      expect(reset).toContain('telegram-66666-elena-');
    });

    it('generates different IDs on each reset', () => {
      const reset1 = resetSession(55555);
      const reset2 = resetSession(55555);
      expect(reset1).not.toBe(reset2);
    });
  });
});
