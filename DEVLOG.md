# EnConvo CLI — Development Log

> Living document. Updated as the project evolves. Read this to understand what exists, why decisions were made, and what's next.

**Last updated:** 2026-03-01 (Phase 10.6)

---

## What This Is

An extensible CLI tool (`enconvo_cli`) for managing **EnConvo AI** channels, agents, and services. Originally a standalone Telegram bot adapter, now refactored into a CLI modeled after OpenClaw's multi-agent architecture.

**Stack:** TypeScript, Commander.js (CLI), Grammy (Telegram), tsx (runtime)
**Repo:** https://github.com/tivojn/enconvo_cli

---

## Vision & Architecture

### The Big Picture

EnConvo is a local macOS AI platform with many agents (it calls them "commands", "bots", or "actions"). Users can create, duplicate, and customize agents in EnConvo's GUI. `enconvo_cli` maps those agents to messaging channels and composes them into teams.

```
EnConvo (agent factory, GUI)
  └── enconvo_cli (maps agents to channels, composes teams)
        ├── Telegram bots (one bot per agent)
        ├── Future: Discord, Slack, etc.
        └── Agent groups (team compositions)
```

**Flow:** Customize agent in EnConvo → Register via CLI → Deploy to channel → Compose into groups

### Architectural Inspiration: OpenClaw

OpenClaw (Peter Steinberger's autonomous AI assistant) is the architectural reference — not a dependency. Key patterns borrowed:

| OpenClaw Concept | EnConvo CLI Equivalent |
|---|---|
| One bot per agent (dedicated) | Each Telegram bot maps to one EnConvo agent |
| Main agent (orchestrator) | Mavis = team lead, delegates to specialists |
| Agent groups | Telegram groups with multiple agent bots |
| Channel adapters | `ChannelAdapter` interface, one impl per platform |
| Extensible CLI | Commander.js with subcommand groups |

### One Bot Per Agent (Key Design Shift)

**Old model (Phase 2):** One Telegram bot → N agents (switch via `/agent` command)
**New model (target):** N Telegram bots → one agent each (dedicated, no switching)

Examples:
```
@EnConvo_Mavis_bot       → chat_with_ai/chat     (team lead, orchestrator)
@EnConvo_Translator_bot  → translate/translate    (specialist)
@EnConvo_OpenClaw_bot    → openclaw/OpenClaw      (specialist)
```

Target CLI workflow:
```bash
enconvo channels add --channel telegram --name mavis --token <token-1> --agent chat_with_ai/chat
enconvo channels add --channel telegram --name translator --token <token-2> --agent translate/translate
enconvo channels add --channel telegram --name openclaw --token <token-3> --agent openclaw/OpenClaw
enconvo channels login --channel telegram --name mavis
enconvo channels login --channel telegram --name translator
enconvo channels login --channel telegram --name openclaw
```

### Agent Groups (Team Compositions)

Telegram groups become purpose-built teams. Each group has a team lead (Mavis) and specialists:

```
"EnConvo Agents Group" (general purpose)
├── @EnConvo_Mavis_bot         → Team Lead (orchestrates, delegates)
├── @EnConvo_Translator_bot    → Specialist
└── @EnConvo_OpenClaw_bot      → Specialist

"French Office Team" (custom)
├── @EnConvo_Mavis_Fr_bot      → Team Lead (French-configured Mavis)
├── @EnConvo_Translator_EnFr   → EN↔FR specialist
└── @EnConvo_Explain_Fr_bot    → French explainer
```

Mavis as team lead can:
- Receive complex requests in the group
- Break them down and delegate to specialists
- Collect results and synthesize responses
- Use her own tools for direct handling

### Custom Agents

Users can customize agents in EnConvo's GUI:
- Duplicate an existing command/agent
- Customize via skills or settings
- Example: `translate` → `new-translator-en-fr` (specialized EN↔FR translator)
- Then register the custom agent via CLI and deploy to a channel

This means the agent list is dynamic and user-defined — not hardcoded.

---

## EnConvo Platform Integration

### API Server

- **Base URL:** `http://localhost:54535`
- **Endpoint pattern:** `POST /command/call/{extensionName}/{commandName}`
- **Deep link mapping:** `enconvo://{extensionName}/{commandName}` → `/command/call/{extensionName}/{commandName}`
- **Request body:** `{ "input_text": "...", "sessionId": "..." }`
- **Response formats:**
  - Standard: `{ "type": "messages", "messages": [{ "role": "assistant", "content": [{ "type": "text", "text": "..." }] }] }`
  - Simple: `{ "result": "..." }` (used by Translator agent)
  - Flow steps: content items with `type: "flow_step"`, `flowParams` containing file paths or Deliverable objects
- **File delivery:** Response parser extracts absolute file paths from text content, `flow_step` params, and `Deliverable` objects. Files are sent as Telegram photos (images) or documents (everything else).
- **Terminology:** EnConvo calls its agents "commands", "bots", or "actions"

### Command Registry (Agent Discovery)

**This is how `enconvo_cli` discovers all available agents.** No API enumeration endpoint needed — the full registry lives on disk.

**Reference:** The `enconvo-agent-cli` skill (`~/.claude/skills/enconvo-agent-cli/SKILL.md`) documents the complete registry structure, all 26 command types, preference schemas, LLM routing, tool assignment, and curl patterns.

#### File System Layout

```
~/.config/enconvo/
├── installed_commands/          # 1,107 command definitions (read-only registry)
│   └── {extensionName}|{commandName}.json
├── installed_preferences/       # 353 user config overrides (read-write)
│   └── {extensionName}|{commandName}.json
├── installed_extensions/        # 108 extension manifests
├── dropdown_list_cache/llm/     # Cached model lists (anthropic, openai, google, ollama)
└── extension/                   # Extension runtime code (JS bundles)
```

#### Key Command Types for `enconvo_cli`

| Type | What It Is | How CLI Uses It |
|---|---|---|
| `agent` | AI agent with tools | Deploy as a dedicated bot on a channel |
| `bot` | AI chatbot | Deploy as a dedicated bot on a channel |
| `tool` | Callable tool (for AI agents) | Assign to agents via preferences |
| `workflow` | Multi-step workflow | Deploy as a bot or invoke via CLI |
| `command` | General command | Invoke directly or wrap in a bot |

#### Reading the Registry

```bash
# List all agents and bots (the ones deployable to channels)
grep -l '"commandType":"agent"\|"commandType":"bot"' ~/.config/enconvo/installed_commands/*.json

# Get command details (title, type, path for curl)
python3 -c "
import json
d = json.load(open('$HOME/.config/enconvo/installed_commands/chat_with_ai|chat.json'))
print(f'Title: {d[\"title\"]}')
print(f'Type:  {d[\"commandType\"]}')
print(f'Key:   {d[\"commandKey\"]}')
print(f'Curl:  POST http://localhost:54535/command/call/{d[\"commandKey\"].replace(\"|\", \"/\")}')
"

# Search commands by keyword
python3 -c "
import json, glob, sys
q = sys.argv[1].lower()
for f in sorted(glob.glob('$HOME/.config/enconvo/installed_commands/*.json')):
    d = json.load(open(f))
    if q in d.get('title','').lower() or q in d.get('description','').lower():
        print(f'{d[\"commandKey\"]:50s} [{d.get(\"commandType\",\"?\"):10s}] {d.get(\"title\",\"\")}')
" "translate"
```

#### Key Insight: commandKey → curl → channel bot

Every EnConvo command has a `commandKey` like `chat_with_ai|chat` or `custom_bot|YJBEY3qHhFslKkMd6WIT`. This maps directly to:

- **Deep link:** `enconvo://chat_with_ai/chat` (replace `|` with `/`)
- **API call:** `POST http://localhost:54535/command/call/chat_with_ai/chat`
- **Channel bot:** `enconvo channels add --channel telegram --name mavis --agent chat_with_ai/chat --token <token>`

This chain — registry → curl pattern → channel deployment — is the core of `enconvo_cli`.

#### Configuring Agents (Preferences)

Each command's preferences live in `installed_preferences/{extensionName}|{commandName}.json` and control:

- **LLM routing:** Which model/provider the agent uses (`llm.commandKey`, e.g., `llm|chat_anthropic`)
- **Tool assignment:** Which tools the agent can call (`tools` JSON array)
- **System prompt:** Custom instructions (`prompt` field, supports Jinja2 templates)
- **Features:** Web search, image generation, execute permissions

Users configure these in EnConvo's GUI. `enconvo_cli` reads them to understand what each agent can do, and can also modify them programmatically.

#### Known Bots (Current)

| Bot | commandKey | Telegram | Instance |
|---|---|---|---|
| Mavis (team lead) | `chat_with_ai\|chat` | `@Encovo_Mavis_001_bot` | mavis |
| OpenClaw Assistant | `openclaw\|OpenClaw` | — | — |
| Translator | `translate\|translate` | — | — |
| Elena Content Dept | `custom_bot\|YJBEY3qHhFslKkMd6WIT` | `@Enconvo_Elena_Content_Dept_bot` | elena |
| Vivienne Finance Dept | `custom_bot\|BVxrKvityKoIpdJjS4p7` | `@Enconvo_Vivienne_Finance_bot` | vivienne |
| Timothy Dev Dept | `custom_bot\|pOPhKXnP1CmNjCSQZ1mK` | `@EnConvo_Timothy_Dev_bot` | timothy |

#### LLM Providers Available

| Provider | Key | Example Models |
|---|---|---|
| Anthropic | `llm\|chat_anthropic` | claude-opus-4-6, claude-sonnet-4-6 |
| OpenAI | `llm\|chat_open_ai` | gpt-5.2 |
| Google | `llm\|chat_google` | gemini-3-pro-preview |
| Enconvo AI | `llm\|enconvo_ai` | openai/gpt-5-mini |
| Ollama | `llm\|chat_ollama` | minimax-m2.5:cloud |

---

## Current File Structure (Phase 10.6)

```
src/
├── cli.ts                          # CLI entry point (Commander.js)
├── index.ts                        # Legacy dev entry (backward compat)
├── types/
│   └── channel.ts                  # ChannelAdapter interface
├── config/
│   ├── paths.ts                    # ~/.enconvo_cli/ path constants (config, agents, backups, prefs, commands, plist)
│   ├── store.ts                    # Global config CRUD, instance management, auto-migration
│   └── agent-store.ts             # Agent roster CRUD (~/.enconvo_cli/agents.json)
├── commands/
│   ├── channels/
│   │   ├── index.ts                # Registers all channel subcommands
│   │   ├── list.ts                 # List channels + status
│   │   ├── status.ts               # Runtime status, probe live
│   │   ├── add.ts                  # Configure a channel
│   │   ├── remove.ts               # Remove/disable config
│   │   ├── login.ts                # Start service (foreground or launchd)
│   │   ├── logout.ts               # Stop service
│   │   ├── capabilities.ts         # Show supported features
│   │   ├── resolve.ts              # Resolve user/group identifier
│   │   ├── logs.ts                 # Tail log files
│   │   └── send.ts                 # Send message through bot, deliver response to chat
│   └── agents/
│       ├── index.ts                # Registers all agent subcommands
│       ├── list.ts                 # List team agents (--bindings, --json)
│       ├── add.ts                  # Add agent to roster + create workspace
│       ├── delete.ts               # Remove agent from roster (--force deletes workspace)
│       ├── set-identity.ts         # Update agent identity fields + regenerate workspace
│       ├── sync.ts                 # Sync workspace prompts → EnConvo preferences (--dry-run)
│       ├── bindings.ts             # Show agent↔channel binding map
│       ├── refresh.ts              # Notify agents to re-read workspace files + team KB
│       └── check.ts                # Health check: agent files, version tracking, API reachability
├── channels/
│   ├── registry.ts                 # Adapter lookup + createAdapterInstance()
│   └── telegram/
│       ├── adapter.ts              # ChannelAdapter impl, instance-aware (instanceName, dynamic labels)
│       ├── bot.ts                  # createBot(token?, agentPath?, allowedUserIds?) — pinned or legacy mode
│       ├── config.ts               # Legacy config loader (.env + config.json)
│       ├── handlers/
│       │   ├── commands.ts         # /start, /help, /agent, /reset, /status (pinned-aware)
│       │   ├── message.ts          # Text handler factory + bare @mention handling + legacy export
│       │   └── media.ts            # Photo/document handler factories + legacy exports
│       ├── middleware/
│       │   ├── auth.ts             # createAuthMiddleware(allowedUserIds?) + legacy export
│       │   ├── mention-gate.ts     # Group chat filter: only respond to @mentions, replies, commands
│       │   └── typing.ts           # "typing..." indicator loop
│       └── utils/
│           └── message-splitter.ts # Splits long replies at 4096 char limit
└── services/                       # Shared across channels
    ├── enconvo-client.ts           # HTTP client (accepts optional url/timeout)
    ├── response-parser.ts          # Parses EnConvo response formats
    ├── session-manager.ts          # Session ID + agent selection per chat
    ├── workspace.ts                # Creates workspace dirs (IDENTITY.md, SOUL.md, AGENTS.md)
    └── team-prompt.ts              # Generates lean pointer prompt (agents read workspace + KB via read_file)

config.json                         # Legacy agent definitions + auth
com.enconvo.telegram-adapter.plist  # macOS LaunchAgent
scripts/
├── run.sh                          # rsync + launch wrapper (TCC workaround)
├── install.sh                      # Install LaunchAgent
└── uninstall.sh                    # Remove LaunchAgent
```

---

## Config Schema (`~/.enconvo_cli/config.json`)

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
          "token": "BOT_TOKEN_HERE",
          "agent": "chat_with_ai/chat",
          "allowedUserIds": [],
          "service": {
            "plistLabel": "com.enconvo.telegram-mavis",
            "logPath": "~/Library/Logs/enconvo-telegram-mavis.log",
            "errorLogPath": "~/Library/Logs/enconvo-telegram-mavis-error.log"
          }
        },
        "vivienne": {
          "enabled": true,
          "token": "BOT_TOKEN_HERE",
          "agent": "custom_bot/BVxrKvityKoIpdJjS4p7",
          "allowedUserIds": [],
          "service": {
            "plistLabel": "com.enconvo.telegram-vivienne",
            "logPath": "~/Library/Logs/enconvo-telegram-vivienne.log",
            "errorLogPath": "~/Library/Logs/enconvo-telegram-vivienne-error.log"
          }
        }
      }
    }
  },
  "enconvoApp": {
    "version": "2.2.23",
    "build": 254,
    "lastChecked": "2026-03-01T07:44:00.005Z"
  }
}
```

**Auto-migration:** Old flat configs (`channels.telegram: { token, ... }`) are automatically migrated to `channels.telegram.instances.default` on first load.

---

## Agent Roster Schema (`~/.enconvo_cli/agents.json`)

```json
{
  "version": 1,
  "team": "EnConvo AI Team",
  "members": [
    {
      "id": "mavis",
      "name": "Mavis",
      "emoji": "👑",
      "role": "Team Lead & Orchestrator",
      "specialty": "Coordination, delegation, strategy",
      "isLead": true,
      "bindings": {
        "agentPath": "chat_with_ai/chat",
        "telegramBot": "@Encovo_Mavis_001_bot",
        "instanceName": "mavis"
      }
    }
  ]
}
```

**Derived fields** (computed at load time, not stored):
- `preferenceKey` — from `agentPath`: `chat_with_ai/chat` → `chat_with_ai|chat`
- `workspacePath` — lead gets `~/.enconvo_cli/workspace/`, others get `~/.enconvo_cli/workspace-{id}/`

### Workspace Directory Structure

```
~/.enconvo_cli/
├── agents.json                    # Team roster
├── config.json                    # Channel instances, EnConvo API config
├── backups/                       # Preference backups before sync
├── kb/                            # Shared team knowledge base (all agents read this)
├── workspace/                     # Mavis (team lead, no suffix)
│   ├── IDENTITY.md                # Name, role, emoji, team, intro
│   ├── SOUL.md                    # Personality directives, specialist focus
│   └── AGENTS.md                  # Team roster, delegation guide, group chat rules
├── workspace-vivienne/
│   ├── IDENTITY.md
│   ├── SOUL.md
│   └── AGENTS.md
├── workspace-elena/
│   └── ...
└── workspace-timothy/
    └── ...
```

### Prompt Sync Flow

```
enconvo agents sync [--dry-run] [--agent <id>] [--watch] [--chat <id>]

1. Generate lean pointer prompt (name, role, workspace path, team KB path, read instructions)
2. Append Jinja2 footer: {{ now }}, {{responseLanguage}}
3. Backup existing preference file to ~/.enconvo_cli/backups/
4. Write prompt field to ~/.config/enconvo/installed_preferences/{key}.json

With --watch: monitors ~/.enconvo_cli/kb/ and re-runs steps 1-4 on changes.
With --watch --chat <id>: also silently refreshes agents with fresh sessions.

Agent reads IDENTITY.md, SOUL.md, AGENTS.md, and team KB via read_file on fresh session start.
```

---

## Development Timeline

### Phase 1 — Initial Adapter (commit `c98f911`)
- Basic Grammy bot with long polling
- Text messages forwarded to EnConvo's default agent (Mavis)
- Session IDs based on Telegram chat ID
- Auth allowlist, typing indicator, message splitting

### Phase 2 — Multi-Agent Support (commit `553f50a`)
- Added `/agent` command to list and switch between EnConvo agents
- Agents configured in `config.json` with id, name, path, description
- Per-chat agent selection stored in memory (Map)
- **Note:** This approach (one bot, many agents) will be superseded by one-bot-per-agent model

### Phase 3 — Command Filtering (commit `f23cb3f`)
- Unrecognized `/commands` blocked from being forwarded to EnConvo
- Prevents confusing AI responses to bot commands

### Phase 4 — Translator + Simple Response Format (commit `32a5254`)
- Added Translator agent to config
- Response parser handles `{ "result": "..." }` format alongside message arrays

### Phase 5 — File Delivery (commit `3ce018e`)
- Parse `Deliverable` objects from `flow_step` content
- Extract file paths from `flowParams` JSON
- Send images as photos, other files as documents
- Media handler: download Telegram photos/documents to `/tmp/`, include path in EnConvo request

### Phase 6 — Auto-Restart Service (2026-03-01)
- Created macOS LaunchAgent (`com.enconvo.telegram-adapter.plist`) for auto-restart on wake/crash/login
- `KeepAlive` with `NetworkState: true` — restarts when network returns (after Mac wakes)
- `RunAtLoad: true` — starts on user login
- **TCC workaround:** Project in `~/Downloads` (macOS-protected). LaunchAgent runs via `/bin/bash` (Full Disk Access), `rsync`s to `~/.local/share/enconvo-telegram-adapter/` before launching
- Install script auto-detects permission errors and opens System Settings
- Scripts: `npm run install-service`, `npm run uninstall-service`, `npm run logs`

### Phase 7 — CLI Refactor: `enconvo_cli` (commit `7cce501`)
- Refactored into extensible CLI with Commander.js
- Moved Telegram code into `src/channels/telegram/`
- Created `ChannelAdapter` interface — contract for all channel implementations
- Centralized config at `~/.enconvo_cli/config.json`
- Built `TelegramAdapter`, channel registry, 9 CLI subcommands
- All commands support `--json` flag
- `npm run dev` backward compat preserved

### Phase 8 — Multi-Instance Channels (commit `1ea7f3b`)
- **One bot per agent achieved.** Each Telegram bot instance is pinned to a single EnConvo agent.
- Config schema v2: `channels.telegram.instances.{name}` — each instance has token, agent, allowedUserIds, service config
- Auto-migration: old flat `channels.telegram: { token, ... }` → `channels.telegram.instances.default` on first load
- `createBot(token?, agentPath?, allowedUserIds?)` — pinned mode (dedicated agent) vs legacy mode (multi-agent switching)
- Handlers refactored with factory pattern: `createTextMessageHandler(agentPath?)`, `createPhotoHandler(agentPath?)`, etc.
- Legacy exports preserved — `npm run dev` path completely unchanged
- `TelegramAdapter` gains `instanceName` field, dynamic service labels (`com.enconvo.telegram-{name}`), and per-instance log paths
- `createAdapterInstance(channelType, instanceName)` in registry for fresh per-instance adapters
- All CLI commands updated: `--name` required for instance-level operations (`add`, `remove`, `login`, `logout`, `logs`, `resolve`), optional for `status`
- `list` shows instances grouped by channel type
- 16 files changed, 542 insertions, 312 deletions
- Live instances (legacy `npm run dev` retired):
  - `@Encovo_Mavis_001_bot` (mavis) → `chat_with_ai/chat` (team lead)
  - `@Enconvo_Vivienne_Finance_bot` (vivienne) → `custom_bot/BVxrKvityKoIpdJjS4p7`
  - `@Enconvo_Elena_Content_Dept_bot` (elena) → `custom_bot/YJBEY3qHhFslKkMd6WIT`

### Phase 9 — Programmatic Agent Creation (2026-03-01)
- **First agent created entirely from CLI** — no EnConvo GUI needed
- Timothy Dev Dept (`custom_bot|pOPhKXnP1CmNjCSQZ1mK`) created by writing two JSON files:
  - `~/.config/enconvo/installed_commands/custom_bot|{id}.json` — command definition
  - `~/.config/enconvo/installed_preferences/custom_bot|{id}.json` — system prompt, tools, LLM config
- **EnConvo hot-reloads** — new custom bot files picked up immediately, no app restart needed
- Structure matches GUI-created bots: `commandType: "bot"`, `from: "custom"`, `targetCommand: "chat_with_ai|chat_command"`
- Timothy equipped with file system tools, bash, web search, execute permission auto-approved
- Registered as Telegram instance and running: `@EnConvo_Timothy_Dev_bot`
- **Key discovery:** `installed_commands/` is writable for `from: "custom"` entries — the "read-only" label in the skill doc applies to store-installed extensions only
- Backup before creation: `/tmp/enconvo-registry-backup-*.tar.gz`
- Live instances now at 4:
  - `@Encovo_Mavis_001_bot` (mavis) → `chat_with_ai/chat`
  - `@Enconvo_Vivienne_Finance_bot` (vivienne) → `custom_bot/BVxrKvityKoIpdJjS4p7`
  - `@Enconvo_Elena_Content_Dept_bot` (elena) → `custom_bot/YJBEY3qHhFslKkMd6WIT`
  - `@EnConvo_Timothy_Dev_bot` (timothy) → `custom_bot/pOPhKXnP1CmNjCSQZ1mK`

### Phase 9.5 — Group Chat: Mention-Gating + Session Isolation (2026-03-01)

When all 4 bots were added to the same Telegram group, two problems surfaced:

**Problem 1: All bots respond to every message.** A message to `@mavis` triggered responses from all 4 bots.
**Fix:** Created `mention-gate.ts` middleware that filters group messages. Bots only respond when:
- Private chat (always respond)
- `@mentioned` by username (`@EnConvo_Mavis_bot how are you`)
- Replied to (continuing a thread)
- Targeted command (`/reset@EnConvo_Mavis_bot`)

Non-matching messages are silently ignored — no noise in the group.

**Problem 2: Stale context bleed.** All bots shared the session ID `telegram-{chatId}`, meaning they read each other's conversation history.
**Fix:** Session IDs now include the instance name: `telegram-{chatId}-{instanceName}`. Each bot has its own isolated context. The `session-manager.ts` was updated to key on `chatId:instanceId` instead of just `chatId`.

**Problem 3: @mentions stopped working after `/reset`.** This turned out to be a **Telegram Bot API limitation**, not a code bug. Bots with privacy mode enabled (the default) never receive plain text messages in groups — even if they contain `@BotUsername`. Telegram simply doesn't deliver them. The fix is to disable privacy mode via BotFather:
1. `/setprivacy` → Select bot → **Disable**
2. Remove and re-add the bot to existing groups (Telegram caches privacy per membership)

**Problem 4: Timothy didn't respond to bare `/reset`.** In groups with multiple bots, Telegram delivers untagged commands (`/reset`) to only one bot. The fix is to use targeted command syntax: `/reset@BotUsername`.

**Updated `/help` and `/start` commands** to show group-specific usage hints when the bot detects it's in a group chat.

Files changed:
- `src/channels/telegram/middleware/mention-gate.ts` (new) — group message filter
- `src/channels/telegram/bot.ts` — wire mention-gate, pass instanceId to handlers
- `src/channels/telegram/handlers/commands.ts` — group usage hints in /help and /start
- `src/channels/telegram/handlers/message.ts` — strip @mention from text, use instanceId
- `src/channels/telegram/handlers/media.ts` — use instanceId in session
- `src/services/session-manager.ts` — instance-aware session keys
- `src/channels/telegram/adapter.ts` — pass instanceName as instanceId to createBot()

### Phase 10 — Agent Team Awareness (commit `008644a`)

OpenClaw-inspired agent team system. Bots now know about each other, have personalities, and can delegate.

**Agent Roster (`agents.json`):**
- CRUD store for team members with bindings to EnConvo agent paths, Telegram bots, and CLI instances
- `AgentMember` interface: id, name, chineseName, emoji, role, specialty, isLead, bindings
- Derived fields: `preferenceKey` and `workspacePath` computed at load time

**Workspace System (ported from OpenClaw):**
- Each agent gets `~/.enconvo_cli/workspace[-{id}]/` with three files:
  - `IDENTITY.md` — name, role, emoji, team, telegram handle, intro
  - `SOUL.md` — personality directives (from OpenClaw), specialist focus per agent
  - `AGENTS.md` — full team roster, delegation guide, group chat rules
- Lead agent (Mavis) gets `workspace/` (no suffix, mirrors OpenClaw's main workspace)
- Ported from OpenClaw: Octavia→Mavis, `sessions_spawn`→`@mention` delegation, stripped image generation sections

**Prompt Sync:**
- `team-prompt.ts` reads workspace files, compresses into a single system prompt
- Includes identity intro, soul directives, team roster, delegation guide, group chat rules
- Jinja2 footer: `{{ now }}`, `{{responseLanguage}}`
- Writes to `~/.config/enconvo/installed_preferences/{key}.json` (prompt field only)
- Backs up existing preference files to `~/.enconvo_cli/backups/` before writing

**8 CLI commands (`enconvo agents`):**
- `list [--bindings] [--json]` — show team roster
- `add --id <id> --name <name> ...` — add agent + create workspace
- `delete <id> [--force]` — remove agent, optionally delete workspace
- `set-identity <id> --name <n> --role <r> ...` — update identity + regenerate workspace
- `sync [--dry-run] [--agent <id>]` — push prompts to EnConvo preferences
- `bindings [--json]` — show agent↔channel binding map
- `refresh --chat <id> [--agent <id>] [--reset]` — notify agents to re-read workspace files
- `check [--agent <id>] [--json]` — health check: agent files, version, API

**Bare @mention fix:**
- Previously, a bare `@BotUsername` (no text) was silently dropped — the mention got stripped and the empty string was discarded
- Now: if text is empty after stripping, use the replied-to message's text, or fall back to a simple prompt
- Prevents silent non-responses when users @mention a bot to get its attention

**Initial roster (4 agents):**
- 👑 Mavis (team lead) → `chat_with_ai/chat` → `@Encovo_Mavis_001_bot`
- 💰 Vivienne (finance) → `custom_bot/BVxrKvityKoIpdJjS4p7` → `@Enconvo_Vivienne_Finance_bot`
- ✍️ Elena (content) → `custom_bot/YJBEY3qHhFslKkMd6WIT` → `@Enconvo_Elena_Content_Dept_bot`
- 💻 Timothy (dev) → `custom_bot/pOPhKXnP1CmNjCSQZ1mK` → `@EnConvo_Timothy_Dev_bot`

Files: 13 changed, 806 insertions, 1 deletion.

### Phase 10.1 — `channels send` Command (commit `5ae891f`)

CLI-driven bot messaging — send a message through any bot instance and deliver the response to a Telegram chat. This closes the loop: you can now interact with agents from the terminal and see the conversation in Telegram.

```bash
enconvo channels send --channel telegram --name vivienne --chat "-5063546642" --message "where is your portrait, show me"
```

**Flow:**
1. Looks up the channel instance (token + agent path) from `config.json`
2. Calls EnConvo API with the message and a session ID (`telegram-{chatId}-{instanceName}`)
3. Parses the response (text + file paths)
4. Sends text to the Telegram chat via bot API (Markdown with fallback)
5. Sends any files as photos (images) or documents (other)

**Options:** `--channel`, `--name`, `--chat`, `--message`, `--json`

**Why this matters:** Previously, testing agent responses required either using Telegram directly or calling the EnConvo API via curl (which doesn't show up in Telegram). This command does both — calls the agent AND delivers the response to the chat, so the conversation is visible in the group.

Files: 2 changed, 107 insertions.

### Phase 10.2 — Lean Pointer Prompts + Refresh Command (commit `c578cdf`)

Replaced the heavy prompt generation (which crammed IDENTITY/SOUL/AGENTS content into the system prompt) with a lean pointer prompt. Agents now read their own workspace files at conversation start via `read_file`.

**Lean prompt format:**
```
You are Mavis (梅薇), the Team Lead & Orchestrator of the EnConvo AI Team.
Your Telegram bot: @Encovo_Mavis_001_bot

Your workspace: ~/.enconvo_cli/workspace/
Team knowledge base: ~/.enconvo_cli/kb/

IMPORTANT: At the start of every conversation, read your workspace files and team KB:
- IDENTITY.md — your identity, appearance, portrait
- SOUL.md — your personality and directives
- AGENTS.md — team roster, delegation rules, group chat rules
- Team KB (all files in ~/.enconvo_cli/kb/) — shared team rules and standards

Follow all rules in these files. Re-read them if asked to refresh.

# Current time is {{ now }}.
# Response Language: {{responseLanguage}}
```

**Why:** The old approach crammed ~2KB of compressed workspace content into each prompt. This was fragile (compression logic could lose nuance) and inflexible (edits to workspace files required re-sync). The lean prompt delegates reading to the agent itself — edits to IDENTITY.md, SOUL.md, AGENTS.md, or team KB files take effect on the next conversation start, no re-sync needed.

**`enconvo agents refresh` command:**
```bash
enconvo agents refresh --chat "-5063546642"                    # refresh all agents
enconvo agents refresh --chat "-5063546642" --agent vivienne   # refresh one
enconvo agents refresh --chat "-5063546642" --reset            # fresh session + refresh
```

Sends a refresh message to each agent via EnConvo API, asking them to re-read their workspace files and team KB. Delivers the agent's acknowledgment to the specified Telegram chat. Useful after editing workspace files mid-conversation.

**`TEAM_KB_DIR` constant:**
- `~/.enconvo_cli/kb/` — shared team knowledge base directory
- Referenced in lean prompts so all agents read from the same KB
- Path constant moved to `src/config/paths.ts`

### Phase 10.3 — Health Check & Version Tracking (commit `c578cdf`)

EnConvo app updates can silently break the CLI — `installed_commands/` gets batch-rewritten, agent paths could vanish, prompts could be wiped. Added a health-check command and version tracking.

**`enconvo agents check` command:**
```bash
enconvo agents check                    # check all agents
enconvo agents check --agent vivienne   # check one agent
enconvo agents check --json             # machine-readable output
```

**Per-agent checks:**
- Command file exists: `installed_commands/{preferenceKey}.json`
- Preference file exists: `installed_preferences/{preferenceKey}.json`
- Prompt synced: preference's `prompt` field starts with `You are {name}`
- Workspace: IDENTITY.md, SOUL.md, AGENTS.md all exist
- Telegram instance: channel config has the matching instance

**Global checks:**
- EnConvo app version: reads from `/Applications/EnConvo.app/Contents/Info.plist` via `PlistBuddy`, compares to stored version
- API reachable: quick curl ping to `http://localhost:54535`
- Team KB: `~/.enconvo_cli/kb/` exists and file count

**Version tracking:**
- Stored in `~/.enconvo_cli/config.json` as `enconvoApp: { version, build, lastChecked }`
- On first run, stores the current version
- On subsequent runs, compares and flags if version changed (warns to re-check agent paths)
- `lastChecked` updated on every run

**Output example:**
```
EnConvo v2.2.23 (build 254) — matches stored version ✓
API: reachable (http://localhost:54535) ✓

👑 Mavis:
  Command file    ✓ chat_with_ai|chat.json
  Preference      ✓ chat_with_ai|chat.json
  Prompt synced   ✓ lean prompt detected
  Workspace       ✓ IDENTITY.md, SOUL.md, AGENTS.md
  Telegram        ✓ instance "mavis" configured

💰 Vivienne:
  Command file    ✓ custom_bot|BVxrKvityKoIpdJjS4p7.json
  ...

Team KB: ✓ ~/.enconvo_cli/kb/ (1 file)

All checks passed: 23/23
```

**New path constants:**
- `ENCONVO_COMMANDS_DIR` — `~/.config/enconvo/installed_commands/`
- `ENCONVO_APP_PLIST` — `/Applications/EnConvo.app/Contents/Info.plist`

Files: 4 changed, 452 insertions, 118 deletions.

### Phase 10.4 — Team KB Injection into System Prompt (commit `7abbe89`)

**Problem discovered:** Agents were told to `read_file` the team KB (`~/.enconvo_cli/kb/`) at conversation start, but they acknowledged the files without actually enforcing the rules. A "no emerald color in selfies" rule was added to `team-standards.md` and agents were refreshed, but Vivienne and Elena still offered to generate emerald selfies. Twice.

**Root cause:** `read_file` is unreliable for rule enforcement. Agents treat file contents as reference material, not binding instructions. Identity/personality files (IDENTITY.md, SOUL.md) work fine as `read_file` targets because they're descriptive, not prescriptive. But hard rules need to be in the system prompt to be enforced.

**Fix:** `team-prompt.ts` now reads all `*.md` files from `~/.enconvo_cli/kb/` and injects their contents directly into the system prompt under a `MANDATORY TEAM RULES (enforced — no exceptions)` header. The lean prompt still tells agents to read their workspace files via `read_file` (for identity/personality), but team KB rules are baked in.

**Updated prompt structure:**
```
You are {name}, the {role} of the EnConvo AI Team.
...
[workspace pointers + read_file instructions]

---
MANDATORY TEAM RULES (enforced — no exceptions):

# Team Standards
## General Rules
- Always match the user's language
...
## Image Generation Rules
- No emerald color — ...

# Current time is {{ now }}.
# Response Language: {{responseLanguage}}
```

**Workflow for team rule changes:**
1. Edit `~/.enconvo_cli/kb/team-standards.md` (or add new `.md` files)
2. `enconvo agents sync` — regenerates all prompts with embedded KB rules
3. `enconvo agents refresh --chat <id> --reset` — fresh sessions pick up new prompt

**Key insight:** Two-tier prompt strategy works best:
- **Workspace files** (IDENTITY.md, SOUL.md, AGENTS.md) → read via `read_file` at conversation start. Descriptive content — identity, personality, team roster. Fine if an agent reads these lazily.
- **Team KB** (`~/.enconvo_cli/kb/*.md`) → injected into system prompt. Prescriptive content — rules, bans, policies. Must be enforced, no exceptions.

**Test result:** After injection, all 3 agents (Timothy, Vivienne, Elena) correctly refused the emerald selfie request. Elena even self-corrected: "I just broke it earlier — my bad. That emerald selfie shouldn't have happened. Won't repeat."

**Later reverted** in Phase 10.6 — hardcoding was the wrong fix. The real issue was stale sessions. See Phase 10.6 for details.

Files: 1 changed, 34 insertions, 1 deletion.

### Phase 10.5 — Auto-Sync Watch Mode (commit `4d9130d`)

Added `--watch` flag to the sync command to monitor team KB for changes and auto-sync agent prompts.

```bash
enconvo agents sync --watch              # watch + auto-sync all agents
enconvo agents sync --watch --agent mavis # watch + auto-sync one agent
```

- Uses `fs.watch()` on `~/.enconvo_cli/kb/` to monitor `.md` file changes
- 300ms debounce to handle editor save patterns (write + rename)
- Auto-syncs all agent prompts on every change
- Reloads the agent roster on each trigger (picks up roster changes too)
- Ignores non-`.md` files and hidden files
- Runs until Ctrl+C

Files: 1 changed, 121 insertions, 53 deletions.

### Phase 10.6 — Revert KB Hardcoding + Silent Refresh Pipeline (commit `a15fd76`)

**Key discovery:** The Phase 10.4 hardcoding of team KB into the system prompt was the wrong fix. We retested with lean prompts (no hardcoding) + fresh sessions (`--reset`) — agents followed the rules correctly. The real problem was **stale sessions**, not `read_file` being unreliable.

Two variables changed in the original Phase 10.4 test:
1. Hardcoded rules into system prompt
2. Used `--reset` (fresh session)

We never isolated which one fixed it. Retesting proved: `read_file` + fresh session is enough. Hardcoding is unnecessary and bad for maintenance (rules duplicated across all preference files, prompt bloats).

**Changes:**

1. **Reverted `team-prompt.ts`** — back to lean pointer prompt, no KB injection. Strengthened wording: "Team KB contains MANDATORY rules that override your own judgment. Follow them strictly — no exceptions, no workarounds."

2. **`--silent` flag on refresh** — agents re-read workspace files via EnConvo API but nothing gets posted to the Telegram chat. Prevents 4 (or 1000) agents flooding the group with acknowledgment messages.
   ```bash
   enconvo agents refresh --chat "-5063546642" --reset --silent
   ```

3. **Watch + auto-refresh pipeline** — `--watch --chat <id>` now triggers a full cycle on KB changes:
   ```bash
   enconvo agents sync --watch --chat "-5063546642"
   ```
   Edit KB file → watcher detects change (300ms debounce) → syncs all prompts → silently refreshes all agents with fresh sessions. Zero manual steps.

**Final architecture (two-tier prompt strategy):**
- **System prompt** (lean pointer) → tells agents WHERE to read files, not WHAT they contain
- **Workspace files** (IDENTITY.md, SOUL.md, AGENTS.md) → descriptive content, read via `read_file`
- **Team KB** (`~/.enconvo_cli/kb/*.md`) → prescriptive rules, read via `read_file` on fresh session start
- **Watch mode** → ensures KB changes propagate automatically

**Workflow for team rule changes (fully automated):**
1. Start `enconvo agents sync --watch --chat <chatId>` (leave running)
2. Edit `~/.enconvo_cli/kb/team-standards.md` — that's it. Auto-synced + auto-refreshed silently.

Files: 3 changed, 66 insertions, 48 deletions.

---

## What's Next

### Near-Term: Agent Creation CLI Command
- `enconvo agents create --name "New Agent" --prompt "..." --tools file_system,bash,web_search` — formalize the Phase 9 pattern into a proper CLI command
- Auto-generate random ID, stateId, write both JSON files, verify via API

### Near-Term: Deeper Agent Inspection
- `enconvo agents inspect --agent chat_with_ai/chat` — show command details, LLM, tools, prompt
- `enconvo agents configure` — modify LLM routing, tool assignment, system prompt from CLI

### Medium-Term: Inter-Agent Delegation
- Mavis delegates tasks to specialists via EnConvo tools or Telegram @mentions
- Cross-agent session forwarding (agent A spawns a task for agent B)

### Future: Additional Channels
- Discord, Slack, etc. — each implements `ChannelAdapter`
- Same one-bot-per-agent model

### Future: Self-Evolution Patterns (OpenClaw-Inspired)
- **Channel health watchdog** — periodic heartbeat probes, auto-restart on failure
- **CLI usage logging** — record invocations to `~/.enconvo_cli/history.jsonl` for pattern analysis
- **Pattern crystallization** — detect repeated workflows, suggest combined commands
- **Channel scaffolding** — auto-generate adapter code for new channel types

---

## Known Limitations

- **Agent roster is separate from EnConvo registry** — `enconvo agents list` shows the team roster (`agents.json`), not the full EnConvo command registry (1,107 commands). An `enconvo agents inspect` command to query the registry directly is planned.
- **In-memory state** — Agent selection and session overrides live in JS Maps. Lost on restart.
- **LaunchAgent scripts not yet multi-instance** — `install.sh`/`uninstall.sh` still reference the single `com.enconvo.telegram-adapter` plist. Need per-instance plist generation.
- **Legacy code still in tree** — `src/index.ts`, `config.ts`, `config.json`, `.env` are no longer used in production (all bots run via multi-instance CLI) but remain because handler factory exports depend on `config.ts` at import time. Safe to remove in a dedicated refactor.
- **Group privacy is a BotFather setting, not code** — Each bot must have privacy mode disabled via BotFather (`/setprivacy` → Disable) for @mention support in groups. This is a Telegram API limitation. After changing the setting, the bot must be removed and re-added to existing groups.
- **No retry on Telegram 409** — Polling instance collisions crash; launchd restarts.
- **Media handling is one-way** — Photos/docs downloaded and path sent as text to EnConvo.
- **Markdown rendering** — Telegram Markdown subset doesn't match GitHub-flavored markdown from EnConvo responses.

---

## How to Run

### Prerequisites
- macOS with Node.js (Homebrew or nvm)
- EnConvo running locally (port 54535)
- Telegram bot token(s) — see Telegram Bot Setup below
- For LaunchAgent: `/bin/bash` needs Full Disk Access (install script guides you)

### Telegram Bot Setup (BotFather)

Each bot needs to be created and configured in BotFather before registering with `enconvo_cli`.

#### 1. Create the bot
1. Open Telegram → search [@BotFather](https://t.me/BotFather)
2. `/newbot` → choose display name → choose username (must end in `bot`)
3. Save the API token (format: `1234567890:AAF...`)

#### 2. Configure bot settings (per bot)

**Disable Group Privacy** (required for group @mention support):
```
/setprivacy → Select bot → Disable
```
Without this, the bot will NOT receive `@mention` messages in groups — only targeted commands (`/cmd@BotName`) and replies. This is a Telegram API limitation, not a code issue.

> After disabling privacy, **remove and re-add** the bot to existing groups. Telegram caches the privacy setting per group membership.

**Set Bot Commands** (optional, adds command menu):
```
/setcommands → Select bot →
reset - Start a fresh conversation
status - Check connection status
help - Show help message
```

**Set Bot Info** (optional):
```
/setdescription → Select bot → "EnConvo AI agent — [agent name]"
/setabouttext → Select bot → About text
/setuserpic → Select bot → Send profile photo
```

#### 3. Register with enconvo_cli
```bash
enconvo channels add --channel telegram --name mavis \
  --token "1234567890:AAF..." \
  --agent chat_with_ai/chat \
  --validate
```

#### 4. Add to group (optional)
- Create a Telegram group or use an existing one
- Add each bot as a member
- Bots respond only to @mentions, replies, or targeted commands
- Each bot has isolated session context — no cross-contamination

### Development (Legacy Single Bot)
```bash
cp .env.example .env  # Add BOT_TOKEN
npm install
npm run dev
```

### CLI (Multi-Instance)
```bash
# List all channels and instances
enconvo channels list

# Add a bot instance (one bot per agent)
enconvo channels add --channel telegram --name vivienne --token <token> --agent custom_bot/BVxrKvityKoIpdJjS4p7 --validate
enconvo channels add --channel telegram --name mavis --token <token> --agent chat_with_ai/chat

# Start/stop instances
enconvo channels login --channel telegram --name vivienne -f   # foreground
enconvo channels logout --channel telegram --name vivienne

# Send a message through a bot (response appears in Telegram)
enconvo channels send --channel telegram --name vivienne --chat "-5063546642" --message "hello"
enconvo channels send --channel telegram --name timothy --chat "-5063546642" --message "what's your role" --json

# Monitor
enconvo channels status --channel telegram
enconvo channels status --channel telegram --name vivienne
enconvo channels logs --channel telegram --name vivienne

# Via npm/npx
npm run cli -- channels list
npx tsx src/cli.ts channels list
```

### Agent Team Management
```bash
# View team roster
enconvo agents list
enconvo agents list --bindings       # show channel mappings
enconvo agents list --json           # machine-readable

# Add an agent
enconvo agents add --id mavis --name Mavis --role "Team Lead" --specialty "Coordination" \
  --agent-path chat_with_ai/chat --telegram-bot @Mavis_bot --instance-name mavis \
  --emoji 👑 --lead

# Update identity
enconvo agents set-identity mavis --name "Mavis 2.0" --role "Chief Orchestrator"

# Show bindings (agent ↔ EnConvo ↔ Telegram)
enconvo agents bindings

# Preview prompts without writing
enconvo agents sync --dry-run
enconvo agents sync --dry-run --agent mavis

# Push prompts to EnConvo preferences (backs up first)
enconvo agents sync
enconvo agents sync --agent vivienne   # single agent

# Refresh agents (re-read workspace files)
enconvo agents refresh --chat "-5063546642"
enconvo agents refresh --chat "-5063546642" --agent mavis --reset

# Health check (agent files, version, API)
enconvo agents check
enconvo agents check --agent vivienne
enconvo agents check --json

# Remove an agent
enconvo agents delete timothy          # keeps workspace
enconvo agents delete timothy --force  # deletes workspace too
```

### Production (LaunchAgent)
```bash
npm run install-service   # Install + start
npm run logs              # Watch output
npm run uninstall-service # Stop + remove
```

### Group Chat Quick Reference

| Action | Result |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to bot's message | Only that bot responds |
| `/reset@BotName` | Resets only that bot's session |
| Bare `/reset` | Only one bot receives it (Telegram picks) |
| Regular text (no @mention) | No bot responds |

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Bot ignores @mentions in group | Privacy mode ON (BotFather default) | `/setprivacy` → Disable, then remove/re-add bot to group |
| Only one bot responds to `/reset` | Telegram delivers bare commands to one bot | Use `/reset@BotUsername` |
| 409 Conflict error | Another process polling same token | Kill old process: `ps aux \| grep telegram` |
| Empty responses | EnConvo not running | `curl http://localhost:54535/health` |
| Bot works in DM but not group | Privacy mode or not a member | Check BotFather settings, add bot to group |
