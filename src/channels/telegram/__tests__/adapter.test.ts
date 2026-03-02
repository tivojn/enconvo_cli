import { describe, it, expect } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import { TelegramAdapter } from '../adapter';

describe('TelegramAdapter', () => {
  describe('info', () => {
    it('has correct channel name', () => {
      const adapter = new TelegramAdapter();
      expect(adapter.info.name).toBe('telegram');
    });

    it('has display name and version', () => {
      const adapter = new TelegramAdapter();
      expect(adapter.info.displayName).toBe('Telegram');
      expect(adapter.info.version).toBe('1.0.0');
    });
  });

  describe('capabilities', () => {
    it('supports text, images, documents, group chats', () => {
      const adapter = new TelegramAdapter();
      expect(adapter.capabilities.text).toBe(true);
      expect(adapter.capabilities.images).toBe(true);
      expect(adapter.capabilities.documents).toBe(true);
      expect(adapter.capabilities.groupChats).toBe(true);
      expect(adapter.capabilities.multiAccount).toBe(true);
    });

    it('does not support audio or video', () => {
      const adapter = new TelegramAdapter();
      expect(adapter.capabilities.audio).toBe(false);
      expect(adapter.capabilities.video).toBe(false);
    });
  });

  describe('getLogPaths', () => {
    it('returns default log paths when no instanceName', () => {
      const adapter = new TelegramAdapter();
      const paths = adapter.getLogPaths();
      expect(paths.stdout).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-adapter.log'));
      expect(paths.stderr).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-adapter-error.log'));
    });

    it('uses instanceName in log paths', () => {
      const adapter = new TelegramAdapter();
      adapter.instanceName = 'mavis';
      const paths = adapter.getLogPaths();
      expect(paths.stdout).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-mavis.log'));
      expect(paths.stderr).toBe(path.join(os.homedir(), 'Library/Logs/enconvo-telegram-mavis-error.log'));
    });
  });

  describe('getServiceLabel', () => {
    it('returns default label when no instanceName', () => {
      const adapter = new TelegramAdapter();
      expect(adapter.getServiceLabel()).toBe('com.enconvo.telegram-adapter');
    });

    it('includes instanceName in label', () => {
      const adapter = new TelegramAdapter();
      adapter.instanceName = 'elena';
      expect(adapter.getServiceLabel()).toBe('com.enconvo.telegram-elena');
    });
  });

  describe('getStatus', () => {
    it('returns not running when no bot started', async () => {
      const adapter = new TelegramAdapter();
      const status = await adapter.getStatus();
      expect(status.running).toBe(false);
      expect(status.details).toEqual({});
    });

    it('includes instance name in details', async () => {
      const adapter = new TelegramAdapter();
      adapter.instanceName = 'mavis';
      const status = await adapter.getStatus();
      expect(status.details.instance).toBe('mavis');
    });
  });

  describe('resolve', () => {
    it('returns not found when bot not running', async () => {
      const adapter = new TelegramAdapter();
      const result = await adapter.resolve('12345', 'chat');
      expect(result.found).toBe(false);
      expect(result.details?.error).toBe('Bot not running');
    });
  });

  describe('validateCredentials', () => {
    it('rejects missing token', async () => {
      const adapter = new TelegramAdapter();
      const result = await adapter.validateCredentials({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token is required');
    });
  });

  describe('start', () => {
    it('throws when no token provided', async () => {
      const adapter = new TelegramAdapter();
      await expect(adapter.start({})).rejects.toThrow('Telegram bot token is required');
    });
  });
});
