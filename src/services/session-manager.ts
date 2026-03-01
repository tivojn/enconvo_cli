import * as crypto from 'crypto';
import { loadGlobalConfig, AgentConfig } from '../config/store';

// Key is "chatId:instanceId" to isolate sessions per bot per chat
const sessionOverrides = new Map<string, string>();
const agentOverrides = new Map<number, string>();

function sessionKey(chatId: number, instanceId?: string): string {
  return instanceId ? `${chatId}:${instanceId}` : `${chatId}`;
}

export function getSessionId(chatId: number, instanceId?: string): string {
  const key = sessionKey(chatId, instanceId);
  const suffix = instanceId ? `-${instanceId}` : '';
  return sessionOverrides.get(key) ?? `telegram-${chatId}${suffix}`;
}

export function resetSession(chatId: number, instanceId?: string): string {
  const key = sessionKey(chatId, instanceId);
  const suffix = instanceId ? `-${instanceId}` : '';
  const newId = `telegram-${chatId}${suffix}-${crypto.randomUUID().slice(0, 8)}`;
  sessionOverrides.set(key, newId);
  return newId;
}

export function getAgent(chatId: number): AgentConfig {
  const config = loadGlobalConfig();
  const agentId = agentOverrides.get(chatId) ?? config.enconvo.defaultAgent;
  return config.enconvo.agents.find(a => a.id === agentId) ?? config.enconvo.agents[0];
}

export function setAgent(chatId: number, agentId: string): AgentConfig | null {
  const config = loadGlobalConfig();
  const agent = config.enconvo.agents.find(a => a.id === agentId);
  if (!agent) return null;
  agentOverrides.set(chatId, agentId);
  return agent;
}
