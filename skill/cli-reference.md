# enconvo_cli — CLI Reference

Complete command reference for `enconvo_cli`. All commands are run via:
```bash
npx tsx src/cli.ts <command> <subcommand> [options]
# or with alias:
enconvo <command> <subcommand> [options]
```

---

## `enconvo channels`

### `channels list`
List all registered channel instances.
```
enconvo channels list [--json]
```
| Flag | Description |
|---|---|
| `--json` | Output as JSON |

### `channels add`
Register a new bot instance.
```
enconvo channels add --channel <type> --name <name> --token <token> --agent <path> [--validate]
```
| Flag | Required | Description |
|---|---|---|
| `--channel <type>` | Yes | Channel type: `telegram` or `discord` |
| `--name <name>` | Yes | Unique instance name (e.g., `mavis`, `elena-discord`) |
| `--token <token>` | Yes | Bot token from BotFather (Telegram) or Developer Portal (Discord) |
| `--agent <path>` | Yes | EnConvo agent path (e.g., `chat_with_ai/chat`) |
| `--validate` | No | Validate token before saving |

### `channels login`
Start a bot instance.
```
enconvo channels login --channel <type> --name <name> -f
```
| Flag | Required | Description |
|---|---|---|
| `--channel <type>` | Yes | Channel type |
| `--name <name>` | Yes | Instance name |
| `-f` | Yes | Run in foreground |

### `channels logout`
Stop a running bot instance.
```
enconvo channels logout --channel <type> --name <name>
```

### `channels status`
Check instance status.
```
enconvo channels status --channel <type> [--name <name>]
```
Omit `--name` to see all instances of that channel type.

### `channels logs`
View instance log output.
```
enconvo channels logs --channel <type> --name <name>
```

### `channels send`
Send a message through a bot and deliver the EnConvo response to a chat.
```
enconvo channels send --channel <type> --name <name> --chat <id> --message <text> [--reset] [--json]
enconvo channels send --channel <type> --name <name> --group <name> --message <text> [--reset] [--json]
```
| Flag | Required | Description |
|---|---|---|
| `--channel <type>` | Yes | Channel type |
| `--name <name>` | Yes | Instance name |
| `--chat <id>` | One of chat/group | Chat or channel ID |
| `--group <name>` | One of chat/group | Named group (resolves to chat ID) |
| `--message <text>` | Yes | Message to send |
| `--reset` | No | Start fresh conversation (new session ID) |
| `--json` | No | Output as JSON |

### `channels remove`
Remove or disable an instance.
```
enconvo channels remove --channel <type> --name <name> [--delete]
```
| Flag | Description |
|---|---|
| `--delete` | Permanently delete from config (default: just disable) |

### `channels resolve`
Look up a user or channel by identifier.
```
enconvo channels resolve --channel <type> --name <name> --identifier <id>
```

### `channels capabilities`
Show what a channel adapter supports.
```
enconvo channels capabilities --channel <type>
```

### `channels groups`
List named groups.
```
enconvo channels groups [--channel <type>]
```

### `channels groups add`
Add a named group mapping.
```
enconvo channels groups add --name <name> --chat-id <id> --label <label>
```
| Flag | Required | Description |
|---|---|---|
| `--name <name>` | Yes | Group name (e.g., `main`, `dev`) |
| `--chat-id <id>` | Yes | Chat/channel ID (Telegram: negative number, Discord: snowflake) |
| `--label <label>` | Yes | Human-readable description |

### `channels groups remove`
Remove a named group.
```
enconvo channels groups remove --name <name>
```

---

## `enconvo agents`

### `agents list`
Show the agent team roster.
```
enconvo agents list [--bindings] [--json]
```
| Flag | Description |
|---|---|
| `--bindings` | Show agent-to-channel instance mappings |
| `--json` | Output as JSON |

### `agents add`
Register a new team member.
```
enconvo agents add --id <id> --name <name> --role <role> \
  --specialty <specialty> --agent-path <path> \
  [--telegram-bot <handle>] [--instance-name <name>] \
  [--emoji <name>] [--lead]
```
| Flag | Required | Description |
|---|---|---|
| `--id <id>` | Yes | Unique agent identifier |
| `--name <name>` | Yes | Display name |
| `--role <role>` | Yes | Role title (e.g., "Team Lead") |
| `--specialty <spec>` | Yes | Area of expertise |
| `--agent-path <path>` | Yes | EnConvo agent path |
| `--telegram-bot <handle>` | No | Telegram bot @username |
| `--instance-name <name>` | No | Channel instance name to bind to |
| `--emoji <name>` | No | Emoji identifier (e.g., `crown`, `pencil`) |
| `--lead` | No | Mark as team lead |

### `agents delete`
Remove an agent from the roster.
```
enconvo agents delete <id> [--force]
```

### `agents set-identity`
Update an agent's identity fields.
```
enconvo agents set-identity <id> --name <name> --role <role>
```

### `agents bindings`
Show agent-to-channel instance mappings.
```
enconvo agents bindings
```

### `agents sync`
Sync workspace prompts to EnConvo preferences. Backs up before writing.
```
enconvo agents sync [--agent <id>] [--dry-run]
```
| Flag | Description |
|---|---|
| `--agent <id>` | Sync only this agent (default: all) |
| `--dry-run` | Preview changes without writing |

### `agents refresh`
Re-read workspace files and update agent configurations.
```
enconvo agents refresh --group <name> [--agent <id>] [--reset] [--silent]
```

### `agents check`
Health check — verify agents are reachable via EnConvo.
```
enconvo agents check [--agent <id>] [--json]
```
