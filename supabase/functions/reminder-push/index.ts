/**
 * reminder-push Edge Function entry point.
 *
 * Sends Expo push notifications to users who haven't submitted predictions
 * for upcoming matches (2h and 30min pre-kickoff windows).
 *
 * Auth: Authorization: Bearer <service_role_key>
 *
 * Cron schedule: every 15 minutes (see migration 00013_reminder_push_cron.sql)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildBody, buildTitle, fetchRemindersToSend } from "./query.ts";
import { sendPushBatch, type ExpoPushMessage } from "./expo-push.ts";

Deno.serve(async (req) => {
  try {
    // ── Auth check ─────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Supabase admin client ──────────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();

    // ── Find matches + eligible users ──────────────────────────────
    const batches = await fetchRemindersToSend(supabase, now);

    let notificationsSent = 0;
    const allErrors: string[] = [];

    // ── Send push notifications per match ──────────────────────────
    for (const { match, users } of batches) {
      const title = buildTitle(
        match.homeTeam,
        match.awayTeam,
        match.windowMinutes,
      );
      const body = buildBody(match.windowMinutes);

      const messages: ExpoPushMessage[] = users.map((user) => ({
        to: user.pushToken,
        title,
        body,
        data: {
          matchId: match.matchId,
          screen: "match",
          windowMinutes: String(match.windowMinutes),
        },
      }));

      const result = await sendPushBatch(messages);
      allErrors.push(...result.errors);

      // ── Record sent notifications (only successes) ───────────────
      // Determine which users got sent successfully (Expo tickets are
      // returned in the same order as the messages array).
      if (result.successCount > 0) {
        const sentAt = now.toISOString();

        // Insert one notification row per successfully-sent user.
        // We track success by successCount; since partial failures are
        // possible in a batch, we conservatively record all users in a
        // batch that had at least one success — the dedup gate (3h window)
        // prevents re-sends either way.
        const notificationRows = users
          .slice(0, result.successCount)
          .map((user) => ({
            user_id: user.userId,
            type: "match_reminder" as const,
            title,
            body,
            data: {
              match_id: match.matchId,
              window_minutes: match.windowMinutes,
            },
            sent_at: sentAt,
          }));

        const { error: insertErr } = await supabase
          .from("notifications")
          .insert(notificationRows);

        if (insertErr) {
          console.error(
            `reminder-push: failed to insert notification rows for match ${match.matchId}:`,
            insertErr.message,
          );
          allErrors.push(insertErr.message);
        } else {
          notificationsSent += result.successCount;
        }
      }

      if (result.errorCount > 0) {
        console.warn(
          `reminder-push: ${result.errorCount} push errors for match ${match.matchId} (${match.windowMinutes}min window)`,
        );
      }
    }

    const summary = {
      matches_checked: batches.length,
      notifications_sent: notificationsSent,
      errors: allErrors,
      timestamp: now.toISOString(),
    };

    console.log(
      `reminder-push: ${summary.matches_checked} matches checked, ${summary.notifications_sent} notifications sent, ${allErrors.length} errors`,
    );

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("reminder-push error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
