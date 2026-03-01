---
name: enconvo-cli
description: "Expert-level skill for installing, configuring, and operating enconvo_cli — the CLI tool that deploys EnConvo AI agents as dedicated bots on Telegram and Discord. Covers channel management, agent team composition, multi-instance deployment, and troubleshooting."
version: 1.0.0
author: zanearcher
category: infrastructure
---

# enconvo-cli Skill

> Trigger: user mentions enconvo_cli, EnConvo channels, deploying bots, Telegram/Discord bot management, agent teams, or channel configuration.

## Reference Files

- `cli-reference.md` — Full command reference for all CLI subcommands
- `config-reference.md` — Config file schemas, paths, and examples

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Architecture](#architecture)
5. [Channel Management](#channel-management)
6. [Agent Team Management](#agent-team-management)
7. [Configuration](#configuration)
8. [Telegram Setup](#telegram-setup)
9. [Discord Setup](#discord-setup)
10. [Group Chat Behavior](#group-chat-behavior)
11. [Named Groups](#named-groups)
12. [Sending Messages](#sending-messages)
13. [Service Management](#service-management)
14. [Prompt Sync & Workspaces](#prompt-sync--workspaces)
15. [Troubleshooting](#troubleshooting)
16. [Common Workflows](#common-workflows)

---

## Overview

`enconvo_cli` maps [EnConvo AI](https://enconvo.com) agents to messaging channels. Each bot is a **dedicated instance** pinned to one EnConvo agent — no agent switching. The CLI handles registration, lifecycle, messaging, and team composition.

**Stack:** TypeScript, Commander.js, Grammy (Telegram), discord.js (Discord), tsx

**Repo:** https://github.com/tivojn/enconvo_cli

```
EnConvo (agent factory, GUI on macOS)
  └── enconvo_cli (maps agents to channels, composes teams)
        ├── Telegram bots (one bot per agent, Grammy)
        ├── Discord bots (one bot per agent, discord.js)
        └── Agent groups (team compositions)
```

**Flow:** Customize agent in EnConvo GUI → Register via CLI → Deploy to channel → Compose into groups

---

## Prerequisites

| Requirement | Details |
|---|---|
| macOS | Required (EnConvo is macOS-native) |
| Node.js | v18+ (via Homebrew or nvm) |
| EnConvo | Running locally, listens on `http://localhost:54535` |
| Telegram token | From [@BotFather](https://t.me/BotFather) — format: `1234567890:AAF...` |
| Discord token | From [Developer Portal](https://discord.com/developers/applications) — format: `MTIz...` |

Check EnConvo is running:
```bash
curl http://localhost:54535/health
```

---

## Installation

```bash
# Clone and install
git clone https://github.com/tivojn/enconvo_cli.git
cd enconvo_cli
npm install

# Verify CLI works
npx tsx src/cli.ts channels list

# Optional: create global alias
echo 'alias enconvo="npx tsx /path/to/enconvo_cli/src/cli.ts"' >> ~/.zshrc
source ~/.zshrc
```

The CLI entry point is `src/cli.ts`. Run commands via:
```bash
npx tsx src/cli.ts <command> <subcommand> [options]
# or with alias:
enconvo <command> <subcommand> [options]
```

---

## Architecture

### Key Directories

| Path | Purpose |
|---|---|
| `src/cli.ts` | Commander.js entry point |
| `src/types/channel.ts` | `ChannelAdapter` interface |
| `src/channels/registry.ts` | Adapter registry + factory |
| `src/channels/telegram/` | Telegram adapter (Grammy) |
| `src/channels/discord/` | Discord adapter (discord.js) |
| `src/commands/channels/` | CLI: channel subcommands (12 files) |
| `src/commands/agents/` | CLI: agent subcommands (9 files) |
| `src/services/` | EnConvo client, response parser, session manager |
| `src/config/store.ts` | Global config CRUD |
| `src/config/agent-store.ts` | Agent roster CRUD |

### Config Files

| Path | Purpose |
|---|---|
| `~/.enconvo_cli/config.json` | Global config (channels, instances, groups, EnConvo settings) |
| `~/.enconvo_cli/agents.json` | Agent team roster |
| `~/.enconvo_cli/workspace/` | Default workspace (IDENTITY.md, SOUL.md, AGENTS.md) |
| `~/.enconvo_cli/workspace-{id}/` | Agent-specific workspaces |
| `~/.enconvo_cli/backups/` | Preference backups from sync |

### ChannelAdapter Interface

Every channel (Telegram, Discord) implements:
```typescript
interface ChannelAdapter {
  instanceName?: string;
  info: { name: string; description: string };
  capabilities: string[];
  start(token: string, agentPath?: string, opts?: StartOptions): Promise<void>;
  stop(): Promise<void>;
  validateCredentials(token: string): Promise<boolean>;
  getStatus(): Promise<{ running: boolean; details?: string }>;
  resolve(identifier: string): Promise<{ type: string; name: string; id: string } | null>;
}
```

### EnConvo API

```
POST http://localhost:54535/command/call/{category}/{command}
Body: { "input_text": "...", "sessionId": "..." }
Response: { "type": "messages", "messages": [...] } or { "result": "..." }
```

Agent paths map to API routes: `chat_with_ai/chat` → `/command/call/chat_with_ai/chat`

---

## Channel Management

### Quick Reference

| Command | Description |
|---|---|
| `channels list [--json]` | List all channels and instances |
| `channels add` | Register a new bot instance |
| `channels login` | Start a bot instance |
| `channels logout` | Stop a bot instance |
| `channels status` | Check instance status |
| `channels logs` | View instance logs |
| `channels send` | Send message through bot |
| `channels remove` | Remove/disable an instance |
| `channels resolve` | Look up user/channel by ID |
| `channels capabilities` | Show channel features |
| `channels groups` | Manage named groups |

### Adding a Bot Instance

```bash
# Telegram
enconvo channels add --channel telegram --name mavis \
  --token "1234567890:AAF..." \
  --agent chat_with_ai/chat \
  --validate

# Discord
enconvo channels add --channel discord --name mavis-discord \
  --token "MTIz..." \
  --agent chat_with_ai/chat \
  --validate
```

Options:
- `--channel <telegram|discord>` — Channel type (required)
- `--name <name>` — Unique instance name (required)
- `--token <token>` — Bot token (required)
- `--agent <path>` — EnConvo agent path like `chat_with_ai/chat` (required)
- `--validate` — Test token before saving

### Starting/Stopping

```bash
# Start (foreground, keeps terminal attached)
enconvo channels login --channel telegram --name mavis -f

# Start in background
enconvo channels login --channel telegram --name mavis -f &

# Stop
enconvo channels logout --channel telegram --name mavis
```

### Checking Status

```bash
# All instances of a channel
enconvo channels status --channel telegram

# Specific instance
enconvo channels status --channel discord --name mavis-discord
```

### Removing

```bash
# Disable (keeps config)
enconvo channels remove --channel telegram --name mavis

# Delete entirely
enconvo channels remove --channel telegram --name mavis --delete
```

---

## Agent Team Management

### Quick Reference

| Command | Description |
|---|---|
| `agents list [--bindings] [--json]` | Show agent roster |
| `agents add` | Register a team member |
| `agents delete <id> [--force]` | Remove an agent |
| `agents set-identity <id>` | Update agent identity |
| `agents bindings` | Show agent-to-channel mappings |
| `agents sync [--agent <id>] [--dry-run]` | Sync prompts to EnConvo |
| `agents refresh` | Re-read workspace files |
| `agents check [--agent <id>] [--json]` | Health check agents |

### Adding an Agent

```bash
enconvo agents add \
  --id mavis \
  --name Mavis \
  --role "Team Lead" \
  --specialty "Coordination" \
  --agent-path chat_with_ai/chat \
  --telegram-bot @Mavis_bot \
  --instance-name mavis \
  --emoji crown \
  --lead
```

### Team Roster Example

```bash
$ enconvo agents list --bindings

Agent Team Roster:
  crown Mavis (mavis) — Team Lead
    Specialty: Coordination
    Agent: chat_with_ai/chat
    Telegram: @Mavis_bot → instance "mavis"

  money Vivienne (vivienne) — Finance Director
    Specialty: Finance
    Agent: custom_bot/BVxrKvityKoIpdJjS4p7
    Telegram: @Enconvo_Vivienne_Finance_bot → instance "vivienne"
```

### Syncing Prompts

Reads workspace files (IDENTITY.md, SOUL.md, AGENTS.md) and writes system prompts to EnConvo preferences:

```bash
# Dry run — see what would change
enconvo agents sync --dry-run

# Sync all agents
enconvo agents sync

# Sync specific agent
enconvo agents sync --agent mavis
```

Backups are saved to `~/.enconvo_cli/backups/` before writing.

---

## Configuration

### Config File: `~/.enconvo_cli/config.json`

```json
{
  "version": 2,
  "enconvo": {
    "url": "http://localhost:54535",
    "timeoutMs": 120000,
    "agents": [
      { "id": "mavis", "name": "Mavis", "path": "chat_with_ai/chat", "description": "Default AI assistant" }
    ],
    "defaultAgent": "mavis"
  },
  "channels": {
    "telegram": {
      "instances": {
        "mavis": {
          "enabled": true,
          "token": "1234567890:AAF...",
          "agent": "chat_with_ai/chat",
          "allowedUserIds": [],
          "service": {
            "plistLabel": "com.enconvo.telegram-mavis",
            "logPath": "~/Library/Logs/enconvo-telegram-mavis.log",
            "errorLogPath": "~/Library/Logs/enconvo-telegram-mavis-error.log"
          }
        }
      },
      "groups": {
        "main": { "chatId": "-5063546642", "name": "Agents Group" }
      }
    },
    "discord": {
      "instances": {
        "mavis-discord": {
          "enabled": true,
          "token": "MTIz...",
          "agent": "chat_with_ai/chat",
          "allowedUserIds": ["123456789012345678"],
          "service": {
            "plistLabel": "com.enconvo.discord-mavis-discord",
            "logPath": "~/Library/Logs/enconvo-discord-mavis-discord.log",
            "errorLogPath": "~/Library/Logs/enconvo-discord-mavis-discord-error.log"
          }
        }
      }
    }
  }
}
```

### Key Config Notes

- **Version 2** — auto-migrated from v1 flat format on first load
- **allowedUserIds** — `number[]` for Telegram, `string[]` for Discord (snowflakes), empty = allow all
- **agent path** — maps to EnConvo API: `chat_with_ai/chat` → `POST /command/call/chat_with_ai/chat`
- **service.plistLabel** — macOS launchd service identifier

### Agent Roster: `~/.enconvo_cli/agents.json`

```json
{
  "agents": [
    {
      "id": "mavis",
      "name": "Mavis",
      "role": "Team Lead",
      "specialty": "Coordination",
      "agentPath": "chat_with_ai/chat",
      "telegramBot": "@Mavis_bot",
      "instanceName": "mavis",
      "emoji": "crown",
      "isLead": true
    }
  ]
}
```

---

## Telegram Setup

### 1. Create Bot via BotFather

1. Open Telegram → search [@BotFather](https://t.me/BotFather)
2. Send `/newbot` → choose display name → choose username (must end in `bot`)
3. Save the API token (format: `1234567890:AAF...`)

### 2. Configure Bot Settings

**Disable Group Privacy** (required for group @mention support):
1. BotFather → `/setprivacy` → select bot → **Disable**
2. **Remove and re-add** the bot to any existing groups (Telegram caches privacy per membership)

**Optional — set commands menu:**
```
/setcommands → Select bot →
reset - Start a fresh conversation
status - Check connection status
help - Show help message
```

### 3. Register and Start

```bash
enconvo channels add --channel telegram --name mavis \
  --token "1234567890:AAF..." \
  --agent chat_with_ai/chat \
  --validate

enconvo channels login --channel telegram --name mavis -f
```

### Telegram-Specific Details

- **Message limit:** 4096 characters (auto-split)
- **User IDs:** Numeric (e.g., `123456789`)
- **Commands:** `/reset`, `/status`, `/help` — use `/reset@BotUsername` in groups
- **Media:** Photos sent as `sendPhoto`, other files as `sendDocument`
- **Bot library:** Grammy v1.x

---

## Discord Setup

### 1. Create Application + Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. Name it (e.g., "Mavis - EnConvo") → Create
3. Go to **Bot** tab → click **Reset Token** → copy and save

### 2. Enable Privileged Intents

In the **Bot** tab, enable:
- **Message Content Intent** (required — the bot reads message text)

### 3. Invite to Server

1. Go to **OAuth2** → **URL Generator**
2. Select scopes: `bot`
3. Select permissions: `Send Messages`, `Read Message History`, `Attach Files`
4. Copy the generated URL → open in browser → select your server

### 4. Register and Start

```bash
enconvo channels add --channel discord --name mavis-discord \
  --token "MTIz..." \
  --agent chat_with_ai/chat \
  --validate

enconvo channels login --channel discord --name mavis-discord -f
```

### Discord-Specific Details

- **Message limit:** 2000 characters (auto-split)
- **User IDs:** String snowflakes (e.g., `"123456789012345678"`)
- **Commands:** `!reset`, `!status`, `!help` (prefix-based, not slash commands)
- **Media:** All files sent as `AttachmentBuilder` attachments
- **Bot library:** discord.js v14
- **Intents required:** Guilds, GuildMessages, MessageContent, DirectMessages

---

## Group Chat Behavior

### Telegram Groups

| Action | Result |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to bot's message | Only that bot responds |
| `/reset@BotName` | Resets only that bot's session |
| Bare `/reset` | Only one bot receives it (Telegram picks) |
| Regular text (no @mention) | No bot responds |

### Discord Servers

| Action | Result |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to bot's message | Only that bot responds |
| `!reset` | Resets session for that channel |
| `!status` / `!help` | Bot responds with info |
| Regular text (no @mention) | No bot responds |

**DMs:** Both Telegram and Discord bots respond to all DMs without mention-gating.

---

## Named Groups

Map human-readable names to chat/channel IDs for easier `send` commands.

```bash
# List groups
enconvo channels groups [--channel telegram]

# Add a group
enconvo channels groups add --name main --chat-id "-5063546642" --label "Agents Group"

# Use in send
enconvo channels send --channel telegram --name mavis --group main --message "hello"

# Remove
enconvo channels groups remove --name main
```

---

## Sending Messages

Send a message through a bot instance — calls EnConvo, then delivers the response to the chat.

```bash
# By chat ID
enconvo channels send --channel telegram --name mavis \
  --chat "-5063546642" --message "hello"

# By named group
enconvo channels send --channel telegram --name mavis \
  --group main --message "hello"

# Discord
enconvo channels send --channel discord --name mavis-discord \
  --chat "1234567890123456789" --message "hello"

# With fresh session
enconvo channels send --channel telegram --name mavis \
  --group main --message "hello" --reset

# JSON output
enconvo channels send --channel telegram --name mavis \
  --group main --message "hello" --json
```

The `send` command:
1. Looks up instance config (token + agent)
2. Calls EnConvo API with the message
3. Parses response (text + file paths)
4. Delivers via the appropriate channel API (Telegram or Discord)

---

## Service Management

Bots can run as macOS launchd services for persistent operation.

```bash
# Start as foreground process
enconvo channels login --channel telegram --name mavis -f

# Check if running
enconvo channels status --channel telegram --name mavis

# View logs
enconvo channels logs --channel telegram --name mavis

# Stop
enconvo channels logout --channel telegram --name mavis
```

Service labels follow the pattern: `com.enconvo.{channel}-{instanceName}`

---

## Prompt Sync & Workspaces

### Workspace Structure

Each agent can have workspace files that define its identity and behavior:

```
~/.enconvo_cli/workspace/          # Default workspace
  IDENTITY.md                       # Agent identity, role, personality
  SOUL.md                          # Core values, communication style
  AGENTS.md                        # Team roster, inter-agent protocols

~/.enconvo_cli/workspace-mavis/    # Agent-specific workspace
  IDENTITY.md
  SOUL.md
  AGENTS.md
```

### Sync Process

```bash
# Preview what would change
enconvo agents sync --dry-run

# Sync all agents (backs up first)
enconvo agents sync

# Sync one agent
enconvo agents sync --agent mavis
```

Sync reads workspace files → generates a system prompt → writes to EnConvo preferences at `~/.config/enconvo/installed_preferences/`. A backup is saved to `~/.enconvo_cli/backups/` before each write.

### Refresh

Re-read workspace files and update agent configurations:

```bash
enconvo agents refresh --group main [--agent mavis] [--reset] [--silent]
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Telegram bot ignores @mentions in groups | Privacy mode ON (BotFather default) | `/setprivacy` → Disable, remove/re-add bot to group |
| Only one Telegram bot responds to `/reset` | Telegram delivers bare commands to one bot | Use `/reset@BotUsername` |
| Discord bot ignores messages in server | Message Content Intent disabled | Enable in Developer Portal → Bot → Privileged Intents |
| 409 Conflict (Telegram) | Another process polling same token | `ps aux \| grep telegram` → kill old PID |
| Empty responses | EnConvo not running | `curl http://localhost:54535/health` |
| Bot works in DM but not group/server | Privacy mode (Telegram) or missing permissions (Discord) | Check BotFather / Developer Portal settings |
| Commands work but no text responses | Agent path incorrect | Verify with `enconvo channels list` |
| Discord 1010 error on send | Missing User-Agent header | Already fixed in codebase — update to latest |
| Bot responds to itself in loops | Missing bot-author check | Already handled: `message.author.bot` guard |
| Token validation fails | Token format wrong or revoked | Telegram: get new from BotFather; Discord: reset in Developer Portal |

### Health Check

```bash
# Check EnConvo is reachable
curl http://localhost:54535/health

# Check agent availability
enconvo agents check [--agent mavis] [--json]

# Check all instances
enconvo channels status --channel telegram
enconvo channels status --channel discord
```

---

## Common Workflows

### Deploy a Full Team (Telegram + Discord)

```bash
# Register all Telegram bots
enconvo channels add --channel telegram --name mavis    --agent chat_with_ai/chat                --token <t1> --validate
enconvo channels add --channel telegram --name elena    --agent custom_bot/YJBEY3qHhFslKkMd6WIT --token <t2> --validate
enconvo channels add --channel telegram --name vivienne --agent custom_bot/BVxrKvityKoIpdJjS4p7 --token <t3> --validate
enconvo channels add --channel telegram --name timothy  --agent custom_bot/pOPhKXnP1CmNjCSQZ1mK --token <t4> --validate

# Register all Discord bots
enconvo channels add --channel discord --name mavis-discord    --agent chat_with_ai/chat                --token <d1> --validate
enconvo channels add --channel discord --name elena-discord    --agent custom_bot/YJBEY3qHhFslKkMd6WIT --token <d2> --validate
enconvo channels add --channel discord --name vivienne-discord --agent custom_bot/BVxrKvityKoIpdJjS4p7 --token <d3> --validate
enconvo channels add --channel discord --name timothy-discord  --agent custom_bot/pOPhKXnP1CmNjCSQZ1mK --token <d4> --validate

# Start all bots
enconvo channels login --channel telegram --name mavis -f &
enconvo channels login --channel telegram --name elena -f &
enconvo channels login --channel discord --name mavis-discord -f &
enconvo channels login --channel discord --name elena-discord -f &
```

### Set Up Agent Team Roster

```bash
enconvo agents add --id mavis --name Mavis --role "Team Lead" \
  --specialty "Coordination" --agent-path chat_with_ai/chat \
  --telegram-bot @Mavis_bot --instance-name mavis --emoji crown --lead

enconvo agents add --id elena --name Elena --role "Content Director" \
  --specialty "Content" --agent-path custom_bot/YJBEY3qHhFslKkMd6WIT \
  --telegram-bot @Elena_bot --instance-name elena --emoji pencil

enconvo agents sync --dry-run
enconvo agents sync
```

### Move a Bot to a Different Agent

```bash
enconvo channels remove --channel telegram --name mavis --delete
enconvo channels add --channel telegram --name mavis \
  --token "same-token" --agent new_agent/path --validate
enconvo channels login --channel telegram --name mavis -f
```

### Set Up Named Groups

```bash
# Get chat ID from a message in the group (Telegram: negative number, Discord: snowflake)
enconvo channels groups add --name main --chat-id "-5063546642" --label "Main Team Group"
enconvo channels groups add --name dev --chat-id "1234567890123456789" --label "Dev Server Channel"

# Send to group by name
enconvo channels send --channel telegram --name mavis --group main --message "Team standup time!"
```

### Type Check the Codebase

```bash
cd /path/to/enconvo_cli
npx tsc --noEmit
```
