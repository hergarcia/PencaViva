# F1-14 Group Detail (Members + Info) — Design Spec

## Goal

Extend the existing group detail screen (`app/groups/[id].tsx`) with a tabbed layout that surfaces the member list (with roles) and group information (scoring system, assigned tournaments + invite).

## Approved Design

**Layout:** Two tabs below `ScreenHeader`:

- **Members tab** (default): `FlatList` of active members. Each row shows a letter avatar, `display_name`, `@username`, role badge (color-coded), and total points. The authenticated user's row is tagged "You".
- **Info tab**: Group description (if any), 2×2 scoring grid, tournament list (or "No tournaments" empty state), and the existing invite/QR/share section (moved here from the root of the screen).

**Tab switcher:** Simple `useState<"members" | "info">` — no external library.

## Data Model Changes

| Change                                                 | Rationale                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Add `scoring_system: ScoringSystem` to `UserGroup`     | Info tab must display scoring values; field exists in DB but was not selected                    |
| New `GroupMember` type                                 | Combines `group_members` row with joined `profiles` fields                                       |
| New `GroupTournament` type                             | Alias for the tournaments joined via `group_tournaments`                                         |
| `fetchGroupMembers(groupId)`                           | SELECT from `group_members` joined with `profiles`, sorted admin→mod→member then `joined_at` asc |
| `fetchGroupTournaments(groupId)`                       | SELECT from `group_tournaments` joined with `tournaments`, ordered by `added_at` asc             |
| `useGroupDetail` returns `members[]` + `tournaments[]` | Fetches all three in a single `Promise.all`                                                      |

## No DB Migration Required

RLS migration 00005 already allows members to query `group_members` for their own groups. The `group_tournaments` SELECT policy was also fixed there.

## Component Breakdown

| File                                  | Responsibility                             |
| ------------------------------------- | ------------------------------------------ |
| `src/lib/groups-service.ts`           | New types + functions                      |
| `src/hooks/use-group-detail.ts`       | Parallel fetch, extended return type       |
| `src/components/groups/MemberRow.tsx` | Presentational: avatar + name + role badge |
| `app/groups/[id].tsx`                 | Tab bar + Members/Info tab content         |

## Design Tokens

- Role badge colors: admin → `colors.accent` (#FFB800), moderator → `colors.secondary` (#7C5CFC), member → `colors.textSecondary`
- Avatar: letter fallback with `colors.primary + "33"` background (same pattern as profile screen)
- Scoring grid cells: `colors.surface` background, primary value color
