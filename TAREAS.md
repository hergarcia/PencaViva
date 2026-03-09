# Tasks - PencaViva

> Task tracking file for Claude Code.
> Update this file whenever a task is completed, started, or modified.
>
> **Methodology**: Mandatory TDD (skill `/tdd`) - RED-GREEN-REFACTOR in vertical slices.

## Legend

- `[ ]` Pending
- `[~]` In progress
- `[x]` Completed
- `[-]` Canceled / Not applicable

---

## Phase 0: Project Setup (Week 1)

> **Status**: COMPLETED
> **Estimate**: ~17h

### Infrastructure

- [x] **F0-01** Initialize Expo SDK 55 project with TypeScript
  - Criteria: Project running in simulator
  - Effort: 2h
  - Notes: Upgraded from SDK 53 to SDK 55 (RN 0.83.2, React 19.2.0, Reanimated 4.2.x, TS 5.9.x). tsconfig strict mode + path aliases (@/\*, @components/\*, etc.). New Architecture is default in SDK 55 (newArchEnabled removed from ExpoConfig). react-native-worklets required as peer dep for Reanimated v4.

- [x] **F0-02** Configure Supabase (project + auth providers)
  - Criteria: Supabase project created, Google and Apple auth configured
  - Effort: 2h
  - Notes: Supabase project created (sa-east-1, project ID jkxxiwhjitilgysjkkul). Using new publishable key (sb*publishable*) instead of legacy anon JWT. @supabase/supabase-js v2.97.0 + expo-secure-store v55.0.8. Client singleton with secure token storage (chunked for iOS 2048-byte Keychain limit). AppState auto-refresh. 15 tests. Google/Apple auth provider config deferred to F1-02/F1-03 (requires external credentials).

- [x] **F0-03** Configure ESLint + Prettier
  - Criteria: Automatic linting working
  - Effort: 1h
  - Notes: ESLint 8 + @typescript-eslint + prettier plugin. Husky v9 pre-commit hook runs format:check + lint.

- [x] **F0-04** Create folder structure (feature-based)
  - Criteria: Structure `app/`, `src/components/`, `src/hooks/`, `src/lib/`, etc.
  - Effort: 1h
  - Notes: Base structure created. Folders will be populated in subsequent phases.

- [x] **F0-05** Configure NativeWind v5 + Tailwind CSS v4
  - Criteria: Tailwind styles working in RN components
  - Notes: metro.config.js with `withNativewind()` (no second argument in v5). NativeWind v5.0.0-preview.2 + Tailwind CSS v4.2.1. postcss.config.mjs required. nativewind-env.d.ts for TypeScript types. global.css imported in app/\_layout.tsx. Requires react-native-css@3.0.3 which needs @expo/metro-config >= 54 (resolved with SDK 55).
  - Effort: 2h

- [x] **F0-06** Navigation setup (Expo Router v4)
  - Criteria: Basic tab navigation with 5 tabs (Home, Predict, Ranking, Groups, Profile)
  - Effort: 3h
  - Notes: Expo Router v5.1.11 (SDK 53). Ionicons for tab icons (outline/filled). (tabs) with 5 tabs + groups/ nested Stack. (auth) with Stack (welcome, login, complete-profile). match/[id] dynamic route. app/index.tsx with Redirect to /(tabs). SafeAreaView on all screens. Jest mocks for expo-router and @expo/vector-icons. Path aliases in jest.config.js. Type declaration for @expo/vector-icons.

- [x] **F0-07** Create DB schema (SQL migrations)
  - Criteria: All tables created with active RLS policies
  - Tables: profiles, tournaments, matches, groups, group_members, group_tournaments, predictions, leaderboard_cache, notifications
  - Effort: 4h
  - Notes: 4 migrations applied via Supabase MCP: (1) 9 tables + 8 indexes (including partial unique for NULL tournament_id, idx_group_members_user for RLS performance), (2) 4 functions (calculate_prediction_points IMMUTABLE, refresh_leaderboard_cache SECURITY DEFINER, process_match_result SECURITY DEFINER, update_updated_at_column) + 6 triggers, (3) 19 RLS policies across all 9 tables, (4) fix migration for search_path hardening + (select auth.uid()) initplan optimization. Added INSERT policies for profiles and groups (not in PLAN_MAESTRO.md but necessary). Added group membership check on predictions INSERT. All functions use SET search_path = public. Zero security advisor warnings.

- [x] **F0-08** Configure EAS Build + EAS Update
  - Criteria: Working development build
  - Effort: 2h
  - Notes: eas.json with 3 profiles (development, staging, production). CD workflows configured for EAS Update per channel.

- [x] **F0-11** Configure CI/CD and GitHub repo
  - Criteria: GitHub Actions CI/CD working, branch protection, environments
  - Effort: 4h
  - Notes: CI (4 parallel jobs: lint, typecheck, test, expo doctor). CD (develop, staging, production). semantic-release on main. Dependabot configured. Branch protection on main and develop. Environments: development, staging, production (prod with manual approval). commitlint + Conventional Commits.

### Testing Setup (TDD)

- [x] **F0-09** Configure testing framework (Jest + React Native Testing Library)
  - Criteria: A dummy test passes with `npm test`
  - Effort: 2h
  - Notes: jest-expo preset. Use jest.config.js (not .ts, avoids ts-node dependency).

- [x] **F0-10** Configure SQL/Supabase function testing
  - Criteria: Tests can execute queries against Supabase (local or test project)
  - Effort: 2h
  - Notes: Jest multi-project config (unit + supabase). `pg` for direct Postgres connections. `ts-jest` for Node test env. Transaction rollback pattern (BEGIN/ROLLBACK) for test isolation. Auth context simulation via SET LOCAL role + request.jwt.claims for RLS testing. Graceful skip (describe.skip) when SUPABASE_DB_URL not set. Test files in supabase/**tests**/ (db-functions/, rls/, triggers/). 18 integration tests: calculate_prediction_points (9 cases), predictions RLS (7 cases), updated_at trigger (2 cases). Scripts: test:unit, test:supabase. CI runs unit only (test:ci). Bug fix: migration 005 added SECURITY DEFINER functions (get_user_group_ids, get_user_admin_group_ids) to resolve infinite recursion in group_members RLS policies.

- [x] **F0-12** Migrate Supabase tests to local environment (supabase start)
  - Criteria: `supabase start` spins up local DB with Docker, tests run against localhost instead of remote DB
  - Depends: F0-10 (SQL testing)
  - Effort: 3h
  - Notes: Supabase CLI initialized (`supabase/config.toml`, PG 15). `supabase@2.76.15` as devDependency. CI job "Supabase Tests" uses `supabase/setup-cli@v1` + `supabase start` to run all 18 integration tests against local Docker DB. Convenience scripts: `supabase:start` (excludes unnecessary services), `supabase:stop`, `test:supabase:local`. No test code changes needed — existing `SUPABASE_DB_URL` env var works for both remote and local. `.supabase/` added to `.gitignore`. Backward compatible: remote DB still works, graceful skip when DB unavailable.

---

## Phase 1: MVP Core (Weeks 2-5)

> **Status**: IN PROGRESS
> **Estimate**: ~111h

### Milestone 1: Auth + Profile (Week 2)

- [x] **F1-01** Welcome/Onboarding screen
  - 3 screens with introductory animations
  - Depends: F0-06 (navigation)
  - Effort: 4h
  - Notes: 3-page horizontal ScrollView with pagingEnabled. OnboardingPageView with Reanimated v4 entrance animations (icon scale/opacity, text translateY/opacity). PageIndicator dots (no animation, YAGNI). Onboarding data in src/lib/onboarding.ts (typed OnboardingPage array). Root index.tsx gates on SecureStore.getItem (synchronous) — redirects to welcome if not completed. "Skip" and "Get Started" persist completion via SecureStore.setItem and router.replace to login. Ionicons for page icons (100px, colored by design tokens). expo-router mock updated to return stable singleton from useRouter(). Reanimated v4 Jest mock created. 50 unit tests passing.

- [x] **F1-02** Implement Google Sign-In
  - Login with Google via Supabase Auth
  - Depends: F0-02 (Supabase)
  - Effort: 4h
  - Notes: Native Google Sign-In via `@react-native-google-signin/google-signin` v16.1.2 + `supabase.auth.signInWithIdToken()`. No browser redirect — native UI on both platforms. Zustand v5 auth store (`src/stores/auth-store.ts`) with `onAuthStateChange` listener as single source of truth. `useAuthInit()` hook in root layout, `useAuth()` hook for components. Root `app/index.tsx` now gates on both onboarding completion AND auth state (three-way redirect: welcome → login → tabs). Login screen with Google button, loading state, error display with dismiss. Expo config plugin with dynamic `iosUrlScheme` computed from env var. Jest mock for scoped package + 14 new tests (81 total). Fixed Spanish placeholder text in login.tsx and complete-profile.tsx to English.

- [ ] **F1-03** Implement Apple Sign-In
  - Login with Apple via Supabase Auth (required by App Store)
  - Depends: F0-02 (Supabase)
  - Effort: 4h

- [x] **F1-04** Complete profile screen (username, avatar)
  - Real-time username uniqueness validation
  - Avatar upload (or use generated default)
  - Favorite team selection (optional)
  - Depends: F1-02 or F1-03 (working auth)
  - Effort: 6h
  - Notes: Full profile form at app/(auth)/complete-profile.tsx. Username validation: local format check (3-20 chars, alphanumeric + underscores) on every keystroke + debounced (500ms) availability check via Supabase. Google avatar display with letter-initial fallback (upload deferred to F1-06). Display name pre-filled from Google metadata (full_name → name → email prefix). Optional favorite team as free-text input. Race condition guard: canSave requires isDebounceSettled + isAvailable + !isCheckingAvailability. Unique constraint error detection in save handler. Navigation gating: app/index.tsx upgraded from 3-way to 4-way redirect (onboarding → login → complete-profile → tabs) with fail-open on profile check errors. useDebounce hook in src/hooks/use-debounce.ts. 26 new tests (4 hook, 15 screen, 7 navigation).

- [x] **F1-05** Automatic profile creation trigger
  - Database trigger: on user creation in auth.users -> insert into profiles
  - Depends: F0-07 (DB schema)
  - Effort: 2h
  - Notes: Migration 00006 creates `handle_new_user()` (SECURITY DEFINER, SET search*path = public) + trigger `on_auth_user_created` (AFTER INSERT ON auth.users). display_name extracted from raw_user_meta_data (full_name -> name -> email prefix -> 'User'). Deterministic username: `user*<12 hex chars of UUID>` (collision-free). 8 integration tests. Helper createTestUser() updated to pass displayName via raw_user_meta_data and let the trigger create the profile automatically.

- [~] **F1-06** Profile screen (view/edit)
  - View stats, edit display_name, avatar, bio, favorite team
  - Depends: F1-04 (complete profile)
  - Effort: 4h

- [ ] **F1-07** Biometric authentication (Face ID / Fingerprint)
  - expo-local-authentication for quick re-authentication
  - Biometric prompt on app open (if enabled)
  - Fallback to manual login
  - Depends: F1-02/F1-03 (auth), expo-secure-store
  - Effort: 4h

- [ ] **F1-08** Biometrics settings configuration
  - Enable/disable toggle
  - Grace period selector (1min, 5min, 15min, always)
  - Depends: F1-07 (biometrics)
  - Effort: 2h

### Milestone 2: Groups (Week 3)

- [ ] **F1-09** "My Groups" screen (list)
  - List of user's groups with avatar, name, member count
  - Depends: F1-02/F1-03 (auth)
  - Effort: 4h

- [ ] **F1-10** Create group (form + scoring setup)
  - Name, description, tournament selection, scoring system (presets or custom)
  - Member limit (default 50)
  - Depends: F0-07 (DB)
  - Effort: 6h

- [ ] **F1-11** Generate invite code + QR
  - Unique 8-character code
  - QR generated in-app
  - Share via social media
  - Depends: F1-10 (create group)
  - Effort: 3h

- [ ] **F1-12** Join group (by code)
  - 8-character code input
  - Validation that group exists and has space
  - Depends: F0-07 (DB)
  - Effort: 4h

- [ ] **F1-13** Deep link for invitations
  - `pencaviva://join/ABC12345` or universal link
  - Depends: F0-06 (Expo Router)
  - Effort: 3h

- [ ] **F1-14** Group detail (members, info)
  - Member list with roles
  - Group info, assigned tournaments
  - Depends: F1-09 (group list)
  - Effort: 4h

- [ ] **F1-15** Assign tournaments to group
  - Multi-select of available tournaments
  - Depends: F0-07 (DB with tournaments table)
  - Effort: 3h

### Milestone 3: Predictions (Week 4)

- [ ] **F1-16** Match sync (Edge Function + API-Football)
  - Edge Function `match-sync`: 24h cron for fixtures, 1min for live
  - API-Football data mapping -> matches table
  - Depends: F0-07 (DB), API-Football API key
  - Effort: 8h

- [ ] **F1-17** Predictions screen (match list)
  - Cards per match with logos, teams, time
  - Scroll by date/matchday
  - Status indicator (pending, submitted, closed)
  - Depends: F1-16 (matches)
  - Effort: 6h

- [ ] **F1-18** Prediction input (numeric stepper)
  - Stepper (+/-) or numeric keyboard for home_score and away_score
  - Visual confirmation (animation + haptic)
  - Depends: F1-17 (predictions screen)
  - Effort: 4h

- [ ] **F1-19** Save predictions (with time validation)
  - RLS blocks post-kickoff predictions (server-side)
  - UI disables inputs post-kickoff (client-side)
  - Optimistic UI with rollback on error
  - Depends: F0-07 (RLS policies)
  - Effort: 4h

- [ ] **F1-20** View others' predictions (post-kickoff)
  - Only visible after kickoff (RLS)
  - Group predictions view per match
  - Depends: F0-07 (RLS policies)
  - Effort: 3h

- [ ] **F1-21** Points calculation (DB function)
  - `calculate_prediction_points()` function in PostgreSQL
  - Scoring: exact (5pts), correct result (3pts), goal diff (1pt bonus)
  - Configurable per group via JSONB
  - Depends: F0-07 (DB)
  - Effort: 4h

- [ ] **F1-22** Leaderboard update trigger
  - `process_match_result()` trigger on match status change to 'finished'
  - Updates predictions.points + refreshes leaderboard_cache
  - Depends: F1-21 (points calculation)
  - Effort: 3h

### Milestone 4: Leaderboard (Week 5)

- [ ] **F1-23** Ranking screen (sorted list)
  - Top 3 highlighted (gold, silver, bronze)
  - My position sticky if outside viewport
  - Stats per player (matches, exact scores, correct results)
  - Depends: F1-22 (leaderboard cache)
  - Effort: 6h

- [ ] **F1-24** Realtime leaderboard subscription
  - Supabase Realtime: `postgres_changes` on leaderboard_cache
  - Update UI in real-time when results are processed
  - Depends: Supabase Realtime configured
  - Effort: 4h

- [ ] **F1-25** Filters (Overall / By Date / Last N)
  - Tab bar: Overall | By Date | Trend
  - Different queries for each view
  - Depends: F1-23 (ranking)
  - Effort: 4h

- [ ] **F1-26** Highlight my position
  - Highlight current user's row
  - Position change indicator (green/red arrow)
  - Depends: F1-23 (ranking)
  - Effort: 2h

- [ ] **F1-27** Position change animations
  - Slide up/down with green/red glow
  - React Native Reanimated for 60fps animations
  - Depends: F1-24 (realtime), Reanimated
  - Effort: 3h

- [ ] **F1-28** Detailed player stats
  - Detail screen: prediction history, correct picks, streaks
  - Depends: F1-23 (ranking)
  - Effort: 4h

---

## Phase 2: Polish + Notifications (Weeks 6-7)

> **Status**: NOT STARTED
> **Estimate**: ~41h

### Push Notifications

- [ ] **F2-01** Push notifications setup (Expo)
  - Configure expo-notifications
  - Register push tokens in profiles.push_token
  - Depends: F1-02/F1-03 (auth)
  - Effort: 4h

- [ ] **F2-02** Prediction reminder (Edge Function cron)
  - Edge Function with cron: 2h and 30min before kickoff
  - Depends: F2-01 (push setup), F1-16 (matches)
  - Effort: 4h

- [ ] **F2-03** Result available notification
  - Fire when match ends and points are calculated
  - Depends: F1-22 (calculation trigger)
  - Effort: 3h

- [ ] **F2-04** Ranking change notification
  - Notify when user moves up/down in ranking
  - Depends: F1-22 (leaderboard update)
  - Effort: 3h

- [ ] **F2-05** Notifications screen (inbox)
  - Notification list with read/unread
  - Mark as read
  - Deep link to relevant screen
  - Depends: F0-07 (notifications table)
  - Effort: 4h

- [ ] **F2-06** Notification settings (toggles)
  - Toggle per type: reminders, results, ranking, invitations
  - Quiet mode by schedule
  - Depends: F2-01 (push setup)
  - Effort: 3h

### UX Polish

- [ ] **F2-07** Pull to refresh on all screens
  - Effort: 2h

- [ ] **F2-08** Loading states + skeletons
  - Skeleton screens for lists (matches, ranking, groups)
  - Effort: 4h

- [ ] **F2-09** Global error handling
  - Error boundaries, toast messages, retry logic
  - Effort: 3h

- [ ] **F2-10** Animations and micro-interactions
  - Confetti on saving prediction
  - Gold star on exact result
  - Bouncing ball on pull-to-refresh
  - Red pulse on LIVE matches
  - Effort: 6h

- [ ] **F2-11** Dark mode + Light mode toggle
  - NativeWind dark: variant
  - Persist preference in AsyncStorage
  - Effort: 3h

- [ ] **F2-12** Haptic feedback on key actions
  - Save prediction, exact result, ranking change
  - Effort: 2h

---

## Phase 3: Testing + Beta (Weeks 8-9)

> **Status**: NOT STARTED
> **Estimate**: ~42h
> **Note**: TDD is applied throughout development (Phases 0-2).
> This phase is for E2E tests, performance, and beta testing.

- [ ] **F3-01** Full flow E2E test
  - Register -> create group -> predict -> view result -> ranking
  - Effort: 6h

- [ ] **F3-02** RLS policies test
  - Verify post-kickoff prediction is blocked
  - Verify visibility of others' predictions
  - Verify group permissions (admin/member)
  - Effort: 4h

- [ ] **F3-03** Edge Functions test
  - match-sync, calculate-scores, send-notification
  - Effort: 3h

- [ ] **F3-04** Performance profiling (render times)
  - Measure render times in long lists
  - Optimize unnecessary re-renders
  - Effort: 3h

- [ ] **F3-05** Beta testing with 10-20 friends
  - Production build via EAS
  - Distribute via TestFlight (iOS) + Internal Testing (Android)
  - Collect feedback
  - Effort: 8h

- [ ] **F3-06** Fix reported bugs
  - Prioritize by severity
  - Effort: 12h

- [ ] **F3-07** Slow query optimization
  - Analyze with EXPLAIN ANALYZE
  - Add missing indexes
  - Effort: 4h

- [ ] **F3-08** Sentry setup for crash reporting
  - Integrate @sentry/react-native
  - Configure source maps
  - Effort: 2h

---

## Phase 4: Launch (Week 10)

> **Status**: NOT STARTED
> **Estimate**: ~16h

- [ ] **F4-01** App Store assets (screenshots, description)
  - Screenshots for iPhone and iPad
  - Description in Spanish (target market)
  - Optimized keywords
  - Effort: 4h

- [ ] **F4-02** Privacy policy + Terms of service
  - Effort: 3h

- [ ] **F4-03** Submit to App Store (iOS)
  - Effort: 2h

- [ ] **F4-04** Submit to Play Store (Android)
  - Effort: 2h

- [ ] **F4-05** Configure EAS Update for OTA
  - Production and staging channels
  - Effort: 1h

- [ ] **F4-06** Simple landing page (optional)
  - Effort: 4h

- [ ] **F4-07** Post-launch monitoring
  - Sentry + Expo Insights dashboards
  - Ongoing

---

## Future Phases (Post-Launch)

> These phases will be planned in detail when they approach.
> Included as high-level reference.

### Phase 5: Social (Weeks 11-14)

- [ ] **F5-01** Group chat (Supabase Realtime Broadcast)
- [ ] **F5-02** Reactions to others' predictions
- [ ] **F5-03** Share results on social media (generated image)
- [ ] **F5-04** Friends / followers system
- [ ] **F5-05** Social activity feed

### Phase 6: Gamification (Weeks 15-18)

- [ ] **F6-01** Badge/achievement system
- [ ] **F6-02** User levels (based on participation)
- [ ] **F6-03** Prediction of the week
- [ ] **F6-04** Streaks (correct prediction streaks)
- [ ] **F6-05** 1v1 challenges between friends

### Phase 7: Expansion (Weeks 19+)

- [ ] **F7-01** Public groups with official tournaments
- [ ] **F7-02** Multi-sport (basketball, tennis, etc.)
- [ ] **F7-03** Special predictions (top scorer, cards, etc.)
- [ ] **F7-04** Leagues between groups (meta-competition)
- [ ] **F7-05** Monetization: Premium (themes, advanced stats, no ads)
- [ ] **F7-06** Native iOS/Android widgets

---

## Progress Summary

| Phase            | Tasks  | Completed | In Progress | Pending |
| ---------------- | ------ | --------- | ----------- | ------- |
| Phase 0: Setup   | 12     | 12        | 0           | 0       |
| Phase 1: MVP     | 28     | 4         | 0           | 24      |
| Phase 2: Polish  | 12     | 0         | 0           | 12      |
| Phase 3: Testing | 8      | 0         | 0           | 8       |
| Phase 4: Launch  | 7      | 0         | 0           | 7       |
| **Total MVP**    | **67** | **15**    | **0**       | **52**  |
| Phase 5-7: Later | 16     | 0         | 0           | 16      |

**Overall MVP progress: 22.4%**

---

## Instructions for Claude Code

1. **Before starting a task**: Mark it as `[~]` (in progress)
2. **On completing a task**: Mark it as `[x]` and update the progress summary table
3. **If a task is canceled**: Mark it as `[-]` with a note explaining why
4. **If new tasks arise**: Add them with the next available ID in the corresponding phase
5. **Mandatory TDD**: Follow `/tdd` for every code task (RED-GREEN-REFACTOR vertical)
6. **Dependencies**: Do not start a task if its dependencies are not completed
7. **Notes**: Add relevant notes below each task if there are important decisions or issues found

### Recommended execution order

```
Phase 0 (sequential):
F0-01 ✅ → F0-03 ✅ → F0-04 ✅ → F0-05 ✅ → F0-06 ✅ → F0-09 ✅ (testing setup)
F0-02 ✅ → F0-07 ✅ → F0-10 ✅ → F0-12 ✅ (migrate to local supabase)
F0-08 ✅ + F0-11 ✅ (EAS + CI/CD, completed together)

Phase 1 - Milestone 1 (sequential with partial parallel):
F1-01 ✅ → F1-05 ✅ → F1-02 + F1-03 (parallel) → F1-04 → F1-06
F1-07 → F1-08

Phase 1 - Milestone 2:
F1-09 → F1-10 → F1-11
F1-12, F1-13 (parallel)
F1-14 → F1-15

Phase 1 - Milestone 3:
F1-16 → F1-17 → F1-18 → F1-19
F1-20 (independent post-kickoff logic)
F1-21 → F1-22

Phase 1 - Milestone 4:
F1-23 → F1-24 → F1-25 + F1-26 (parallel) → F1-27
F1-28 (independent)
```
