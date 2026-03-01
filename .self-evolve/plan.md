# Evolution Plan
**Generated:** 2026-03-02
**Status:** active

## Queue (ordered by priority)

### 7. [READY] OpenClaw parity: config get/set/unset
- **Status:** DONE (Round 5)

### 8. [READY] OpenClaw parity: agents bind/unbind
- **Status:** DONE (Round 6)

### 9. [READY] OpenClaw parity: message send
- **Status:** DONE (Round 6)

### 10. [READY] Add more OpenClaw commands (health, sessions, cron)
- **Risk:** medium
- **Depends on:** nothing

### 11. [READY] Improve test coverage to 60%+
- **Risk:** low
- **Depends on:** nothing

### 12. [READY] Add ESLint + Prettier
- **Risk:** low
- **Files:** package.json, eslint.config.mjs, .prettierrc
- **Steps:** Install deps → create configs → run fix → commit
- **Validation:** `npx eslint src/`
- **Depends on:** nothing

## Completed
1. Add Vitest + unit tests (Round 3) — 50 tests
2. Add .editorconfig (Round 3)
3. Update .gitignore (Round 3)
4. Add npm scripts for test/typecheck (Round 3)
5. Add GitHub Actions CI (Round 4) — blocked by token scope
6. Refactor message-splitter (Round 4) — shared utility
7. Add config get/set/unset/path (Round 5)
8. Add status + doctor commands (Round 5)
9. Add agents bind/unbind (Round 6)
10. Add message send command (Round 6)
