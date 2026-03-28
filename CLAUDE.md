# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

**All project content must be in English.** This includes: code, comments, commit messages, PR descriptions, documentation files (CLAUDE.md, TAREAS.md, PLAN_MAESTRO.md), variable/function names, SQL migrations, test descriptions, and any new files. No Spanish or other languages.

## Project Overview

**PencaViva** is a social sports prediction app for friends in Uruguay (expandable to Latin America). Users create private groups, predict match scores, and compete on real-time leaderboards. This is NOT a gambling app — it's a social sports network centered on predictions.

The project has an initialized Expo skeleton with CI/CD infrastructure, a complete database schema (9 tables + RLS + triggers), and an automatic profile creation trigger on signup. Architecture, database schema, task breakdown, and technical decisions are documented in `PLAN_MAESTRO.md` and `TAREAS.md`.

## Tech Stack

| Layer          | Technology                  | Version                                        |
| -------------- | --------------------------- | ---------------------------------------------- |
| Framework      | React Native + Expo         | SDK 55 (expo@55.0.4, RN 0.83.2, React 19.2.0)  |
| Navigation     | Expo Router                 | v55 (file-based + deep linking)                |
| Styling        | NativeWind + Tailwind CSS   | v5 (preview) + v4.2.1                          |
| Auth (Google)  | @react-native-google-signin | v16.1.2 (native sign-in, Expo config plugin)   |
| State (client) | Zustand                     | v5 (+ use-sync-external-store peer dep)        |
| State (server) | TanStack React Query        | v5                                             |
| Animations     | React Native Reanimated     | v4.2.x (+ react-native-worklets)               |
| Backend        | Supabase                    | PostgreSQL 15+, Auth, Realtime, Edge Functions |
| Sports Data    | API-Football (RapidAPI)     | Pro plan for production                        |
| Push           | Expo Push Service           | Free, integrated                               |
| Monitoring     | Sentry                      | Free tier                                      |
| Language       | TypeScript                  | 5.9.x (strict mode)                            |
| Node.js        | >= 20.19.x                  | Required by Expo SDK 55                        |

## Commands

```bash
# Dev
npm start                          # Expo dev server
npm run android                    # Android emulator
npm run ios                        # iOS simulator
EXPO_PUBLIC_USE_MOCKS=true npm start  # Dev server with mock data (no Supabase required)

# Quality
npm run lint                       # ESLint
npm run lint:fix                   # ESLint with auto-fix
npm run format:check               # Prettier check (used in pre-commit hook)
npm run format                     # Prettier write
npm run typecheck                  # tsc --noEmit

# Test
npm test                           # Jest (unit + supabase)
npm run test:ci                    # Jest with coverage + CI flags (unit only)
npm run test:unit                  # Unit tests only
npm run test:supabase              # Supabase SQL integration tests (requires SUPABASE_DB_URL)
npm run test:supabase:local        # Same, but auto-sets local DB URL (127.0.0.1:54322)

# Supabase local dev (requires Docker)
npm run supabase:start             # Start local Supabase (Postgres + Auth only)
npm run supabase:stop              # Stop local Supabase

# Build & Deploy
eas build --profile development    # Dev client build
eas build --profile staging        # Internal staging build
eas build --profile production     # Store build
eas update --channel development   # OTA to dev
eas update --channel production    # OTA to prod
```

## Project Structure

```
app/                    # Expo Router file-based routing
├── index.tsx           # Root redirect (gates on onboarding completion)
├── (auth)/             # Auth group (welcome, login, complete-profile)
├── (tabs)/             # 5-tab main app
│   ├── index.tsx       # Home tab
│   ├── predict.tsx     # Predict tab
│   ├── ranking.tsx     # Ranking tab
│   ├── groups/         # Groups tab root (index only — join/create/detail moved to app/groups/)
│   └── profile.tsx     # Profile tab
├── match/[id].tsx      # Match detail with prediction steppers
├── groups/             # Group detail, create, join screens (no tab bar)
├── player-stats/[userId].tsx  # Player stats detail (no tab bar, from ranking)
└── _layout.tsx         # Root layout

src/
├── __mocks__/          # Jest mocks (expo-router, expo-secure-store, reanimated, css, etc.)
├── __tests__/          # Unit tests (lib/, navigation/, onboarding/)
├── components/         # Feature-organized components
│   ├── common/         # EmptyState
│   ├── ErrorState.tsx   # Reusable inline error display (icon + title + message + retry)
│   ├── ErrorBoundary.tsx # Global error boundary (class component, wraps root Stack)
│   ├── Toast.tsx        # ToastProvider + useToast hook + animated banner (success/error/info)
│   ├── onboarding/     # OnboardingPageView, PageIndicator
│   ├── groups/         # ScoringPresetCard, GroupCard, MemberRow
│   ├── predictions/    # MatchCard, PredictionBadge, GroupSelector, DateSectionHeader, ScoreStepper, SaveConfirmation, GroupPredictions, PredictionRow
│   ├── ranking/        # LeaderboardRow (with Reanimated glow + position indicators), PlayerStatsHeader, StatsGrid, StreakDisplay, PredictionHistoryRow
│   └── skeletons/      # Skeleton loading components: SkeletonMatchCard, SkeletonLeaderboardRow, SkeletonGroupCard, SkeletonMemberRow, SkeletonPredictionHistoryRow + useSkeletonAnimation hook
├── hooks/              # Custom hooks (useAuthInit, useAuth, useDebounce, useGroupDetail, useActiveGroup, useGroupMatches, useMatchDetail, useCountdown, useGroupPredictions, useGroupLeaderboard(groupId, filter?), usePlayerStats(userId, groupId), useUserGroups)
├── lib/                # Supabase client, secure-store adapter, google-auth, constants (+ APP_BASE_URL + success/danger colors), onboarding data, groups-service, matches-service, prediction-service, profile-service, scoring-utils, leaderboard-service (LeaderboardFilter, fetchGroupLeaderboardByDateRange, fetchGroupLeaderboardFiltered), player-stats-service (PlayerPredictionRecord, computeStreaks, fetchPlayerGroupStats), retry (withRetry, isTransientError)
│   ├── mock/              # Mock Supabase client (activated by EXPO_PUBLIC_USE_MOCKS=true)
│   │   ├── index.ts       # Re-exports createMockClient
│   │   ├── mock-client.ts # Mock SupabaseClient assembly + RPC handlers
│   │   ├── mock-query-builder.ts  # Chaining query builder over in-memory Maps
│   │   ├── mock-store.ts  # In-memory Maps for all 9 tables
│   │   ├── mock-auth.ts   # Mock auth (session, signIn, signOut)
│   │   ├── mock-storage.ts # Mock storage (upload no-op, placeholder URLs)
│   │   └── fixtures.ts    # Seed data (profiles, groups, matches, predictions, etc.)
├── stores/             # Zustand stores (auth-store, group-store)
└── types/              # Type declarations (expo-vector-icons.d.ts)
# Planned (not yet created):
# └── utils/            # Scoring, dates, validation helpers

supabase/
├── config.toml         # Supabase CLI config (local dev, PG 15)
├── migrations/         # SQL migrations (00001-00006: schema, RLS, functions/triggers)
└── __tests__/          # SQL integration tests (db-functions/, rls/, triggers/)
├── functions/          # Edge Functions (Deno v2 runtime)
89i│   └── match-sync/    # API-Football → matches table sync (daily/live/single modes)
# Planned: functions/calculate-scores, send-notification
```

**Path aliases** (configured in `tsconfig.json`, mirrored in Jest `moduleNameMapper`):

- `@/*` → `src/*`, `@components/*`, `@hooks/*`, `@lib/*`, `@stores/*`, `@types/*`, `@utils/*`

## Supabase Project

| Property   | Value                                               |
| ---------- | --------------------------------------------------- |
| Project ID | `jkxxiwhjitilgysjkkul`                              |
| Region     | sa-east-1 (São Paulo)                               |
| URL        | `https://jkxxiwhjitilgysjkkul.supabase.co`          |
| API Key    | Publishable key (`sb_publishable_...`)              |
| Dashboard  | supabase.com/dashboard/project/jkxxiwhjitilgysjkkul |

- **Uses new publishable key** (`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) instead of legacy anon JWT — better security, independent rotation
- Client configured in `src/lib/supabase.ts` with `expo-secure-store` (chunked storage for iOS 2048-byte Keychain limit)
- **Profile auto-creation**: See Database Schema section for `handle_new_user()` trigger details
- **Google Sign-In** configured (F1-02): native `@react-native-google-signin/google-signin` → `supabase.auth.signInWithIdToken()`. Apple Sign-In deferred to F1-03
- Env vars in `.env` (gitignored); template in `.env.example`
- SQL integration tests use `pg` direct connection with transaction rollback isolation. Test helper `createTestUser()` relies on the profile trigger (passes displayName via `raw_user_meta_data`)
- **Local dev**: `supabase start` (requires Docker) spins up local Postgres + Auth on port 54322. Migrations auto-applied. CI uses local DB via `supabase/setup-cli@v1` GitHub Action
- **Supabase CLI**: `supabase@2.76.15` pinned as devDependency. Config in `supabase/config.toml`

## Authentication

- **Google Sign-In flow**: Native Google dialog → ID token → `supabase.auth.signInWithIdToken({ provider: "google", token })` → session created → `handle_new_user()` trigger auto-creates profile
- **Auth state**: Zustand store (`src/stores/auth-store.ts`) with `onAuthStateChange` listener. Single source of truth for session, user, loading, error
- **Hooks**: `useAuthInit()` in root layout (initializes listener once), `useAuth()` anywhere (returns reactive auth state + actions)
- **Navigation gating**: `app/index.tsx` four-way redirect: not onboarded → welcome, not authenticated → login, profile incomplete → complete-profile, ready → tabs. Returns null until onboarding check, auth init, and profile check complete (prevents flash). Profile check is fail-open (network errors allow through to avoid blocking users)
- **Profile completion**: `app/(auth)/complete-profile.tsx` — username form with debounced uniqueness validation, Google avatar display (letter fallback), optional favorite team. Uses `useDebounce` hook (500ms) and `profile-service.ts` for validation/queries. Race condition guard via `isDebounceSettled`. Navigates to tabs on save via `router.replace()`
- **Config**: `configureGoogleSignIn()` called at module level in `app/_layout.tsx`. Requires `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` env vars
- **Expo plugin**: `@react-native-google-signin/google-signin` in `app.config.ts` with dynamic `iosUrlScheme` (reversed iOS client ID)

## Edge Functions

- **Runtime**: Supabase Edge Functions run on Deno v2 (not Node.js). Use `npm:` specifiers for npm packages (e.g., `import { createClient } from "npm:@supabase/supabase-js@2"`) and `jsr:` for Deno standard library
- **Auth pattern**: Edge Functions that modify data use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS). Validate the `Authorization` header matches the service role key to prevent unauthorized access
- **Local dev**: `supabase functions serve match-sync` starts the function with hot reload. Test with `curl -X POST http://localhost:54321/functions/v1/match-sync -H "Authorization: Bearer <service_role_key>" -H "Content-Type: application/json" -d '{"mode":"daily"}'`
- **Testing**: Mapper/pure-logic modules use Deno's built-in test runner (`deno test`). Integration tests hit local Supabase
- **Secrets**: Store API keys via `supabase secrets set KEY=value`. Access in code via `Deno.env.get('KEY')`. Default secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) are auto-injected
- **Cron**: `pg_cron` + `pg_net` extensions schedule periodic Edge Function calls. Jobs defined in SQL migrations. Only works on Supabase hosted — local dev uses manual curl
- **Linting/TypeScript**: Edge Function files under `supabase/functions/` are excluded from the project's ESLint config (`.eslintrc.js` ignorePatterns) and TypeScript config (`tsconfig.json` exclude) because they use Deno module resolution (`npm:`, `jsr:`, `.ts` extensions)

### match-sync Function

First Edge Function in the project. Syncs match data from API-Football into the `matches` table.

- **Modes**: `daily` (all active tournaments), `live` (in-progress matches), `single` (one fixture by ID)
- **Tournament resolution**: Maps `api_league_id` (integer from API-Football) → `tournament_id` (UUID) via `tournaments` table
- **UPSERT**: Uses `api_match_id` as conflict key for idempotent writes
- **Trigger pipeline**: When a match transitions to `finished`, DB trigger `process_match_result()` → `calculate_prediction_points()` → `refresh_leaderboard_cache()`
- **Files**: `supabase/functions/match-sync/{index,api-football,mapper,sync}.ts`

## Architecture Decisions

- **Expo (not bare RN)**: EAS Update enables OTA fixes during live tournaments — critical for scoring bug corrections
- **Supabase (not Firebase)**: Pencas are inherently relational (users-groups-tournaments-matches-predictions). SQL JOINs make leaderboard calculations trivial. RLS enforces security at the DB layer
- **No custom backend**: Supabase client SDK + RLS for data access; Edge Functions (Deno) only for server-side logic (cron syncs, score calculation, push notifications)
- **Zustand (not Redux)**: Minimal global state (auth, active group); server state managed by React Query
- **NativeWind v5**: Uses Tailwind CSS v4 (not v3). Metro config: `withNativewind(config)` with no second argument
- **Navigation pattern**: The 5-tab bar is the app's home base. Tab root screens live in `app/(tabs)/<name>.tsx` (tab bar visible). All other screens (detail, action, form) live at root level in `app/<feature>/<name>.tsx` (no tab bar, back arrow returns to previous screen). Example: `app/groups/join.tsx`, `app/groups/create.tsx`, `app/groups/[id].tsx`, `app/groups/manage-tournaments.tsx`, `app/match/[id].tsx`. This rule applies to all tabs and all future features.
- **Focus refetch pattern**: Group detail screen uses `useFocusEffect` from `@react-navigation/native` with a `hasMountedRef` guard to refetch data when returning from sub-screens (e.g., manage-tournaments). Skips the first render to avoid double-fetching.
- **Error handling**: Two-layer error boundaries (global `GlobalErrorBoundary` class component + Expo Router `ErrorBoundary` export on tabs layout). Toast notifications via custom Reanimated banner (`ToastProvider` + `useToast` hook, no external lib). `withRetry` utility with exponential backoff (2 retries, 1s/2s delay) for all data-fetching hooks. Standardized `ErrorState` component replaces inline error UIs across all screens.

## Database Schema

9 tables: `profiles`, `tournaments`, `matches`, `groups`, `group_members`, `group_tournaments`, `predictions`, `leaderboard_cache`, `notifications`

Key constraints:

- `predictions` has `UNIQUE(user_id, match_id, group_id)` — one prediction per match per group
- RLS blocks predictions after kickoff (server-side enforcement)
- `handle_new_user()` trigger on `auth.users` auto-creates a `profiles` row on signup (SECURITY DEFINER). Display name from `raw_user_meta_data.full_name` → `.name` → email prefix. Username: `user_<12hex from UUID>`
- `process_match_result()` trigger auto-calculates points when match status changes to `finished`
- `leaderboard_cache` is a materialized ranking refreshed by triggers

6 migrations applied (00001–00006): tables/indexes, functions/triggers, RLS policies, search_path hardening, RLS recursion fix, profile auto-creation trigger.

Scoring system (configurable per group via JSONB):

- Exact score: 5 pts
- Correct result (win/draw/lose): 3 pts
- Correct goal difference bonus: 1 pt
- Wrong: 0 pts

## Compatibility Notes

- **Reanimated v4 requires New Architecture** (enabled by default in Expo SDK 55) and `react-native-worklets` as peer dependency
- **Zustand v5 requires React 18+** and `use-sync-external-store` as peer dependency
- **NativeWind v5 is preview** — functional but not stable
- **`@date-fns/tz` replaces `date-fns-tz`** — uses `TZDate` class instead of old `utcToZonedTime`
- All times stored as UTC in the database; converted to local on the client with `@date-fns/tz`
- **New Architecture is default in SDK 55** — `newArchEnabled` config option removed from ExpoConfig

## Development Methodology

### Git Flow

- **Branches**: `main` (prod), `develop` (integration), `feature/*`, `release/*`, `hotfix/*`
- **Commits**: Conventional Commits enforced by commitlint + Husky pre-commit hooks
- **Versioning**: semantic-release on `main` only (no pre-releases on develop)

### Task Workflow

1. **Brainstorm & plan**: Use the `superpowers:brainstorming` skill (with `/model opus` — Claude Opus) to explore intent, requirements, and design. Then use the native `/plan` command (also with `/model opus`) to produce and refine the implementation plan. Switch back to the default model (Sonnet) for execution via the native `/plan` execute flow
2. **Check dependencies**: Verify that all task dependencies listed in `TAREAS.md` are completed (`[x]`) before starting. Do not proceed if any dependency is incomplete
3. Create branch `feature/F0-XX-description` from `develop`
4. Mark task as `[~]` in `TAREAS.md`
5. **UI Design with Stitch** — **MANDATORY for any task that adds or significantly modifies user-facing screens, components, or layouts. Skip only for trivial changes (e.g., fixing a typo in a label, adjusting a single padding value) where the visual impact is negligible.**
   - **Skill pipeline**: Use `/stitch-design` as the unified entry point. It orchestrates: `/enhance-prompt` (adds UI/UX keywords, atmosphere, and design system context to your prompt) → Stitch MCP generation → `/design-md` (syncs design system into `.stitch/DESIGN.md`)
   - **Stitch project**: All mockups go in the `PencaViva` Stitch project (project ID: `13390158725206896883`). Always use `MOBILE` device type
   - **Prompt enhancement**: Before generating any screen, run `/enhance-prompt` to transform vague UI ideas into polished, Stitch-optimized prompts. Never send raw/vague prompts directly to Stitch
   - **Autonomous iteration**: After generating, **always** fetch the screenshot and visually inspect. Iterate with `edit_screens` or `generate_variants` until the design is polished. Do not accept the first generation without review. **This is an autonomous process** — do not ask the user for feedback on each iteration. Use your own judgment to evaluate quality and iterate until the design meets the app's design standards (dark theme, color palette, spacing, hierarchy). Only present the final result to the user for approval
   - **Not the visual companion**: Stitch MCP design is separate from the brainstorming skill's "visual companion" (HTML browser). Declining the visual companion during brainstorming does NOT mean skipping Stitch. Stitch is mandatory for UI tasks regardless of visual companion preference
   - **Design system sync**: After finalizing screens, run `/design-md` to keep `.stitch/DESIGN.md` up to date with the latest design tokens, patterns, and component inventory
   - **Implementation from Stitch**: The finalized Stitch design is the **source of truth** for the UI. Implementation must faithfully reproduce the approved mockup — layout, spacing, colors, typography hierarchy, and component structure. Use `/react-components` to convert Stitch designs into modular React components with AST-based validation when applicable. The design is NOT decorative — it drives the code
   - **Scope**: New screens, screen redesigns, new components, layout changes, empty/error/loading states. Code must match the approved Stitch mockup
6. **UX Writing check**: Evaluate whether the task involves user-facing text (buttons, labels, error messages, empty states, onboarding copy, notifications, tooltips, confirmation dialogs, etc.). If it does, delegate all microcopy work to `/ux-writing` skill for professional, consistent interface text
7. Develop with TDD (`superpowers:test-driven-development` skill — RED-GREEN-REFACTOR in vertical slices)
8. **Mock data verification**: If the task adds or modifies a service function or Supabase query, verify that the mock system handles the new operation. Add mock RPC handlers, fixtures, or query builder support as needed
9. **Manual app verification**: Run `EXPO_PUBLIC_USE_MOCKS=true npm start` and visually confirm all new/modified flows work end-to-end in the mock environment before proceeding
10. Each completed subtask or logical unit → commit with Conventional Commits. Before each commit, run the pre-commit CI checks:
    ```bash
    npm run format:check
    npm run lint
    npm run typecheck
    npm run test:ci
    ```
    Fix any failures before committing (use `npm run format` / `npm run lint:fix` for auto-fixable issues)
11. **Pre-PR document updates** (BEFORE push + PR creation):
    - Update **every** file or document affected by the task — not just code. This includes but is not limited to: `TAREAS.md`, `CLAUDE.md`, `PLAN_MAESTRO.md`, `.env.example`, `README.md`, type definitions, config files, and any other docs that reference changed behavior.
    - Commit doc updates as part of the final commit or as a separate `docs:` commit
12. **Verification pass**: Run the `superpowers:verification-before-completion` skill to confirm all work is correct and complete before declaring the task done
13. **Code quality pass**: Run the `simplify` skill on all changed code to review for reuse, quality, and efficiency. Then run the `superpowers:requesting-code-review` skill on the full changeset to verify correctness and adherence to the plan
14. Push and create PR to `develop`, wait for green CI
15. Merge (squash) the PR

### Task tracking

- Update `TAREAS.md` when starting (`[~]`), completing (`[x]`), or canceling (`[-]`) tasks
- Do not start a task if its dependencies (listed under each task) are not completed
- Follow the recommended execution order in `TAREAS.md` (bottom of file)

## Key Files

- `PLAN_MAESTRO.md` — Complete technical architecture, database schema (SQL), RLS policies, module designs, UX/UI specs, color palette, roadmap, and risk assessment
- `TAREAS.md` — Task breakdown with IDs (F0-01 through F7-06), effort estimates, dependencies, and execution order

## Design Specs

- **Dark mode first** (default theme)
- Primary: `#00D4AA` (emerald green), Secondary: `#7C5CFC` (electric violet), Accent: `#FFB800` (gold)
- Dark background: `#0D0D0D`, Surface: `#1A1A2E`
- One-thumb navigation, haptic feedback on key actions, 60fps animations via Reanimated

## Gotchas

- **Jest config**: Use `jest.config.js` (not `.ts`) — `.ts` requires `ts-node` as extra dependency
- **Husky v9**: Requires `.git/` to exist before `npx husky` — run `git init` first
- **Expo SDK**: Project on SDK 55 (expo@55.0.4). PLAN_MAESTRO.md and package.json are aligned
- **GitHub repo**: Public repo (branch protection requires Pro for private repos)
- **CI job names**: Branch protection references exact names `"Lint & Format"`, `"Type Check"`, `"Unit Tests"` — do not rename CI jobs without updating branch protection rules
