/**
 * query.ts — Eligibility query for the reminder-push Edge Function.
 *
 * Finds matches in the 2h or 30min pre-kickoff windows, identifies users
 * who haven't predicted yet, and deduplicates against already-sent notifications.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface EligibleUser {
  userId: string;
  pushToken: string;
  displayName: string;
}

export interface MatchReminder {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  windowMinutes: 120 | 30;
}

export interface ReminderBatch {
  match: MatchReminder;
  users: EligibleUser[];
}

/**
 * Returns matches in either pre-kickoff window paired with the eligible users
 * to notify. A user is eligible when:
 *  - They are an active member of a group that tracks the match's tournament
 *  - They have a non-null push_token in their profile
 *  - They have NOT submitted any prediction for this match (any group)
 *  - They have NOT already received a match_reminder notification for this
 *    match in the last 3 hours (idempotency gate)
 */
export async function fetchRemindersToSend(
  supabase: SupabaseClient,
  now: Date,
): Promise<ReminderBatch[]> {
  const nowIso = now.toISOString();
  const dedupeWindowAgo = new Date(
    now.getTime() - 3 * 60 * 60 * 1000,
  ).toISOString();

  // ── Step 1: find matches in either reminder window ─────────────────
  const windows: Array<{
    windowMinutes: 120 | 30;
    lowerMin: number;
    upperMin: number;
  }> = [
    { windowMinutes: 120, lowerMin: 110, upperMin: 130 },
    { windowMinutes: 30, lowerMin: 20, upperMin: 40 },
  ];

  const batches: ReminderBatch[] = [];

  for (const { windowMinutes, lowerMin, upperMin } of windows) {
    const lowerBound = new Date(
      now.getTime() + lowerMin * 60 * 1000,
    ).toISOString();
    const upperBound = new Date(
      now.getTime() + upperMin * 60 * 1000,
    ).toISOString();

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_team_name, away_team_name, kickoff_time, tournament_id")
      .eq("status", "scheduled")
      .gte("kickoff_time", lowerBound)
      .lte("kickoff_time", upperBound);

    if (matchErr) {
      console.error(
        `reminder-push: match query error (${windowMinutes}min window):`,
        matchErr.message,
      );
      continue;
    }

    if (!matches || matches.length === 0) continue;

    for (const match of matches) {
      // ── Step 2: find eligible users for this match ──────────────────
      // Users who are active members of a group that tracks this tournament
      // and have a push token.
      const { data: candidates, error: candidatesErr } = await supabase
        .from("group_members")
        .select(
          `
          user_id,
          profiles!inner(display_name, push_token),
          groups!inner(
            group_tournaments!inner(tournament_id)
          )
        `,
        )
        .eq("is_active", true)
        .eq("groups.group_tournaments.tournament_id", match.tournament_id)
        .not("profiles.push_token", "is", null);

      if (candidatesErr) {
        console.error(
          `reminder-push: candidates query error for match ${match.id}:`,
          candidatesErr.message,
        );
        continue;
      }

      if (!candidates || candidates.length === 0) continue;

      const candidateUserIds = candidates.map(
        (c: { user_id: string }) => c.user_id,
      );

      // ── Step 3: exclude users who already predicted this match ───────
      const { data: existingPredictions, error: predErr } = await supabase
        .from("predictions")
        .select("user_id")
        .eq("match_id", match.id)
        .in("user_id", candidateUserIds);

      if (predErr) {
        console.error(
          `reminder-push: predictions query error for match ${match.id}:`,
          predErr.message,
        );
        continue;
      }

      const predictedUserIds = new Set(
        (existingPredictions ?? []).map((p: { user_id: string }) => p.user_id),
      );

      // ── Step 4: exclude users already notified in the last 3 hours ───
      const { data: recentNotifications, error: notifErr } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("type", "match_reminder")
        .eq("data->>match_id", match.id)
        .in("user_id", candidateUserIds)
        .gte("created_at", dedupeWindowAgo);

      if (notifErr) {
        console.error(
          `reminder-push: dedup query error for match ${match.id}:`,
          notifErr.message,
        );
        continue;
      }

      const alreadyNotifiedUserIds = new Set(
        (recentNotifications ?? []).map((n: { user_id: string }) => n.user_id),
      );

      // ── Step 5: build eligible list ──────────────────────────────────
      const eligibleUsers: EligibleUser[] = candidates
        .filter(
          (c: { user_id: string }) =>
            !predictedUserIds.has(c.user_id) &&
            !alreadyNotifiedUserIds.has(c.user_id),
        )
        .map(
          (c: {
            user_id: string;
            profiles: { display_name: string; push_token: string };
          }) => ({
            userId: c.user_id,
            pushToken: c.profiles.push_token,
            displayName: c.profiles.display_name,
          }),
        );

      if (eligibleUsers.length === 0) continue;

      batches.push({
        match: {
          matchId: match.id,
          homeTeam: match.home_team_name,
          awayTeam: match.away_team_name,
          kickoffTime: match.kickoff_time,
          windowMinutes,
        },
        users: eligibleUsers,
      });
    }
  }

  return batches;
}

/** Builds the notification title for a given reminder window. */
export function buildTitle(
  homeTeam: string,
  awayTeam: string,
  windowMinutes: 120 | 30,
): string {
  if (windowMinutes === 30) {
    return `${homeTeam} vs ${awayTeam} — 30 min to go`;
  }
  return `${homeTeam} vs ${awayTeam}`;
}

/** Builds the notification body for a given reminder window. */
export function buildBody(windowMinutes: 120 | 30): string {
  if (windowMinutes === 120) {
    return "2 hours to kick off — your prediction is still missing. Don't let your friends score while you sit this one out.";
  }
  return "Last call! Submit your prediction before kickoff and stay in the game.";
}
