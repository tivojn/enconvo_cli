import * as fs from 'fs';
import * as path from 'path';
import { ENCONVO_CLI_DIR, ENCONVO_CLI_CONFIG_PATH } from './paths';

export interface AgentConfig {
  id: string;
  name: string;
  path: string;
  description: string;
}

export interface InstanceConfig {
  enabled: boolean;
  token: string;
  agent: string;
  allowedUserIds: number[];
  service: {
    plistLabel: string;
    logPath: string;
    errorLogPath: string;
  };
}

export interface ChannelWithInstances {
  instances: Record<string, InstanceConfig>;
}

export interface EnConvoAppInfo {
  version: string;
  build: number;
  lastChecked: string;
}

export interface GlobalConfig {
  version: number;
  enconvo: {
    url: string;
    timeoutMs: number;
    agents: AgentConfig[];
    defaultAgent: string;
  };
  channels: Record<string, ChannelWithInstances>;
  enconvoApp?: EnConvoAppInfo;
}

const DEFAULT_CONFIG: GlobalConfig = {
  version: 2,
  enconvo: {
    url: 'http://localhost:54535',
    timeoutMs: 120000,
    agents: [
      { id: 'mavis', name: 'Mavis', path: 'chat_with_ai/chat', description: 'Default AI assistant' },
    ],
    defaultAgent: 'mavis',
  },
  channels: {},
};

/**
 * Auto-migrate flat channel config to instances format.
 * Old: channels.telegram: { token, enabled, allowedUserIds, service }
 * New: channels.telegram: { instances: { default: { token, enabled, ... } } }
 */
function migrateChannelsToInstances(raw: Record<string, unknown>): Record<string, ChannelWithInstances> {
  const channels = (raw.channels ?? {}) as Record<string, unknown>;
  const result: Record<string, ChannelWithInstances> = {};

  for (const [channelName, channelData] of Object.entries(channels)) {
    if (!channelData || typeof channelData !== 'object') continue;
    const data = channelData as Record<string, unknown>;

    // Already migrated — has instances key
    if (data.instances && typeof data.instances === 'object') {
      result[channelName] = data as unknown as ChannelWithInstances;
      continue;
    }

    // Flat format — migrate to instances.default
    const instance: InstanceConfig = {
      enabled: (data.enabled as boolean) ?? true,
      token: (data.token as string) ?? '',
      agent: (data.agent as string) ?? '',
      allowedUserIds: (data.allowedUserIds as number[]) ?? [],
      service: (data.service as InstanceConfig['service']) ?? {
        plistLabel: `com.enconvo.${channelName}-adapter`,
        logPath: `~/Library/Logs/enconvo-${channelName}-adapter.log`,
        errorLogPath: `~/Library/Logs/enconvo-${channelName}-adapter-error.log`,
      },
    };

    result[channelName] = { instances: { default: instance } };
  }

  return result;
}

export function ensureConfigDir(): void {
  if (!fs.existsSync(ENCONVO_CLI_DIR)) {
    fs.mkdirSync(ENCONVO_CLI_DIR, { recursive: true });
  }
}

export function loadGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG, channels: {} };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(ENCONVO_CLI_CONFIG_PATH, 'utf-8'));
    const config: GlobalConfig = {
      version: raw.version ?? 2,
      enconvo: {
        url: raw.enconvo?.url ?? DEFAULT_CONFIG.enconvo.url,
        timeoutMs: raw.enconvo?.timeoutMs ?? DEFAULT_CONFIG.enconvo.timeoutMs,
        agents: raw.enconvo?.agents ?? DEFAULT_CONFIG.enconvo.agents,
        defaultAgent: raw.enconvo?.defaultAgent ?? DEFAULT_CONFIG.enconvo.defaultAgent,
      },
      channels: migrateChannelsToInstances(raw),
      enconvoApp: raw.enconvoApp,
    };

    // Persist migration if version was old
    if ((raw.version ?? 1) < 2) {
      config.version = 2;
      saveGlobalConfig(config);
    }

    return config;
  } catch {
    return { ...DEFAULT_CONFIG, channels: {} };
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  ensureConfigDir();
  fs.writeFileSync(ENCONVO_CLI_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

// --- Instance-level CRUD ---

export function getChannelInstance(channelName: string, instanceName: string): InstanceConfig | undefined {
  const config = loadGlobalConfig();
  return config.channels[channelName]?.instances?.[instanceName];
}

export function setChannelInstance(channelName: string, instanceName: string, instance: InstanceConfig): void {
  const config = loadGlobalConfig();
  if (!config.channels[channelName]) {
    config.channels[channelName] = { instances: {} };
  }
  config.channels[channelName].instances[instanceName] = instance;
  saveGlobalConfig(config);
}

export function removeChannelInstance(channelName: string, instanceName: string, deleteIt: boolean): boolean {
  const config = loadGlobalConfig();
  const channel = config.channels[channelName];
  if (!channel?.instances?.[instanceName]) return false;

  if (deleteIt) {
    delete channel.instances[instanceName];
    // Remove channel entry if no instances left
    if (Object.keys(channel.instances).length === 0) {
      delete config.channels[channelName];
    }
  } else {
    channel.instances[instanceName].enabled = false;
  }
  saveGlobalConfig(config);
  return true;
}

export function listChannelInstances(channelName: string): Record<string, InstanceConfig> {
  const config = loadGlobalConfig();
  return config.channels[channelName]?.instances ?? {};
}

/**
 * Migrate from legacy project-local config.json + .env into ~/.enconvo_cli/config.json.
 * Only runs if no global config exists yet.
 */
export function migrateFromLegacy(projectRoot: string): boolean {
  if (fs.existsSync(ENCONVO_CLI_CONFIG_PATH)) return false;

  const legacyConfigPath = path.join(projectRoot, 'config.json');
  const legacyEnvPath = path.join(projectRoot, '.env');

  if (!fs.existsSync(legacyConfigPath)) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf-8'));
    let botToken: string | undefined;

    if (fs.existsSync(legacyEnvPath)) {
      const envContent = fs.readFileSync(legacyEnvPath, 'utf-8');
      const match = envContent.match(/^BOT_TOKEN=(.+)$/m);
      if (match) botToken = match[1].trim();
    }

    const config: GlobalConfig = {
      version: 1,
      enconvo: {
        url: raw.enconvo?.url ?? DEFAULT_CONFIG.enconvo.url,
        timeoutMs: raw.enconvo?.timeoutMs ?? DEFAULT_CONFIG.enconvo.timeoutMs,
        agents: raw.enconvo?.agents ?? DEFAULT_CONFIG.enconvo.agents,
        defaultAgent: raw.enconvo?.defaultAgent ?? DEFAULT_CONFIG.enconvo.defaultAgent,
      },
      channels: {},
    };

    if (botToken) {
      config.channels.telegram = {
        instances: {
          default: {
            enabled: true,
            token: botToken,
            agent: raw.enconvo?.defaultAgent ?? 'chat_with_ai/chat',
            allowedUserIds: raw.telegram?.allowedUserIds ?? [],
            service: {
              plistLabel: 'com.enconvo.telegram-default',
              logPath: '~/Library/Logs/enconvo-telegram-default.log',
              errorLogPath: '~/Library/Logs/enconvo-telegram-default-error.log',
            },
          },
        },
      };
    }

    saveGlobalConfig(config);
    return true;
  } catch {
    return false;
  }
}
