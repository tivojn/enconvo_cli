import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('config store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-store-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('config file format', () => {
    it('has expected v2 schema fields', () => {
      const config = {
        version: 2,
        enconvo: {
          url: 'http://localhost:54535',
          timeoutMs: 120000,
          agents: [],
          defaultAgent: 'mavis',
        },
        channels: {},
      };
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config));

      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(loaded.version).toBe(2);
      expect(loaded.enconvo.url).toBe('http://localhost:54535');
      expect(loaded.enconvo.timeoutMs).toBe(120000);
    });

    it('preserves channel instances on roundtrip', () => {
      const config = {
        version: 2,
        enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
        channels: {
          telegram: {
            instances: {
              mavis: {
                enabled: true,
                token: 'test-token',
                agent: 'chat_with_ai/chat',
                allowedUserIds: [12345],
                service: {},
              },
            },
          },
        },
      };
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config));

      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(loaded.channels.telegram.instances.mavis.enabled).toBe(true);
      expect(loaded.channels.telegram.instances.mavis.agent).toBe('chat_with_ai/chat');
      expect(loaded.channels.telegram.instances.mavis.allowedUserIds).toEqual([12345]);
    });

    it('supports discord instances', () => {
      const config = {
        version: 2,
        enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
        channels: {
          discord: {
            instances: {
              'test-bot': {
                enabled: true,
                token: 'discord-token',
                agent: 'chat_with_ai/chat',
                allowedUserIds: ['1234567890'],
                service: {},
              },
            },
          },
        },
      };
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config));

      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(loaded.channels.discord.instances['test-bot'].allowedUserIds[0]).toBe('1234567890');
    });

    it('supports groups under channels', () => {
      const config = {
        version: 2,
        enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
        channels: {
          telegram: {
            instances: {},
            groups: {
              main: { chatId: '-1234567', name: 'Main Group' },
            },
          },
        },
      };
      const configPath = path.join(tmpDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config));

      const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(loaded.channels.telegram.groups.main.chatId).toBe('-1234567');
      expect(loaded.channels.telegram.groups.main.name).toBe('Main Group');
    });
  });
});
