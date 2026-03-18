# F1-16: Match Sync Edge Function — Design Spec

## Summary

Supabase Edge Function (`match-sync`) that fetches football match data from API-Football (RapidAPI) and syncs it into the `matches` table. Three sync modes: daily fixture import, live match polling, and post-match finalization. When a match status changes to `finished`, the existing `process_match_result()` trigger automatically calculates prediction points and refreshes leaderboards.

## Context

- `matches` table exists with `api_match_id` UNIQUE constraint for safe UPSERT
- `tournaments` table has `api_league_id` column for linking to API-Football leagues
- `process_match_result()` trigger fires on `status = 'finished'` (AFTER UPDATE only) — no manual scoring needed
- RLS: matches are read-only for authenticated users; Edge Function uses `service_role`
- No Edge Functions exist yet in the project — this is the first one
- Supabase config already has `edge_runtime.enabled = true` with Deno v2

## API-Football Integration

### Endpoints Used

| Endpoint                                  | Purpose                                | Mode     |
| ----------------------------------------- | -------------------------------------- | -------- |
| `GET /fixtures?league={id}&season={year}` | Fetch all fixtures for a league/season | `daily`  |
| `GET /fixtures?live=all`                  | Fetch all currently live matches       | `live`   |
| `GET /fixtures?id={fixture_id}`           | Fetch a single match by API ID         | `single` |

### Authentication

- Base URL: `https://api-football-v3.p.rapidapi.com`
- Headers: `x-rapidapi-key` (stored as Supabase secret), `x-rapidapi-host: api-football-v3.p.rapidapi.com`

### API-Football Status Mapping

API-Football returns ~15 status codes. We map them to our 5:

| API-Football Status (short)                      | PencaViva Status |
| ------------------------------------------------ | ---------------- |
| `TBD`, `NS`                                      | `scheduled`      |
| `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `INT`, `LIVE` | `live`           |
| `FT`, `AET`, `PEN`                               | `finished`       |
| `PST`, `SUSP`                                    | `postponed`      |
| `CANC`, `ABD`, `AWD`, `WO`                       | `cancelled`      |

**Score validation**: When mapping to `finished`, the mapper validates that `home_score` and `away_score` are non-null. If scores are null despite a finished status (API error), the match remains as `live` until valid scores arrive.

### Rate Limits

- Free tier: 100 requests/day (sufficient for dev with 1-2 leagues, manual invocation only)
- Pro tier: 7,500 requests/day (production — handles automated cron)

**Quota tracking**: The function logs `x-ratelimit-requests-remaining` from API-Football response headers for monitoring.

## Architecture

### Edge Function: `supabase/functions/match-sync/index.ts`

Single function with 3 modes, invoked via HTTP POST with JSON body:

```typescript
// POST /functions/v1/match-sync
{
  "mode": "daily" | "live" | "single",
  "leagueId"?: number,    // Optional for "daily" (omit to sync all active tournaments)
  "season"?: string,       // Optional for "daily" (omit to use tournament.season)
  "fixtureId"?: number    // Required for "single" mode
}
```

### Internal Modules

```
supabase/functions/match-sync/
├── index.ts              # Entry point: parse mode, dispatch handler
├── api-football.ts       # API-Football HTTP client + types
├── mapper.ts             # Map API response → matches table row
└── sync.ts               # Tournament lookup + UPSERT logic
```

### Data Flow

```
[Cron / Manual trigger]
    |
    | POST /functions/v1/match-sync { mode }
    v
[index.ts] → validate params → dispatch to handler
    |
    v
[sync.ts] → load tournament map (api_league_id → tournament_id)
    |
    v
[api-football.ts] → fetch from API-Football
    |
    v
[mapper.ts] → map API response → PencaViva match format (with tournament_id)
    |
    v
[sync.ts] → UPSERT into matches table (by api_match_id)
    |
    | If status changed to 'finished' (UPDATE path only):
    v
[DB trigger: process_match_result()] → automatic
    |
    v
[calculate_prediction_points()] → update predictions.points
    |
    v
[refresh_leaderboard_cache()] → update rankings
```

## Tournament ID Resolution

The `matches` table has `tournament_id UUID NOT NULL`. API-Football returns `league.id` (integer). The function must resolve this mapping.

### Resolution Strategy

On startup of each invocation, `sync.ts` loads a tournament map:

```typescript
// Query: SELECT id, api_league_id, season FROM tournaments WHERE status = 'active'
// Result: Map<number, { tournamentId: string; season: string }>
const tournamentMap = await loadActiveTournaments(supabase);
```

This map is used in all three modes:

- **Daily mode (no params)**: Iterate all entries in `tournamentMap`, calling API-Football for each `(api_league_id, season)` pair
- **Daily mode (with params)**: Use only the specified `leagueId`/`season`, validate it exists in `tournamentMap`
- **Live mode**: Filter API-Football response — only process matches whose `league.id` exists in `tournamentMap`
- **Single mode**: Look up the match's league from the API response, resolve via `tournamentMap`

Matches whose `league.id` is not in the map are silently skipped (not our tournaments).

## Sync Modes

### 1. Daily Fixtures Sync (`mode: "daily"`)

- Called once every 24h (via cron) — syncs all active tournaments automatically
- When `leagueId`/`season` are omitted: queries `tournaments` table for all active tournaments and iterates each one
- When `leagueId`/`season` are provided: syncs only that specific league
- Fetches all fixtures for each league/season from API-Football
- UPSERTs into `matches` table using `api_match_id` as the conflict key
- Creates new matches for upcoming fixtures, updates existing ones

### 2. Live Match Polling (`mode: "live"`)

- Called every 2 minutes (via cron, Pro tier only) or manually
- Fetches `GET /fixtures?live=all` — returns all currently in-progress matches globally
- Filters response: only process matches whose league exists in our active tournaments
- Updates `status` to `live` and live scores (`home_score`, `away_score`)
- No params needed

### 3. Single Match Finalization (`mode: "single"`)

- Called to force-refresh a specific match (e.g., manual admin action)
- Fetches `GET /fixtures?id={fixtureId}`
- Updates the match with final score and `status = 'finished'`
- Triggers the scoring pipeline automatically (via UPDATE trigger)

## UPSERT Strategy

Use Supabase client's `upsert` with `onConflict: 'api_match_id'`:

```typescript
const { error } = await supabase
  .from("matches")
  .upsert(matchRows, { onConflict: "api_match_id" });
```

This safely handles:

- **New matches**: INSERT with all fields
- **Updated matches**: UPDATE scores, status, venue changes
- **Idempotent**: Running twice produces the same result

### Known Limitation: INSERT of Already-Finished Matches

The `process_match_result()` trigger is `AFTER UPDATE` only. If a match is inserted for the first time with `status = 'finished'` (e.g., historical backfill), the trigger does NOT fire and predictions are not scored. This is acceptable for MVP since the normal flow is: daily sync inserts `scheduled` matches → live/daily sync updates them to `finished`. Historical backfill would require a separate manual scoring step if ever needed.

## Cron Scheduling

Use Supabase's `pg_cron` + `pg_net` extensions to schedule automatic invocations.

### Migration: Enable Extensions + Create Cron Jobs

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily sync: iterate all active tournaments (runs at 04:00 UTC)
SELECT cron.schedule(
  'match-sync-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "daily"}'::jsonb
  );
  $$
);

-- Live polling: every 2 minutes (Pro tier only — disable for free tier dev)
SELECT cron.schedule(
  'match-sync-live',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "live"}'::jsonb
  );
  $$
);
```

**Configuration note**: Supabase hosted projects automatically set `app.settings.supabase_url` and `app.settings.service_role_key` via Vault. For local dev with `supabase start`, these are available in the CLI output and must be configured if testing cron locally. Manual `curl` invocation is recommended for local development instead of cron.

## Tournament Seeding

A migration seeds initial tournaments with `api_league_id` values.

```sql
INSERT INTO tournaments (name, short_name, sport, country, season, api_league_id, status, start_date, end_date)
VALUES
  ('Liga Profesional Uruguay', 'LPU', 'football', 'Uruguay', '2026', 307, 'active', '2026-02-01', '2026-12-15'),
  ('Copa Libertadores', 'Libertadores', 'football', 'South America', '2026', 13, 'active', '2026-02-01', '2026-11-30'),
  ('Copa Sudamericana', 'Sudamericana', 'football', 'South America', '2026', 11, 'active', '2026-02-01', '2026-11-30')
ON CONFLICT DO NOTHING;
```

**Pre-implementation checklist**: Verify league IDs against API-Football's `GET /leagues` endpoint before writing the seed migration. The IDs above are placeholders from PLAN_MAESTRO.md.

## Error Handling

- **API errors**: Log error, return partial results. Don't fail the whole batch.
- **Rate limits**: If API returns 429, log and stop processing. Return what was completed.
- **Individual match errors**: Skip the match, log the error, continue with remaining matches.
- **DB errors**: Log and include in response. Partial success is acceptable.
- **Unknown leagues**: Matches from leagues not in our DB are silently skipped.

### Response Format

```typescript
interface SyncResponse {
  mode: "daily" | "live" | "single";
  tournaments_synced: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ api_match_id: number; error: string }>;
  api_quota_remaining: number | null;
  duration_ms: number;
}
```

## Security

- Edge Function authenticates via `Authorization: Bearer <service_role_key>` header
- API-Football key stored as Supabase secret: `supabase secrets set API_FOOTBALL_KEY=<key>`
- Access the secret in Deno: `Deno.env.get('API_FOOTBALL_KEY')`
- The function validates the `Authorization` header to prevent unauthorized invocations

## Environment Variables

Add to `.env.example`:

```
# API-Football (RapidAPI)
API_FOOTBALL_KEY=your_rapidapi_key_here
```

## Testing Strategy

### Unit Tests (Deno test runner)

- `mapper.test.ts`: Test status mapping (all 15+ API statuses → 5 PencaViva statuses)
- `mapper.test.ts`: Test field mapping (API fixture → matches table row)
- `mapper.test.ts`: Edge cases (null scores with finished status → stays as `live`, missing venue, future matches)
- `mapper.test.ts`: Tournament ID resolution (known league → resolved, unknown league → skipped)

### Integration Tests (against local Supabase)

- Verify UPSERT creates new matches
- Verify UPSERT updates existing matches (by api_match_id)
- Verify `process_match_result()` trigger fires on status change to `finished`
- Verify scoring pipeline end-to-end: match finishes → predictions scored → leaderboard updated

### Manual Testing

- Use Supabase CLI: `supabase functions serve match-sync` for local dev
- Call with curl: `curl -X POST http://localhost:54321/functions/v1/match-sync -H "Authorization: Bearer <key>" -d '{"mode":"daily","leagueId":307,"season":"2026"}'`

## Files Changed

| File                                             | Change                          |
| ------------------------------------------------ | ------------------------------- |
| `supabase/functions/match-sync/index.ts`         | New: entry point                |
| `supabase/functions/match-sync/api-football.ts`  | New: API client + types         |
| `supabase/functions/match-sync/mapper.ts`        | New: data mapper                |
| `supabase/functions/match-sync/sync.ts`          | New: tournament lookup + UPSERT |
| `supabase/functions/match-sync/mapper.test.ts`   | New: mapper unit tests          |
| `supabase/migrations/00011_seed_tournaments.sql` | New: seed initial tournaments   |
| `supabase/migrations/00012_match_sync_cron.sql`  | New: pg_cron + pg_net setup     |
| `.env.example`                                   | Add `API_FOOTBALL_KEY`          |
| `CLAUDE.md`                                      | Document Edge Function patterns |
| `TAREAS.md`                                      | Mark F1-16 complete             |

## Dependencies

- **API-Football API key** — needed for production. Dev can use free tier (100 req/day) or mock responses
- **pg_cron + pg_net extensions** — available on Supabase hosted, need to enable via migration
- **No npm packages** — Edge Functions run in Deno, use standard `fetch` API

## Out of Scope

- Push notifications when matches finish (F2-03)
- Client-side match display (F1-17)
- Historical data backfill (would need separate scoring step)
- Multiple sports support
- Smart cron scheduling (Option B — defer to post-MVP)
