# enconvo_cli

CLI tool for managing [EnConvo AI](https://enconvo.com) channels, agents, and services. Deploy EnConvo agents as dedicated Telegram bots — one bot per agent — and compose them into team groups.

**Stack:** TypeScript, Commander.js, Grammy, tsx

## Quick Start

```bash
npm install

# Add a bot instance
enconvo channels add --channel telegram --name mavis \
  --token <TELEGRAM_BOT_TOKEN> \
  --agent chat_with_ai/chat \
  --validate

# Start it
enconvo channels login --channel telegram --name mavis -f
```

## Prerequisites

- **macOS** with Node.js (Homebrew or nvm)
- **EnConvo** running locally (listens on `http://localhost:54535`)
- **Telegram bot token(s)** — see [Telegram Bot Setup](#telegram-bot-setup) below

---

## Telegram Bot Setup

### Step 1: Create a Bot via BotFather

1. Open Telegram, search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a display name (e.g., `EnConvo Mavis`)
4. Choose a username (must end in `bot`, e.g., `EnConvo_Mavis_bot`)
5. BotFather gives you an **API token** like `1234567890:AAF...`. Save it — you'll need it for `--token`.

### Step 2: Configure Bot Settings in BotFather

**These settings are per-bot.** Repeat for each bot you create.

#### Disable Group Privacy (Required for Group Chats)

By default, Telegram bots have **privacy mode enabled** — they only receive:
- Commands targeted to them (`/command@BotUsername`)
- Replies to their own messages

They do **NOT** receive regular text messages or `@mentions` in groups. To fix this:

1. Open BotFather
2. Send `/setprivacy`
3. Select your bot
4. Choose **Disable**

> **Important:** After disabling privacy, you must **remove and re-add** the bot to any existing groups. Telegram caches the privacy setting per group membership.

#### Optional: Set Bot Description

```
/setdescription → Select bot → Enter description
/setabouttext → Select bot → Enter about text
/setuserpic → Select bot → Send photo
```

#### Optional: Set Bot Commands (Menu)

```
/setcommands → Select bot → Enter:
reset - Start a fresh conversation
status - Check connection status
help - Show help message
```

### Step 3: Register with enconvo_cli

```bash
# Add the bot instance
enconvo channels add --channel telegram --name mavis \
  --token "1234567890:AAF..." \
  --agent chat_with_ai/chat \
  --validate

# Start in foreground
enconvo channels login --channel telegram --name mavis -f
```

The `--validate` flag checks the token against Telegram's API before saving.

### Step 4: Add to a Group (Optional)

1. Create a Telegram group (or use an existing one)
2. Add each bot as a member
3. Make sure each bot has **privacy mode disabled** (Step 2 above)
4. Bots will only respond when:
   - **@mentioned:** `@EnConvo_Mavis_bot what's the weather?`
   - **Replied to:** reply to a bot's message to continue
   - **Commanded:** `/reset@EnConvo_Mavis_bot`

> **Tip:** In groups with multiple bots, always target commands: `/reset@BotUsername` instead of bare `/reset`. Telegram only delivers untagged commands to one bot.

---

## Group Chat Behavior

Each bot in a group maintains its own conversation context — they don't share sessions or interfere with each other.

| Action | What Happens |
|---|---|
| `@BotName message` | Only that bot responds |
| Reply to a bot's message | Only that bot responds |
| `/reset@BotName` | Resets only that bot's session |
| Bare `/reset` | Only one bot receives it (Telegram picks one) |
| Regular text (no @mention) | No bot responds (mention-gating) |

### How Mention-Gating Works

The bot uses middleware that filters group messages:
- **Private chats:** Always respond
- **Groups:** Only respond to @mentions, replies to the bot, or targeted commands
- Non-matching messages are silently ignored — no "I can't help" noise

---

## CLI Commands

```bash
# List all channels and instances
enconvo channels list

# Add a bot instance (one bot per agent)
enconvo channels add --channel telegram --name <name> \
  --token <token> --agent <agent_path> [--validate]

# Start/stop instances
enconvo channels login --channel telegram --name <name> -f
enconvo channels logout --channel telegram --name <name>

# Monitor
enconvo channels status --channel telegram [--name <name>]
enconvo channels logs --channel telegram --name <name>

# Remove
enconvo channels remove --channel telegram --name <name>

# Resolve a Telegram user/group
enconvo channels resolve --channel telegram --name <name> --identifier <id>

# Channel capabilities
enconvo channels capabilities --channel telegram
```

All commands support `--json` for machine-readable output.

---

## Multi-Instance Architecture

Each bot is a **dedicated instance** pinned to one EnConvo agent. No `/agent` switching — each bot knows exactly which agent it serves.

```
enconvo channels add --channel telegram --name mavis    --agent chat_with_ai/chat --token <t1>
enconvo channels add --channel telegram --name elena    --agent custom_bot/YJBEY3qHhFslKkMd6WIT --token <t2>
enconvo channels add --channel telegram --name vivienne --agent custom_bot/BVxrKvityKoIpdJjS4p7 --token <t3>
```

Config stored at `~/.enconvo_cli/config.json`:

```json
{
  "channels": {
    "telegram": {
      "instances": {
        "mavis": {
          "enabled": true,
          "token": "...",
          "agent": "chat_with_ai/chat"
        }
      }
    }
  }
}
```

---

## Development

```bash
# Legacy single-bot mode (uses .env + config.json)
cp .env.example .env   # Set BOT_TOKEN
npm run dev

# CLI mode
npm run cli -- channels list
npx tsx src/cli.ts channels list
```

---

## Troubleshooting

### Bot doesn't respond to @mentions in groups

1. Check privacy mode is **disabled** in BotFather (`/setprivacy` → Disable)
2. **Remove and re-add** the bot to the group (Telegram caches privacy per membership)
3. Verify with `/help@BotUsername` — if the bot responds to commands but not mentions, privacy is still on

### 409 Conflict error

Another process is polling with the same bot token. Kill the old process:
```bash
# Find processes using the token
ps aux | grep telegram
kill <PID>
```

### Bot responds but EnConvo returns empty

Make sure EnConvo is running on `http://localhost:54535`:
```bash
curl http://localhost:54535/health
```

### Commands work but only one bot responds to bare `/reset`

In groups, Telegram delivers untagged commands to only one bot. Use targeted syntax: `/reset@BotUsername`

---

## License

ISC
