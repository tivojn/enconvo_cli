import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { DiscordAdapter } from '../adapter';

describe('DiscordAdapter', () => {
  describe('info', () => {
    it('has correct channel name', () => {
      const adapter = new DiscordAdapter();
      expect(adapter.info.name).toBe('discord');
    });

    it('has display name and version', () => {
      const adapter = new DiscordAdapter();
      expect(adapter.info.displayName).toBe('Discord');
      expect(adapter.info.version).toBe('1.0.0');
    });
  });

  describe('capabilities', () => {
    it('supports text, images, documents, group chats', () => {
      const adapter = new DiscordAdapter();
      expect(adapter.capabilities.text).toBe(true);
      expect(adapter.capabilities.images).toBe(true);
      expect(adapter.capabilities.documents).toBe(true);
      expect(adapter.capabilities.groupChats).toBe(true);
      expect(adapter.capabilities.multiAccount).toBe(true);
    });

    it('does not support audio or video', () => {
      const adapter = new DiscordAdapter();
      expect(adapter.capabilities.audio).toBe(false);
      expect(adapter.capabilities.video).toBe(false);
    });
  });

  describe('getLogPaths', () => {
    it('returns default log paths when no instanceName', () => {
      const adapter = new DiscordAdapter();
      const paths = adapter.getLogPaths();
      expect(paths.stdout).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-discord-adapter.log'));
      expect(paths.stderr).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-discord-adapter-error.log'));
    });

    it('uses instanceName in log paths', () => {
      const adapter = new DiscordAdapter();
      adapter.instanceName = 'mavis';
      const paths = adapter.getLogPaths();
      expect(paths.stdout).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-discord-mavis.log'));
      expect(paths.stderr).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-discord-mavis-error.log'));
    });
  });

  describe('getServiceLabel', () => {
    it('returns default label when no instanceName', () => {
      const adapter = new DiscordAdapter();
      expect(adapter.getServiceLabel()).toBe('com.enconvo.discord-adapter');
    });

    it('includes instanceName in label', () => {
      const adapter = new DiscordAdapter();
      adapter.instanceName = 'elena';
      expect(adapter.getServiceLabel()).toBe('com.enconvo.discord-elena');
    });
  });

  describe('getStatus', () => {
    it('returns not running when no client started', async () => {
      const adapter = new DiscordAdapter();
      const status = await adapter.getStatus();
      expect(status.running).toBe(false);
      expect(status.details).toEqual({});
    });

    it('includes instance name in details', async () => {
      const adapter = new DiscordAdapter();
      adapter.instanceName = 'mavis';
      const status = await adapter.getStatus();
      expect(status.details.instance).toBe('mavis');
    });
  });

  describe('resolve', () => {
    it('returns not found when client not running', async () => {
      const adapter = new DiscordAdapter();
      const result = await adapter.resolve('12345', 'channel');
      expect(result.found).toBe(false);
      expect(result.details?.error).toBe('Bot not running');
    });
  });

  describe('validateCredentials', () => {
    it('rejects missing token', async () => {
      const adapter = new DiscordAdapter();
      const result = await adapter.validateCredentials({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token is required');
    });
  });

  describe('start', () => {
    it('throws when no token provided', async () => {
      const adapter = new DiscordAdapter();
      await expect(adapter.start({})).rejects.toThrow('Discord bot token is required');
    });
  });
});
