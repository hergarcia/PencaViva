# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PencaViva** is a social sports prediction app for friends in Uruguay (expandable to Latin America). Users create private groups, predict match scores, and compete on real-time leaderboards. This is NOT a gambling app — it's a social sports network centered on predictions.

The project has an initialized Expo skeleton with CI/CD infrastructure. Architecture, database schema, task breakdown, and technical decisions are documented in `PLAN_MAESTRO.md` and `TAREAS.md`.

## Tech Stack

| Layer          | Technology                | Version                                        |
| -------------- | ------------------------- | ---------------------------------------------- |
| Framework      | React Native + Expo       | SDK 55 (RN 0.83, React 19.2)                   |
| Navigation     | Expo Router               | v4 (file-based + deep linking)                 |
| Styling        | NativeWind + Tailwind CSS | v5 (preview) + v4                              |
| State (client) | Zustand                   | v5                                             |
| State (server) | TanStack React Query      | v5                                             |
| Animations     | React Native Reanimated   | v4                                             |
| Backend        | Supabase                  | PostgreSQL 15+, Auth, Realtime, Edge Functions |
| Sports Data    | API-Football (RapidAPI)   | Pro plan for production                        |
| Push           | Expo Push Service         | Free, integrated                               |
| Monitoring     | Sentry                    | Free tier                                      |
| Language       | TypeScript                | 5.x (strict mode)                              |
| Node.js        | >= 20.19.x                | Required by Expo SDK 55                        |

## Commands

```bash
# Dev
npm start                          # Expo dev server
npm run android                    # Android emulator
npm run ios                        # iOS simulator

# Quality
npm run lint                       # ESLint
npm run format:check               # Prettier check (used in pre-commit hook)
npm run format                     # Prettier write
npm run typecheck                  # tsc --noEmit

# Test
npm test                           # Jest
npm run test:ci                    # Jest with coverage + CI flags

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
├── (auth)/             # Auth group (welcome, login, complete-profile)
├── (tabs)/             # 5-tab main app (Home, Predict, Ranking, Groups, Profile)
│   └── groups/         # Nested group routes ([id], create, join)
├── match/[id].tsx      # Dynamic match detail
└── _layout.tsx         # Root layout

src/
├── components/         # Feature-organized (ui/, match/, ranking/, group/)
├── hooks/              # Custom hooks (useAuth, usePredictions, useLeaderboard, etc.)
├── lib/                # Supabase client, query client, constants
├── stores/             # Zustand stores (authStore, appStore)
├── types/              # Generated DB types + app types
└── utils/              # Scoring, dates, validation helpers

supabase/
├── migrations/         # SQL migrations (schema, RLS, functions/triggers)
└── functions/          # Edge Functions (match-sync, calculate-scores, send-notification)
```

## Architecture Decisions

- **Expo (not bare RN)**: EAS Update enables OTA fixes during live tournaments — critical for scoring bug corrections
- **Supabase (not Firebase)**: Pencas are inherently relational (users-groups-tournaments-matches-predictions). SQL JOINs make leaderboard calculations trivial. RLS enforces security at the DB layer
- **No custom backend**: Supabase client SDK + RLS for data access; Edge Functions (Deno) only for server-side logic (cron syncs, score calculation, push notifications)
- **Zustand (not Redux)**: Minimal global state (auth, active group); server state managed by React Query
- **NativeWind v5**: Uses Tailwind CSS v4 (not v3). Metro config: `withNativewind(config)` with no second argument

## Database Schema

9 tables: `profiles`, `tournaments`, `matches`, `groups`, `group_members`, `group_tournaments`, `predictions`, `leaderboard_cache`, `notifications`

Key constraints:

- `predictions` has `UNIQUE(user_id, match_id, group_id)` — one prediction per match per group
- RLS blocks predictions after kickoff (server-side enforcement)
- `process_match_result()` trigger auto-calculates points when match status changes to `finished`
- `leaderboard_cache` is a materialized ranking refreshed by triggers

Scoring system (configurable per group via JSONB):

- Exact score: 5 pts
- Correct result (win/draw/lose): 3 pts
- Correct goal difference bonus: 1 pt
- Wrong: 0 pts

## Compatibility Notes

- **Reanimated v4 requires New Architecture** (enabled by default in Expo SDK 55)
- **Zustand v5 requires React 18+** and `use-sync-external-store` as peer dependency
- **NativeWind v5 is preview** — functional but not stable
- **`@date-fns/tz` replaces `date-fns-tz`** — uses `TZDate` class instead of old `utcToZonedTime`
- All times stored as UTC in the database; converted to local on the client with `@date-fns/tz`

## Development Methodology

### Git Flow

- **Branches**: `main` (prod), `develop` (integration), `feature/*`, `release/*`, `hotfix/*`
- **Commits**: Conventional Commits enforced by commitlint + Husky pre-commit hooks
- **Versioning**: semantic-release on `main` only (no pre-releases on develop)

### Workflow por tarea

1. Ejecutar `/planner` para la tarea (explorar, planificar, revisar antes de escribir codigo)
2. Crear branch `feature/F0-XX-descripcion` desde `develop`
3. Marcar tarea como `[~]` en `TAREAS.md`
4. Desarrollar con TDD (`/tdd` skill — RED-GREEN-REFACTOR en vertical slices)
5. Cada subtarea o unidad logica completada → commit con Conventional Commits
6. Al terminar la tarea → marcar como `[x]` en `TAREAS.md`, commit final, push
7. Crear PR hacia `develop` y esperar CI verde
8. Merge (squash) del PR

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
- **Expo SDK**: PLAN_MAESTRO.md references SDK 55 but `package.json` uses ~53.0.0 (latest stable). Update when SDK 55 is released
- **GitHub repo**: Public repo (branch protection requires Pro for private repos)
- **CI job names**: Branch protection references exact names `"Lint & Format"`, `"Type Check"`, `"Unit Tests"` — do not rename CI jobs without updating branch protection rules
