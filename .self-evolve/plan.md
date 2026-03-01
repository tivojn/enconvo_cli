# Evolution Plan
**Generated:** 2026-03-02
**Status:** active

## Queue (ordered by priority)

### 1. [READY] Add Vitest + unit tests for core services
- **Risk:** low
- **Files:** package.json, vitest.config.ts, src/**/__tests__/
- **Steps:** Install vitest → create test files → write tests → verify
- **Validation:** `npx vitest run`
- **Depends on:** nothing

### 2. [READY] Add ESLint + Prettier
- **Risk:** low
- **Files:** package.json, eslint.config.mjs, .prettierrc
- **Steps:** Install deps → create configs → run fix → commit
- **Validation:** `npx eslint src/`
- **Depends on:** nothing

### 3. [READY] Add .editorconfig
- **Risk:** zero
- **Files:** .editorconfig
- **Depends on:** nothing

### 4. [READY] Add npm scripts for test/lint/build
- **Risk:** zero
- **Files:** package.json
- **Depends on:** #1, #2

### 5. [READY] Update .gitignore
- **Risk:** zero
- **Files:** .gitignore
- **Depends on:** nothing

### 6. [READY] Add GitHub Actions CI
- **Risk:** low
- **Files:** .github/workflows/ci.yml
- **Depends on:** #1, #2

## Completed
(none yet)
