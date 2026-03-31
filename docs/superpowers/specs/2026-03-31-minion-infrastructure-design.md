# Minion Infrastructure for PencaViva

**Date:** 2026-03-31
**Status:** Draft
**Approach:** Fork + Extend (casmer-mobile's Minion Runner v4, adapted for PencaViva's nanostack workflow)

## Overview

A multi-agent shell orchestration system that automates PencaViva's development workflow. Accepts a TAREAS.md task ID (e.g., `F2-03`), creates a branch, plans the implementation, executes with TDD and per-subtask commits, validates, reviews, security-checks, and produces a push-ready branch.

Forked from casmer-mobile's proven Minion Runner v4, extended with:
- TAREAS.md integration (task parsing, dependency checking, state management)
- Per-subtask commits (executor commits after each logical unit)
- Code review agent phase
- Security audit agent phase
- PencaViva-specific rules and conventions
- All English (code, prompts, logs, output)

## Directory Structure

```
.minion-blueprints/          # Blueprint definitions
  _template.sh               # Contract documentation (not executed)
  implement.sh               # Plan-based: feature implementation
  fix-issue.sh               # Plan-based: diagnose + fix bugs
  refactor.sh                # Plan-based: safe code refactoring
  add-tests.sh               # Direct: add tests to modules
  migrate.sh                 # Direct: systematic migration
  update-deps.sh             # Direct: dependency updates

.minion-core/                # Core orchestration modules
  helpers.sh                 # Colors, logging, timing, utilities
  cleanup.sh                 # Temp dir + EXIT trap
  config.sh                  # Load .minion.yml via yq
  loader.sh                  # Blueprint validation
  agent.sh                   # claude -p wrapper
  plan-review.sh             # Plan + review iteration loop
  validation.sh              # Lint/typecheck/test + fix loop
  setup.sh                   # Branch creation + npm ci
  tareas.sh                  # TAREAS.md parser + task state management
  review.sh                  # Post-execution code review agent
  security.sh                # Post-execution security audit agent
  result.sh                  # Doc-update commit + banner + metrics

.minion-logs/                # Runtime logs and metrics (gitignored)
.minion-plans/               # Saved plans with metadata (gitignored)
.minion.yml                  # PencaViva-specific configuration
minion.sh                    # Entry point (main orchestrator)
```

## Pipeline: 7 Phases

```
Phase 1: Setup          (deterministic)  — branch creation, npm ci, mark [~]
Phase 2: Plan + Review  (agents)         — planner -> reviewer >=8/10 [plan-based only]
Phase 3: Execute        (agent)          — TDD implementation with per-subtask commits
Phase 4: Validate       (deterministic)  — format -> lint -> typecheck -> test + fix loop
Phase 5: Code Review    (agent)          — structural + adversarial review pass
Phase 6: Security       (agent)          — auth/RLS/data-access audit
Phase 7: Result         (deterministic)  — mark [x], doc-update commit, banner, metrics
```

### Phase 1: Setup

1. Parse task argument: if matches `F{d}-{dd}` format, load from TAREAS.md; otherwise treat as free-form description
2. If task ID: validate dependencies are all `[x]`, extract title/description/effort, derive branch name
3. Fetch latest `develop`, create branch `minion/F2-03-result-notification`
4. Mark task `[~]` in TAREAS.md, commit on the new branch: `chore: mark F2-03 as in-progress`
5. Run `npm ci`

### Phase 2: Plan + Review (plan-based blueprints only)

Identical to casmer's iterative loop, with these adaptations:
- Prompts are in English
- Plan prompt receives TAREAS.md task context (title, description, dependencies, relevant PLAN_MAESTRO.md section)
- Reviewer scores 1-10; minimum 8 to approve
- Up to 3 iterations with feedback refinement
- Stall detection: identical plan/review triggers model escalation
- Approved plan saved to `.minion-plans/{run-id}-plan.md` with metadata headers

### Phase 3: Execute

The executor agent receives:
- The approved plan (plan-based) or task description (direct)
- PencaViva project rules from `.minion.yml`
- Explicit instructions to commit after each logical subtask

Commit instructions embedded in every `execute_prompt()`:
```
After completing each logical subtask:
1. Run: npm run format && npm run lint:fix
2. Stage relevant files: git add <specific files>
3. Commit with Conventional Commits format
4. Continue to the next subtask

Do NOT use git add -A. Stage specific files only.
Do NOT commit .env, credentials, or secret files.
```

### Phase 4: Validate

Forked from casmer's validation loop:
1. Run `npm run format`
2. Run `npm run lint` — capture errors
3. Run `npm run typecheck` — capture errors
4. Run `npm run test:ci` — capture + summarize (Jest error parser)
5. If all pass: `RUN_SUCCESS=true`
6. If failures: fix agent diagnoses + fixes + commits, retry (up to `max_fix_attempts`)
7. Stall detection: identical errors trigger model escalation

Since the executor already committed, validation runs against branch state. Fix agent commits its own fixes: `fix: resolve typecheck errors in prediction-service`.

### Phase 5: Code Review (`review.sh`)

```
run_code_review():
  1. Compute full diff: git diff $base_branch...HEAD
  2. Review agent (read-only: Read,Glob,Grep) evaluates:
     - Correctness: does code fulfill the task requirements?
     - Patterns: does it follow existing project conventions?
     - Edge cases: error handling, empty states, loading states
     - Test coverage: are important paths tested?
  3. Agent outputs: issues list + SCORE: N/10
  4. If score < min_code_review_score (7):
     - Fix agent addresses issues (1 round, commits fixes)
  5. Log review findings to metrics
  6. Non-blocking: low score warns but does not abort
```

### Phase 6: Security (`security.sh`)

```
run_security_check():
  1. Compute full diff: git diff $base_branch...HEAD
  2. Security agent (read-only: Read,Glob,Grep) checks:
     - RLS policy gaps (Supabase queries without proper policies)
     - Exposed secrets or API keys in code
     - SQL injection vectors
     - Missing auth guards on sensitive operations
     - Insecure Supabase client usage (service role key in client code)
     - XSS vectors in user-facing components
  3. Agent outputs: findings list + SEVERITY: none/low/medium/high/critical
  4. If critical: abort run, RUN_SUCCESS=false
  5. If high/medium/low: log warnings, continue
  6. If none: clean pass
```

### Phase 7: Result

1. If `RUN_SUCCESS=true`:
   - Check for uncommitted changes (fallback commit if executor missed any)
   - Mark task `[x]` in TAREAS.md
   - Update any docs affected by the task (CLAUDE.md sections, etc.)
   - Commit: `docs: update TAREAS.md and CLAUDE.md for F2-03`
   - Print success banner with metrics
   - Print: `git push -u origin minion/F2-03-result-notification`
2. If `RUN_SUCCESS=false`:
   - Print failure banner
   - Branch preserved with all commits for manual inspection
   - Print log/metrics paths

## TAREAS.md Integration (`tareas.sh`)

### Functions

- **`parse_task_id()`** — Validates format `F{digit}-{digits}`. Returns phase number and task number. Returns 1 if not a task ID (triggers free-form fallback).
- **`read_task_from_tareas()`** — Parses TAREAS.md using sed/awk. Extracts:
  - `TASK_TITLE`: human-readable title
  - `TASK_DESCRIPTION`: full indented content under the task checkbox
  - `TASK_DEPENDENCIES`: list of prerequisite task IDs
  - `TASK_EFFORT`: effort estimate (e.g., "4h")
  - `TASK_STATUS`: current status (`[ ]`, `[~]`, `[x]`)
- **`check_dependencies()`** — Iterates `TASK_DEPENDENCIES`, verifies each is `[x]` in TAREAS.md. Aborts with error listing incomplete deps.
- **`mark_task_in_progress()`** — sed replaces `- [ ] **F2-03**` with `- [~] **F2-03**` in TAREAS.md. Commits the change.
- **`mark_task_complete()`** — sed replaces `- [~] **F2-03**` with `- [x] **F2-03**` in TAREAS.md.
- **`derive_branch_name()`** — Takes task ID + title, slugifies: `minion/F2-03-result-notification`.
- **`build_task_context()`** — Assembles full context string for agent prompts: task title, description, dependencies, and optionally the relevant PLAN_MAESTRO.md section (searched by task ID reference).

### Free-form Fallback

If the task argument doesn't match `F{d}-{dd}`, all tareas.sh functions are no-ops:
- `TASK_ID=""`, `TASK_TITLE=$TASK`, no dependency check
- Branch name: `minion/{blueprint}-{timestamp}` (casmer default)
- No TAREAS.md state management

## Configuration (`.minion.yml`)

```yaml
project:
  name: "pencaviva"
  description: "Social sports prediction app - React Native + Expo + Supabase"

commands:
  install: "npm ci"
  lint: "npm run lint"
  format: "npm run format"
  typecheck: "npm run typecheck"
  test: "npm run test:ci"

agent:
  max_fix_attempts: 2
  max_plan_iterations: 3
  min_review_score: 8
  max_turns:
    implementation: 75
    plan: 15
    review: 5
    fix: 15
    code_review: 5
    security: 5
  plan_model: "opus"
  plan_effort: "high"
  plan_escalation_model: "opus"
  plan_escalation_effort: "high"
  fix_model: "sonnet"
  fix_effort: "high"
  fix_escalation_model: "opus"
  fix_escalation_effort: "high"
  review_model: "sonnet"
  review_effort: "medium"
  review_escalation_model: "opus"
  review_escalation_effort: "high"
  code_review_model: "sonnet"
  code_review_effort: "medium"
  security_model: "sonnet"
  security_effort: "medium"
  min_code_review_score: 7
  tools:
    default: "Bash,Read,Write,Edit,Glob,Grep"
    plan: "Read,Glob,Grep"
    review: "Read,Glob,Grep"
    fix: "Bash,Read,Write,Edit,Glob,Grep"
    code_review: "Read,Glob,Grep"
    security: "Read,Glob,Grep"

blueprints:
  implement:
    model: "opus"
    effort: "high"
  fix-issue:
    model: "opus"
    effort: "high"
  refactor:
    model: "opus"
    effort: "high"
  add-tests:
    model: "sonnet"
    effort: "high"
  migrate:
    model: "sonnet"
    effort: "medium"
  update-deps:
    model: "sonnet"
    effort: "medium"

context:
  global_rules: |
    - All code, comments, commits, and docs in English
    - TDD mandatory: write failing test first, then implement
    - TypeScript strict mode. No `any`.
    - Follow existing project patterns. Read CLAUDE.md before starting.
    - NativeWind v5 (Tailwind CSS v4) for styling
    - Expo Router v55 for navigation (file-based routing)
    - Supabase for backend (PostgreSQL + RLS + Edge Functions)
    - Zustand for client state, TanStack React Query for server state
    - Commit after each logical subtask using Conventional Commits
    - Path aliases: @/* -> src/*, @components/*, @hooks/*, @lib/*, @stores/*
    - Dark mode first. Primary: #00D4AA, Secondary: #7C5CFC, Accent: #FFB800
  blueprint_rules:
    implement: |
      - Navigation: tab screens in app/(tabs)/, detail screens at app/<feature>/
      - Components organized by feature in src/components/<feature>/
      - Services in src/lib/<feature>-service.ts
      - Hooks in src/hooks/use<Feature>.ts
      - Mock data: verify mock system handles new operations
      - Skeleton loading components for async screens
    fix-issue: |
      - Diagnose root cause, not just symptom
      - If the bug pattern exists elsewhere, mention it
      - Prefer fixing implementation over fixing tests
    refactor: |
      - Each refactoring step must leave code functional
      - Do not change behavior, only structure
      - Maintain existing invariants and contracts
    add-tests: |
      - Use existing mocks in src/__mocks__/
      - Follow pattern: tests in src/__tests__/ subdirectories
      - Jest config in jest.config.js with moduleNameMapper for path aliases
    migrate: |
      - Systematic, consistent changes across all affected files
      - Update imports, types, and references
      - Do not leave files half-migrated
    update-deps: |
      - Prefer stable versions over pre-releases
      - Do NOT update dependencies not requested
      - Verify breaking changes in changelogs

tareas:
  file: "TAREAS.md"
  plan_maestro: "PLAN_MAESTRO.md"

git:
  base_branch: "develop"
  prefix: "minion/"
```

## CLI Interface

```bash
# Task ID mode (reads from TAREAS.md)
./minion.sh implement F2-03
./minion.sh fix-issue F1-07

# Free-form mode (no TAREAS.md integration)
./minion.sh implement "Add confetti animation to save confirmation"
./minion.sh add-tests "src/hooks/useAuth.ts"

# Planning only (dry-run)
./minion.sh --dry-run implement F2-03

# Execute from saved plan
./minion.sh --from-plan .minion-plans/implement-F2-03-plan.md

# Skip review + security phases
./minion.sh --skip-review add-tests "src/lib/scoring-utils.ts"

# Force continue with low plan score
./minion.sh --force implement F2-03

# List blueprints
./minion.sh --list

# Help
./minion.sh --help
```

## Blueprint Prompts (PencaViva-adapted)

All blueprint prompts are in English and include PencaViva-specific context.

### implement.sh (plan-based)

**plan_prompt():**
```
## Task
Create a detailed implementation plan for: ${TASK_TITLE}

## Task Context (from TAREAS.md)
${TASK_DESCRIPTION}

## Dependencies (already implemented)
${TASK_DEPENDENCIES_CONTEXT}

## Instructions
1. Read CLAUDE.md for project conventions
2. Search for similar existing code as pattern reference
3. Identify files to create/modify (exact paths)
4. Plan step by step: tests first (TDD), then implementation
5. Each step should result in a committable unit
6. Identify potential risks or design decisions

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown with exact file paths and concrete names.
Each step should be a logical commit unit.
```

**execute_prompt():**
```
## Task
Implement exactly according to this approved plan:

${PLAN_CONTENT}

## Instructions
1. Follow the plan step by step. Do not deviate.
2. Start with tests (TDD): write failing test, then implement to pass.
3. After completing each logical subtask:
   a. Run: npm run format && npm run lint:fix
   b. Stage relevant files: git add <specific files>
   c. Commit: git commit -m "<type>(<scope>): <description>"
   d. Continue to next subtask
4. Do NOT use git add -A. Stage specific files only.
5. Do NOT commit .env, credentials, or secret files.
6. Ensure all files mentioned in the plan are created/modified.

## Project Rules
${CFG_EFFECTIVE_RULES}
```

### fix-issue.sh (plan-based)

**plan_prompt():**
```
## Task
Diagnose and create a fix plan for: ${TASK_TITLE}

## Task Context
${TASK_DESCRIPTION}

## Instructions
1. Reproduce the issue mentally by analyzing the code
2. Identify root cause (not just the symptom)
3. Propose a concrete fix with files and lines to modify
4. Include tests covering the bug scenario (TDD: failing test first)
5. Identify if other locations share the same pattern

## Project Rules
${CFG_EFFECTIVE_RULES}

## Output Format
Structured markdown:
- Root cause
- Proposed fix (files, concrete changes)
- Tests to add
- Potential regressions
```

### Other blueprints follow the same pattern (English, task context injection, per-subtask commit instructions in execute prompts).

## Modules Forked from Casmer (with adaptations)

| Module | Changes from casmer |
|--------|-------------------|
| helpers.sh | English log messages, English timer labels |
| cleanup.sh | No changes |
| config.sh | New keys: `tareas.*`, `agent.code_review_*`, `agent.security_*`, `agent.min_code_review_score`, `agent.max_turns.code_review`, `agent.max_turns.security` |
| loader.sh | No changes |
| agent.sh | English log messages |
| plan-review.sh | English prompts and log messages |
| validation.sh | English log messages. Fix agent also commits its fixes. |
| setup.sh | Calls `mark_task_in_progress()` before branch creation. English messages. |
| result.sh | No final big commit (executor already committed). Calls `mark_task_complete()`. Commits doc updates. English banners. Fallback commit for uncommitted changes. |

## New Modules

| Module | Purpose |
|--------|---------|
| tareas.sh | TAREAS.md parser: parse_task_id, read_task_from_tareas, check_dependencies, mark_task_in_progress, mark_task_complete, derive_branch_name, build_task_context |
| review.sh | Code review agent: diff-based review, score 1-10, fix if < 7, non-blocking |
| security.sh | Security audit agent: diff-based scan, severity levels, abort on critical |

## Gitignore Additions

```
.minion-logs/
.minion-plans/
```

## Dependencies

- `yq` — YAML parser (must be installed: `brew install yq`)
- `claude` — Claude Code CLI (must be authenticated)
- `gh` — GitHub CLI (for future PR creation in result phase)
- `git` — Git (obviously)
