# Mock Supabase System — Design Spec

## Problem

Developing UI flows that depend on data (groups, matches, predictions) requires a running Supabase instance — either the remote project or a local Docker-based setup. This creates friction for front-end iteration and makes it impossible to develop offline.

## Solution

A flag-controlled mock layer (`EXPO_PUBLIC_USE_MOCKS=true`) that replaces the real Supabase client with an in-memory implementation. Services remain unchanged — the mock client implements the same chaining API (`.from()`, `.select()`, `.rpc()`, `.auth`, `.storage`).

## Architecture

```
src/lib/supabase.ts          # Conditional export: mock or real client
src/lib/mock/
├── index.ts                 # Re-exports createMockClient
├── mock-client.ts           # Mock SupabaseClient with .from(), .rpc(), .auth, .storage
├── mock-store.ts            # In-memory mutable store (tables as Maps)
├── fixtures.ts              # Seed data for all tables
├── mock-auth.ts             # Mock auth (session, onAuthStateChange, signIn, signOut)
└── mock-storage.ts          # Mock storage (upload → fake URL, getPublicUrl → placeholder)
```

### Entry Point

`src/lib/supabase.ts` conditionally exports the mock or real client. The mock flag check must happen **before** any env var validation or `createClient` call — the existing guard that throws on missing `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` and the `AppState.addEventListener` for auto-refresh must both be wrapped in the `else` branch so they only run when using the real client:

```ts
const IS_MOCK = process.env.EXPO_PUBLIC_USE_MOCKS === "true";

let supabase: SupabaseClient;

if (IS_MOCK) {
  supabase = createMockClient();
} else {
  // existing env var validation, createClient, AppState listener
}

export { supabase };
```

`createMockClient()` returns a value typed as `SupabaseClient` (via `as unknown as SupabaseClient` cast) so the conditional export type-checks and all service imports remain compatible.

All services import `supabase` from this file and are unaware of the mock.

### Mock Client

Implements the Supabase client's chaining API by operating on in-memory Maps:

**Query builder chain:** `.from("table")` returns a builder supporting:

- `.select(columns)` — with embedded joins (e.g., `groups(name, ...)`) and embedded count aggregates (e.g., `group_members(count)` returns `[{ count: N }]` by counting matching rows)
- `.eq()`, `.neq()`, `.in()`, `.not(column, operator, value)`, `.gt()`, `.gte()`, `.lt()`, `.lte()` — filters
- `.limit()`, `.order()` — pagination/sorting
- `.single()`, `.maybeSingle()` — row unwrapping
- `.insert()`, `.upsert(data, { onConflict })`, `.update()`, `.delete()` — mutations on the store

**Mutation chaining:** Mutation methods (`.insert()`, `.upsert()`, `.update()`, `.delete()`) can chain `.select()` and `.single()`/`.maybeSingle()` to return affected rows from the store (e.g., `.upsert({...}).select("id").single()`).

**Filter application on mutations:** `.delete()` and `.update()` apply all chained filters (`.eq()`, `.in()`, etc.) to determine which records to affect. Example: `.delete().eq("group_id", id).in("tournament_id", ids)`.

**Upsert conflict resolution:** `.upsert(data, { onConflict: "col1,col2" })` parses the `onConflict` string to perform composite-key lookup. If a matching record exists, it updates; otherwise it inserts.

**RPC dispatch:** `.rpc("fn_name", params)` switches on function name:

- `create_group_for_user` — creates group + group_member in store, returns group
- `lookup_group_by_invite_code` — finds group by invite_code field
- `join_group_by_code` — validates code, creates group_member entry

**Embedded joins:** The mock query builder parses select strings with parenthesized joins (e.g., `groups(name, avatar_url)`) and resolves them via foreign key conventions (`group_id` → `groups.id`). Only the join patterns actually used by existing services need to be supported.

### Mock Store

In-memory Maps seeded from fixtures on initialization:

```ts
type MockStore = {
  profiles: Map<string, Profile>;
  groups: Map<string, Group>;
  group_members: Map<string, GroupMember>;
  group_tournaments: Map<string, GroupTournament>;
  tournaments: Map<string, Tournament>;
  matches: Map<string, Match>;
  predictions: Map<string, Prediction>;
  leaderboard_cache: Map<string, LeaderboardEntry>;
  notifications: Map<string, Notification>;
};
```

- Reads filter/join over Map values converted to arrays
- Writes mutate Maps in place — changes persist for the session, reset on app restart
- Tables with a single `id` column use it as the Map key
- Junction tables with composite keys (`group_members`, `group_tournaments`, `predictions`) use a concatenated key (e.g., `${user_id}:${group_id}`) as the Map key

### Fixtures

Realistic seed data representing a typical user scenario:

- **1 authenticated user** with a complete profile (username, avatar, favorite team)
- **2 groups**: one where the user is `admin`, one where they are `member`
- **3-4 other member profiles** per group (with varied usernames and avatars)
- **1 active tournament** (e.g., "Copa Libertadores 2026") linked to both groups
- **~10 matches** across different states: `scheduled` (future), `live` (in-progress), `finished` (with scores), `postponed`
- **4-5 existing predictions** from the mock user (mix of predicted and not-yet-predicted matches)
- **Leaderboard entries** for groups with finished matches
- All IDs as valid UUIDs, dates as realistic UTC timestamps relative to current time

### Mock Auth

`mock-auth.ts` implements the auth interface:

| Method                                     | Behavior                                                                                                          |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `signInWithIdToken()`                      | Sets mock session, fires `onAuthStateChange` with `SIGNED_IN`. Returns `{ data: { session, user }, error: null }` |
| `signOut()`                                | Clears session, fires `onAuthStateChange` with `SIGNED_OUT`. Returns `{ error: null }`                            |
| `onAuthStateChange(callback)`              | Stores callback, fires on sign-in/sign-out. Returns `{ data: { subscription: { unsubscribe() } } }`               |
| `getUser()`                                | Returns `{ data: { user: mockUser }, error: null }`                                                               |
| `getSession()`                             | Returns `{ data: { session: currentMockSession }, error: null }`                                                  |
| `startAutoRefresh()` / `stopAutoRefresh()` | No-op                                                                                                             |

### Google Auth Mock

`src/lib/google-auth.ts` needs a mock path. Both `configureGoogleSignIn()` and `signInWithGoogle()` must be no-ops in mock mode, since `configureGoogleSignIn()` is called at module level in `app/_layout.tsx` and would crash without the native Google SDK:

- `configureGoogleSignIn()` — no-op (skips `GoogleSignin.configure()`)
- `signInWithGoogle()` — returns a fake ID token string
- `signOutFromGoogle()` — no-op

Each function checks `EXPO_PUBLIC_USE_MOCKS` internally to decide whether to use the real SDK or the mock path.

### Mock Storage

`mock-storage.ts` implements the storage interface:

| Method                               | Behavior                                                         |
| ------------------------------------ | ---------------------------------------------------------------- |
| `from("avatars").upload(path, file)` | No-op, returns `{ data: { path }, error: null }`                 |
| `from("avatars").getPublicUrl(path)` | Returns a placeholder URL (e.g., `https://placehold.co/200x200`) |

## Activation

Set `EXPO_PUBLIC_USE_MOCKS=true` in `.env`. Requires dev server restart to take effect. Default is `false` (real Supabase).

Add to `.env.example`:

```
# Set to 'true' to use mock Supabase client (no network required)
# EXPO_PUBLIC_USE_MOCKS=true
```

## Service Coverage

All existing service functions will work with the mock client without modification:

| Service              | Functions                                                                                                                                                                                          | Mock Support                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `groups-service`     | `fetchUserGroups`, `createGroup`, `fetchGroupById`, `fetchGroupMembers`, `fetchGroupTournaments`, `lookupGroupByInviteCode`, `joinGroupByCode`, `fetchActiveTournaments`, `updateGroupTournaments` | Query builder + RPC dispatch |
| `matches-service`    | `fetchGroupMatches`                                                                                                                                                                                | Query builder with joins     |
| `prediction-service` | `fetchMatchDetail`, `savePrediction`                                                                                                                                                               | Query builder + upsert       |
| `profile-service`    | `checkUsernameAvailable`, `updateProfile`, `checkProfileComplete`, `uploadAvatar`                                                                                                                  | Query builder + mock storage |
| `auth-store`         | `initialize`, `signInWithGoogle`, `signOut`                                                                                                                                                        | Mock auth                    |

## Workflow Integration

Add to CLAUDE.md Task Workflow after step 6 (TDD):

> **6.5 Mock data verification**: If the task adds or modifies a service function or Supabase query, verify that the mock system handles the new operation. Add mock RPC handlers, fixtures, or query builder support as needed. Run the app with `EXPO_PUBLIC_USE_MOCKS=true` to confirm the flow works without Supabase.

## Out of Scope

- **Realtime subscriptions** — not used by client code yet
- **RLS simulation** — mocks return data without permission checks; RLS is tested in SQL integration tests
- **Edge Functions / pg_cron** — server-side concerns, not client-invoked
- **Error simulation** — mock always returns success; error states can be tested by manually modifying mock responses in development
