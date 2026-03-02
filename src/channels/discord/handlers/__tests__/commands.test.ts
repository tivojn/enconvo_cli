import { describe, it, expect } from 'vitest';
import { getSessionId, resetSession } from '../commands';

describe('getSessionId', () => {
  it('returns default session ID without instanceId', () => {
    expect(getSessionId('ch123')).toBe('discord-ch123');
  });

  it('includes instanceId in session ID', () => {
    expect(getSessionId('ch123', 'mavis')).toBe('discord-ch123-mavis');
  });
});

describe('resetSession', () => {
  it('returns a new session ID with UUID suffix', () => {
    const newId = resetSession('ch456');
    expect(newId).toMatch(/^discord-ch456-[a-f0-9]{8}$/);
  });

  it('includes instanceId in reset session ID', () => {
    const newId = resetSession('ch456', 'elena');
    expect(newId).toMatch(/^discord-ch456-elena-[a-f0-9]{8}$/);
  });

  it('overrides getSessionId after reset', () => {
    const newId = resetSession('ch789');
    expect(getSessionId('ch789')).toBe(newId);
  });

  it('overrides are per-channel+instance', () => {
    resetSession('ch100', 'bot1');
    // Different instance should still have default
    expect(getSessionId('ch100', 'bot2')).toBe('discord-ch100-bot2');
  });

  it('generates different IDs on each reset', () => {
    const id1 = resetSession('ch200');
    const id2 = resetSession('ch200');
    expect(id1).not.toBe(id2);
  });
});
