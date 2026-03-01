import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let tmpDir: string;
let legacyDir: string;

vi.mock('../paths', () => {
  return {
    get ENCONVO_CLI_DIR() { return tmpDir; },
    get ENCONVO_CLI_CONFIG_PATH() { return path.join(tmpDir, 'config.json'); },
    get AGENTS_CONFIG_PATH() { return path.join(tmpDir, 'agents.json'); },
    get BACKUPS_DIR() { return path.join(tmpDir, 'backups'); },
    get WORKSPACES_DIR() { return tmpDir; },
    get TEAM_KB_DIR() { return path.join(tmpDir, 'kb'); },
    get ENCONVO_PREFERENCES_DIR() { return path.join(tmpDir, 'preferences'); },
    get ENCONVO_COMMANDS_DIR() { return path.join(tmpDir, 'commands'); },
    ENCONVO_APP_PLIST: '/Applications/EnConvo.app/Contents/Info.plist',
  };
});

describe('legacy migration', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-'));
    legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(legacyDir, { recursive: true, force: true });
    vi.resetModules();
  });

  async function importStore() {
    return import('../store');
  }

  it('migrateFromLegacy creates config from project-local files', async () => {
    const store = await importStore();

    // Create legacy config.json + .env
    const legacyConfig = {
      enconvo: {
        url: 'http://localhost:54535',
        timeoutMs: 90000,
        agents: [{ id: 'test', name: 'Test', path: 'test/path', description: 'Test agent' }],
        defaultAgent: 'test',
      },
      telegram: { allowedUserIds: [111, 222] },
    };
    fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify(legacyConfig));
    fs.writeFileSync(path.join(legacyDir, '.env'), 'BOT_TOKEN=legacy-token-123\n');

    const migrated = store.migrateFromLegacy(legacyDir);
    expect(migrated).toBe(true);

    const config = store.loadGlobalConfig();
    expect(config.enconvo.timeoutMs).toBe(90000);
    expect(config.channels.telegram).toBeDefined();
    expect(config.channels.telegram.instances.default.token).toBe('legacy-token-123');
    expect(config.channels.telegram.instances.default.allowedUserIds).toEqual([111, 222]);
  });

  it('migrateFromLegacy skips when global config already exists', async () => {
    const store = await importStore();

    // Create existing global config
    store.saveGlobalConfig(store.loadGlobalConfig());

    // Create legacy files
    fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify({ enconvo: {} }));
    fs.writeFileSync(path.join(legacyDir, '.env'), 'BOT_TOKEN=should-not-use\n');

    const migrated = store.migrateFromLegacy(legacyDir);
    expect(migrated).toBe(false);
  });

  it('migrateFromLegacy skips when no legacy config exists', async () => {
    const store = await importStore();
    const migrated = store.migrateFromLegacy(legacyDir);
    expect(migrated).toBe(false);
  });

  it('migrateFromLegacy handles missing .env (no token)', async () => {
    const store = await importStore();

    fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify({
      enconvo: { url: 'http://localhost:54535' },
    }));

    const migrated = store.migrateFromLegacy(legacyDir);
    expect(migrated).toBe(true);

    const config = store.loadGlobalConfig();
    // No telegram channel should be created (no token)
    expect(config.channels.telegram).toBeUndefined();
  });

  it('v1 flat channels auto-migrate to instances format on load', async () => {
    // Write a v1-style config with flat channel directly
    const v1 = {
      version: 1,
      enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
      channels: {
        telegram: {
          token: 'flat-token',
          enabled: true,
          allowedUserIds: [999],
          agent: 'chat_with_ai/chat',
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(v1));

    const store = await importStore();
    const config = store.loadGlobalConfig();

    // Should auto-migrate to instances.default
    expect(config.version).toBe(2);
    expect(config.channels.telegram.instances).toBeDefined();
    expect(config.channels.telegram.instances.default.token).toBe('flat-token');
    expect(config.channels.telegram.instances.default.enabled).toBe(true);
    expect(config.channels.telegram.instances.default.allowedUserIds).toEqual([999]);
  });

  it('already-migrated config is not re-migrated', async () => {
    const v2 = {
      version: 2,
      enconvo: { url: 'http://localhost:54535', timeoutMs: 120000, agents: [], defaultAgent: '' },
      channels: {
        telegram: {
          instances: {
            mavis: { token: 'tok-mavis', enabled: true, agent: 'a', allowedUserIds: [], service: {} },
          },
        },
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(v2));

    const store = await importStore();
    const config = store.loadGlobalConfig();

    // Should preserve as-is
    expect(config.channels.telegram.instances.mavis.token).toBe('tok-mavis');
    expect(config.channels.telegram.instances.default).toBeUndefined();
  });
});
