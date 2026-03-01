import { ChannelAdapter } from '../types/channel';
import { TelegramAdapter } from './telegram/adapter';

const adapters = new Map<string, ChannelAdapter>();

// Register built-in adapters (type-level singletons for capabilities, info, etc.)
adapters.set('telegram', new TelegramAdapter());

export function getAdapter(name: string): ChannelAdapter | undefined {
  return adapters.get(name);
}

export function listAdapterNames(): string[] {
  return [...adapters.keys()];
}

export function listAdapters(): ChannelAdapter[] {
  return [...adapters.values()];
}

/**
 * Create a fresh adapter instance for a specific named instance.
 * Used by CLI commands that need to start/manage individual bot instances.
 */
export function createAdapterInstance(channelType: string, instanceName: string): ChannelAdapter | undefined {
  switch (channelType) {
    case 'telegram': {
      const adapter = new TelegramAdapter();
      adapter.instanceName = instanceName;
      return adapter;
    }
    default:
      return undefined;
  }
}
