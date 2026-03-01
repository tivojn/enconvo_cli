# enconvo_cli — Config Reference

All configuration paths, schemas, and examples.

---

## File Paths

| File | Purpose |
|---|---|
| `~/.enconvo_cli/config.json` | Global config — channels, instances, groups, EnConvo URL |
| `~/.enconvo_cli/agents.json` | Agent team roster |
| `~/.enconvo_cli/workspace/` | Default workspace (IDENTITY.md, SOUL.md, AGENTS.md) |
| `~/.enconvo_cli/workspace-{id}/` | Per-agent workspace override |
| `~/.enconvo_cli/backups/` | Preference backups from `agents sync` |

### EnConvo Paths (read-only reference)

| Path | Purpose |
|---|---|
| `~/.config/enconvo/installed_commands/` | Command registry (1,100+ commands) |
| `~/.config/enconvo/installed_preferences/` | User preferences (writable by sync) |
| `http://localhost:54535` | EnConvo local API server |

---

## Global Config Schema (`config.json`)

```json
{
  "version": 2,
  "enconvo": {
    "url": "http://localhost:54535",
    "timeoutMs": 120000,
    "agents": [
      {
        "id": "mavis",
        "name": "Mavis",
        "path": "chat_with_ai/chat",
        "description": "Default AI assistant"
      }
    ],
    "defaultAgent": "mavis"
  },
  "channels": {
    "<channel_type>": {
      "instances": {
        "<instance_name>": {
          "enabled": true,
          "token": "<bot_token>",
          "agent": "<agent_path>",
          "allowedUserIds": [],
          "service": {
            "plistLabel": "com.enconvo.<channel>-<instance>",
            "logPath": "~/Library/Logs/enconvo-<channel>-<instance>.log",
            "errorLogPath": "~/Library/Logs/enconvo-<channel>-<instance>-error.log"
          }
        }
      },
      "groups": {
        "<group_name>": {
          "chatId": "<chat_or_channel_id>",
          "name": "<human_label>"
        }
      }
    }
  }
}
```

### Field Reference

| Field | Type | Description |
|---|---|---|
| `version` | `number` | Config schema version (current: 2) |
| `enconvo.url` | `string` | EnConvo API base URL |
| `enconvo.timeoutMs` | `number` | Request timeout in milliseconds |
| `enconvo.agents` | `AgentConfig[]` | Known agents |
| `enconvo.defaultAgent` | `string` | Default agent ID |
| `channels` | `Record<string, ChannelWithInstances>` | Channel configurations |
| `instance.enabled` | `boolean` | Whether instance is active |
| `instance.token` | `string` | Bot authentication token |
| `instance.agent` | `string` | EnConvo agent path (e.g., `chat_with_ai/chat`) |
| `instance.allowedUserIds` | `(number\|string)[]` | Access control; empty = allow all |
| `instance.service` | `object` | macOS launchd service metadata |
| `group.chatId` | `string` | Telegram chat ID or Discord channel snowflake |
| `group.name` | `string` | Human-readable label |

### Notes

- **allowedUserIds**: Telegram uses numeric IDs (`number`), Discord uses snowflake strings (`string`). Empty array means no restriction.
- **agent path**: Maps directly to EnConvo API route — `chat_with_ai/chat` → `POST http://localhost:54535/command/call/chat_with_ai/chat`
- **Auto-migration**: v1 flat configs (`channels.telegram.token`) are auto-migrated to v2 instances format on load.
- **groups** key is optional per channel. Only present if named groups have been added.

---

## Agent Roster Schema (`agents.json`)

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

### Agent Fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `name` | `string` | Display name |
| `role` | `string` | Role title |
| `specialty` | `string` | Area of expertise |
| `agentPath` | `string` | EnConvo agent path |
| `telegramBot` | `string` | Telegram bot @handle |
| `instanceName` | `string` | Bound channel instance name |
| `emoji` | `string` | Emoji identifier for display |
| `isLead` | `boolean` | Whether this agent is the team lead |

---

## Workspace Files

### Structure

```
~/.enconvo_cli/workspace/
  IDENTITY.md    — Who the agent is, role, personality
  SOUL.md        — Core values, communication style
  AGENTS.md      — Team roster, inter-agent protocols
```

These are read by `agents sync` to generate system prompts that are written into EnConvo preference files at `~/.config/enconvo/installed_preferences/`.

### Template Variables

Prompts support Jinja2-style template variables:
- `{{ now }}` — Current timestamp
- `{{input_text}}` — User's message
- `{{responseLanguage}}` — Language setting

---

## EnConvo API Reference

### Base URL
```
http://localhost:54535
```

### Health Check
```bash
curl http://localhost:54535/health
```

### Call an Agent
```bash
curl -X POST http://localhost:54535/command/call/{category}/{command} \
  -H 'Content-Type: application/json' \
  -d '{"input_text": "Hello", "sessionId": "my-session-123"}'
```

### Response Formats

**Messages format:**
```json
{
  "type": "messages",
  "messages": [
    { "role": "assistant", "content": "Hello! How can I help?" }
  ]
}
```

**Result format:**
```json
{
  "result": "Hello! How can I help?"
}
```

### Agent Path Examples

| Agent | Path | API Route |
|---|---|---|
| Mavis (default) | `chat_with_ai/chat` | `/command/call/chat_with_ai/chat` |
| Elena | `custom_bot/YJBEY3qHhFslKkMd6WIT` | `/command/call/custom_bot/YJBEY3qHhFslKkMd6WIT` |
| Vivienne | `custom_bot/BVxrKvityKoIpdJjS4p7` | `/command/call/custom_bot/BVxrKvityKoIpdJjS4p7` |
| Timothy | `custom_bot/pOPhKXnP1CmNjCSQZ1mK` | `/command/call/custom_bot/pOPhKXnP1CmNjCSQZ1mK` |

### Session ID Convention

Sessions are scoped by channel + chat + instance:
```
{channel}-{chatId}-{instanceName}
```
Examples:
- `telegram-123456789-mavis`
- `discord-987654321012345678-elena-discord`

Pass `--reset` to `channels send` to generate a fresh session ID with a random suffix.
