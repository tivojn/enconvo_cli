import * as fs from 'fs';
import * as path from 'path';
import { AGENTS_CONFIG_PATH, ENCONVO_CLI_DIR } from './paths';

export interface ChannelBinding {
  channel: string;
  instanceName: string;
  botHandle?: string;
}

export interface AgentBindings {
  /** EnConvo agent path, e.g. "chat_with_ai/chat" or "custom_bot/BVxrKvityKoIpdJjS4p7" */
  agentPath: string;
  /** Telegram bot username, e.g. "@Encovo_Mavis_001_bot" */
  telegramBot: string;
  /** Instance name in config.json, e.g. "mavis" */
  instanceName: string;
  /** Multi-channel bindings (optional, extends legacy single-binding) */
  channelBindings?: ChannelBinding[];
}

export interface AgentMember {
  id: string;
  name: string;
  chineseName?: string;
  emoji: string;
  role: string;
  specialty: string;
  isLead: boolean;
  bindings: AgentBindings;
  /** Derived: preferenceKey for EnConvo, e.g. "custom_bot|BVxrKvityKoIpdJjS4p7" */
  preferenceKey: string;
  /** Derived: workspace directory path */
  workspacePath: string;
}

export interface AgentsRoster {
  version: number;
  team: string;
  members: AgentMember[];
}

const DEFAULT_ROSTER: AgentsRoster = {
  version: 1,
  team: 'EnConvo AI Team',
  members: [],
};

function derivePreferenceKey(agentPath: string): string {
  // agentPath: "chat_with_ai/chat" → "chat_with_ai|chat"
  // agentPath: "custom_bot/BVxrKvityKoIpdJjS4p7" → "custom_bot|BVxrKvityKoIpdJjS4p7"
  return agentPath.replace('/', '|');
}

function deriveWorkspacePath(id: string, isLead: boolean): string {
  // Always use workspace-{id}/ to avoid path collisions between leads
  const newPath = path.join(ENCONVO_CLI_DIR, `workspace-${id}`);

  // Auto-migrate: old leads used plain "workspace/" — rename if new path doesn't exist yet
  if (isLead && !fs.existsSync(newPath)) {
    const oldPath = path.join(ENCONVO_CLI_DIR, 'workspace');
    if (fs.existsSync(oldPath)) {
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`[agent-store] Migrated workspace/ → workspace-${id}/`);
      } catch {
        // Fall back to old path if rename fails (e.g. permissions)
        return oldPath;
      }
    }
  }

  return newPath;
}

export function loadAgentsRoster(): AgentsRoster {
  if (!fs.existsSync(AGENTS_CONFIG_PATH)) {
    return { ...DEFAULT_ROSTER, members: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(AGENTS_CONFIG_PATH, 'utf-8'));
    const roster: AgentsRoster = {
      version: raw.version ?? 1,
      team: raw.team ?? DEFAULT_ROSTER.team,
      members: (raw.members ?? []).map((m: AgentMember) => ({
        ...m,
        preferenceKey: derivePreferenceKey(m.bindings.agentPath),
        workspacePath: deriveWorkspacePath(m.id, m.isLead),
      })),
    };
    return roster;
  } catch {
    return { ...DEFAULT_ROSTER, members: [] };
  }
}

export function saveAgentsRoster(roster: AgentsRoster): void {
  if (!fs.existsSync(ENCONVO_CLI_DIR)) {
    fs.mkdirSync(ENCONVO_CLI_DIR, { recursive: true });
  }
  // Strip derived fields before saving
  const toSave = {
    version: roster.version,
    team: roster.team,
    members: roster.members.map(({ preferenceKey: _pk, workspacePath: _wp, ...rest }) => rest),
  };
  fs.writeFileSync(AGENTS_CONFIG_PATH, JSON.stringify(toSave, null, 2) + '\n');
}

export function getAgent(id: string): AgentMember | undefined {
  const roster = loadAgentsRoster();
  return roster.members.find((m) => m.id === id);
}

export function addAgent(member: Omit<AgentMember, 'preferenceKey' | 'workspacePath'>): AgentMember {
  const roster = loadAgentsRoster();
  if (roster.members.find((m) => m.id === member.id)) {
    throw new Error(`Agent "${member.id}" already exists`);
  }
  const full: AgentMember = {
    ...member,
    preferenceKey: derivePreferenceKey(member.bindings.agentPath),
    workspacePath: deriveWorkspacePath(member.id, member.isLead),
  };
  roster.members.push(full);
  saveAgentsRoster(roster);
  return full;
}

export function removeAgent(id: string): boolean {
  const roster = loadAgentsRoster();
  const idx = roster.members.findIndex((m) => m.id === id);
  if (idx === -1) return false;
  roster.members.splice(idx, 1);
  saveAgentsRoster(roster);
  return true;
}

export function bindAgent(id: string, binding: ChannelBinding): AgentMember | undefined {
  const roster = loadAgentsRoster();
  const member = roster.members.find((m) => m.id === id);
  if (!member) return undefined;

  if (!member.bindings.channelBindings) {
    member.bindings.channelBindings = [];
  }

  // Remove existing binding for same channel+instance
  member.bindings.channelBindings = member.bindings.channelBindings.filter(
    (b) => !(b.channel === binding.channel && b.instanceName === binding.instanceName),
  );
  member.bindings.channelBindings.push(binding);

  // Keep legacy fields in sync for Telegram
  if (binding.channel === 'telegram') {
    member.bindings.instanceName = binding.instanceName;
    if (binding.botHandle) member.bindings.telegramBot = binding.botHandle;
  }

  saveAgentsRoster(roster);
  return member;
}

export function unbindAgent(id: string, channel: string, instanceName: string): boolean {
  const roster = loadAgentsRoster();
  const member = roster.members.find((m) => m.id === id);
  if (!member || !member.bindings.channelBindings) return false;

  const before = member.bindings.channelBindings.length;
  member.bindings.channelBindings = member.bindings.channelBindings.filter(
    (b) => !(b.channel === channel && b.instanceName === instanceName),
  );
  if (member.bindings.channelBindings.length === before) return false;

  saveAgentsRoster(roster);
  return true;
}

export function updateAgent(id: string, updates: Partial<Pick<AgentMember, 'name' | 'chineseName' | 'emoji' | 'role' | 'specialty'>>): AgentMember | undefined {
  const roster = loadAgentsRoster();
  const member = roster.members.find((m) => m.id === id);
  if (!member) return undefined;
  if (updates.name !== undefined) member.name = updates.name;
  if (updates.chineseName !== undefined) member.chineseName = updates.chineseName;
  if (updates.emoji !== undefined) member.emoji = updates.emoji;
  if (updates.role !== undefined) member.role = updates.role;
  if (updates.specialty !== undefined) member.specialty = updates.specialty;
  saveAgentsRoster(roster);
  return member;
}
