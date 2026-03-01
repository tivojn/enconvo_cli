# enconvo-cli Skill (Claude Code)

This is a **Claude Code skill** for `enconvo_cli`. It teaches Claude Code how to install, configure, operate, and troubleshoot the enconvo_cli tool.

## Installation

Symlink the skill into your Claude Code skills directory:

```bash
ln -s /path/to/enconvo_cli/skill ~/.claude/skills/enconvo-cli
```

Or copy it:

```bash
cp -r /path/to/enconvo_cli/skill ~/.claude/skills/enconvo-cli
```

## What It Does

Once installed, Claude Code can:

- **Install** enconvo_cli from the repo (clone, npm install, verify)
- **Add bots** — register Telegram and Discord bot instances with tokens and agent paths
- **Start/stop** bot instances, check status, view logs
- **Send messages** through bots via CLI (both Telegram and Discord)
- **Manage agent teams** — add, remove, sync prompts, health check
- **Configure** named groups, workspaces, service settings
- **Troubleshoot** common issues (privacy mode, intents, 409 conflicts, empty responses)
- **Answer questions** about the architecture, config schema, and EnConvo API

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Main skill document — full reference with YAML frontmatter |
| `cli-reference.md` | Complete CLI command reference |
| `config-reference.md` | Config schemas, paths, EnConvo API |
| `README.md` | This file |

## Trigger

The skill activates when the user mentions: enconvo_cli, EnConvo channels, deploying bots, Telegram/Discord bot management, agent teams, or channel configuration.
