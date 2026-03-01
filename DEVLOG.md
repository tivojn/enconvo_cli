# EnConvo CLI — Development Log

> Living document. Updated as the project evolves. Read this to understand what exists, why decisions were made, and what's next.

**Last updated:** 2026-03-01

---

## What This Is

An extensible CLI tool (`enconvo_cli`) for managing **EnConvo AI** channels, agents, and services. Originally a standalone Telegram bot adapter, now refactored into a CLI modeled after OpenClaw's multi-agent architecture.

**Stack:** TypeScript, Commander.js (CLI), Grammy (Telegram), tsx (runtime)
**Repo:** https://github.com/tivojn/EnConvo_Channels

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

## EnConvo API Integration

- **Base URL:** `http://localhost:54535`
- **Endpoint pattern:** `POST /command/call/{category}/{command}`
- **Deep link mapping:** `enconvo://{category}/{command}` → `/command/call/{category}/{command}`
- **Request body:** `{ "input_text": "...", "sessionId": "..." }`
- **Response formats:**
  - Standard: `{ "type": "messages", "messages": [{ "role": "assistant", "content": [{ "type": "text", "text": "..." }] }] }`
  - Simple: `{ "result": "..." }` (used by Translator agent)
  - Flow steps: content items with `type: "flow_step"`, `flowParams` containing file paths or Deliverable objects
- **File delivery:** Response parser extracts absolute file paths from text content, `flow_step` params, and `Deliverable` objects. Files are sent as Telegram photos (images) or documents (everything else).
- **Terminology:** EnConvo calls its agents "commands", "bots", or "actions"

---

## Current File Structure (Phase 7)

```
src/
├── cli.ts                          # CLI entry point (Commander.js)
├── index.ts                        # Legacy dev entry (backward compat)
├── types/
│   └── channel.ts                  # ChannelAdapter interface
├── config/
│   ├── paths.ts                    # ~/.enconvo_cli/ path constants
│   └── store.ts                    # Global config read/write/migrate
├── commands/
│   └── channels/
│       ├── index.ts                # Registers all subcommands
│       ├── list.ts                 # List channels + status
│       ├── status.ts               # Runtime status, probe live
│       ├── add.ts                  # Configure a channel
│       ├── remove.ts               # Remove/disable config
│       ├── login.ts                # Start service (foreground or launchd)
│       ├── logout.ts               # Stop service
│       ├── capabilities.ts         # Show supported features
│       ├── resolve.ts              # Resolve user/group identifier
│       └── logs.ts                 # Tail log files
├── channels/
│   ├── registry.ts                 # Adapter lookup by name
│   └── telegram/
│       ├── adapter.ts              # Implements ChannelAdapter
│       ├── bot.ts                  # Bot creation, middleware + handler wiring
│       ├── config.ts               # Legacy config loader (.env + config.json)
│       ├── handlers/
│       │   ├── commands.ts         # /start, /help, /agent, /reset, /status
│       │   ├── message.ts          # Text message → EnConvo → reply
│       │   └── media.ts            # Photo/document download → EnConvo → reply
│       ├── middleware/
│       │   ├── auth.ts             # Allowlist check
│       │   └── typing.ts           # "typing..." indicator loop
│       └── utils/
│           └── message-splitter.ts # Splits long replies at 4096 char limit
└── services/                       # Shared across channels
    ├── enconvo-client.ts           # HTTP client (accepts optional url/timeout)
    ├── response-parser.ts          # Parses EnConvo response formats
    └── session-manager.ts          # Session ID + agent selection per chat

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
  "version": 1,
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
      "enabled": true,
      "token": "BOT_TOKEN_HERE",
      "allowedUserIds": [],
      "service": {
        "plistLabel": "com.enconvo.telegram-adapter",
        "logPath": "~/Library/Logs/enconvo-telegram-adapter.log",
        "errorLogPath": "~/Library/Logs/enconvo-telegram-adapter-error.log"
      }
    }
  }
}
```

**Future:** Config will support multiple instances per channel type (one bot per agent), with a `--name` identifier and `--agent` mapping.

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

---

## What's Next

### Near-Term: Multi-Instance Channels
- Support multiple Telegram bot instances (one per agent)
- Add `--name` and `--agent` flags to `channels add`
- Config schema: `channels.telegram` becomes `channels.telegram.instances[]`
- Each instance has its own token, agent mapping, and service config

### Near-Term: Agent Management
- `enconvo agents list` — enumerate available EnConvo agents
- Ideally query EnConvo's API for dynamic agent discovery
- Fallback: manual config in `~/.enconvo_cli/config.json`

### Medium-Term: Agent Groups
- Create Telegram groups as team compositions
- Mavis as orchestrator/team lead
- Inter-agent delegation (likely via EnConvo's own tools, not bot-to-bot Telegram messages)

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

- **No agent discovery API** — Agents are manually configured. Waiting for EnConvo to expose an enumeration endpoint.
- **Single-instance channels** — Currently one Telegram bot per channel type. Multi-instance support needed for one-bot-per-agent model.
- **In-memory state** — Agent selection and session overrides live in JS Maps. Lost on restart.
- **No retry on Telegram 409** — Polling instance collisions crash; launchd restarts.
- **Media handling is one-way** — Photos/docs downloaded and path sent as text to EnConvo.
- **Markdown rendering** — Telegram Markdown subset doesn't match GitHub-flavored markdown from EnConvo responses.

---

## How to Run

### Development
```bash
cp .env.example .env  # Add BOT_TOKEN
npm install
npm run dev
```

### CLI
```bash
npm run cli -- channels list
npx tsx src/cli.ts channels list
# Or after npm link:
enconvo channels list
```

### Production (LaunchAgent)
```bash
npm run install-service   # Install + start
npm run logs              # Watch output
npm run uninstall-service # Stop + remove
```

### Prerequisites
- macOS with Homebrew node
- EnConvo running locally (port 54535)
- Telegram bot token(s)
- For LaunchAgent: `/bin/bash` needs Full Disk Access (install script guides you)
