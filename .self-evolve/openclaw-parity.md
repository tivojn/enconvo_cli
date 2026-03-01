# OpenClaw CLI Parity Mapping

## Status: Research Complete, Implementation Pending

## OpenClaw Command Domains (25+ domains, 142+ subcommands)

### Already Implemented in enconvo_cli
| OpenClaw Command | enconvo_cli Equivalent | Status |
|---|---|---|
| `channels add` | `enconvo channels add` | partial (no --account) |
| `channels remove` | `enconvo channels remove` | partial |
| `channels login` | `enconvo channels login` | done |
| `channels logout` | `enconvo channels logout` | done |
| `channels list` | `enconvo channels list` | done |
| `channels status` | `enconvo channels status` | done |
| `channels send` | `enconvo channels send` | done |
| `agents list` | `enconvo agents list` | done |
| `agents add` | `enconvo agents add` | done |
| `agents delete` | `enconvo agents delete` | done |
| `agents set-identity` | `enconvo agents set-identity` | done |
| `agents bindings` | `enconvo agents bindings` | done |
| `agents sync` (custom) | `enconvo agents sync` | done |

### Priority 1: Core Missing (High Impact)
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `config get/set/unset` | Config management by dot-path | medium |
| `configure` | Setup wizard (interactive) | medium |
| `status` (top-level) | Unified health + sessions | low |
| `agents bind/unbind` | Routing bindings (agent→channel→account) | medium |
| `message send` | Direct message sending | low (have `channels send`) |
| `message read` | Read recent messages | medium |

### Priority 2: Gateway & Infrastructure
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `gateway run/start/stop/status` | WebSocket server lifecycle | high (EnConvo is the gateway) |
| `doctor` | Health checks + quick fixes | medium |
| `health` | Gateway health probe | low |
| `logs` | Tail gateway logs | medium |

### Priority 3: Advanced Features
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `plugins list/enable/disable/install` | Extension management | high |
| `cron add/rm/list/enable/disable` | Scheduled jobs | high |
| `hooks list/enable/disable` | Internal agent hooks | high |
| `memory search/index/status` | Vector search | high |
| `browser *` | 40+ Playwright subcommands | very high |
| `nodes *` | Paired device management | very high |
| `security audit` | Config + state audit | medium |
| `sandbox list/recreate/explain` | Container isolation | high |

### Priority 4: Messaging Extensions
| OpenClaw Command | Purpose | Complexity |
|---|---|---|
| `message broadcast` | Multi-target broadcast | medium |
| `message search` | Search messages | medium |
| `message react/pin/unpin` | Reactions, pins | low |
| `message poll` | Send polls | medium |
| `message thread *` | Thread management | medium |
| `message ban/kick/timeout` | Moderation | medium |

### Not Applicable (EnConvo-specific differences)
- `pairing/devices` — EnConvo handles device management
- `dns` — Not relevant for EnConvo
- `acp` — EnConvo has its own protocol
- `secrets` — Different credential model
- `nodes` — EnConvo is a local macOS app, no remote nodes

## Key Architectural Differences

### OpenClaw vs EnConvo CLI
| Aspect | OpenClaw | enconvo_cli |
|---|---|---|
| Agent runtime | Self-hosted (Claude API) | EnConvo macOS app (local API) |
| Config format | `openclaw.json` | `~/.enconvo_cli/config.json` |
| Channels | Direct bot management | Maps to EnConvo agents |
| Bindings | agentId→channel→accountId | instanceName→agentPath |
| Sessions | Built-in session store | EnConvo manages sessions |
| Gateway | WebSocket server (port 18789) | HTTP API (port 54535) |

### Migration Strategy
1. **Phase 1**: Add `config get/set/unset` + `configure` wizard
2. **Phase 2**: Add `agents bind/unbind` with OpenClaw-style routing
3. **Phase 3**: Add `message` command group (send/read/broadcast)
4. **Phase 4**: Add `doctor`, `health`, `status` top-level commands
5. **Phase 5**: Add `cron` scheduling (using EnConvo's native scheduling if available)
6. **Phase 6+**: Advanced features as needed
