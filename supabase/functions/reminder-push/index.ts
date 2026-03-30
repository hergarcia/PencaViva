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
    if (!expectedKey) {
      console.error("reminder-push: SUPABASE_SERVICE_ROLE_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Supabase admin client ──────────────────────────────────────
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, expectedKey);

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

      // ── Record sent notifications for exactly the successful recipients ─
      // successPerMessage mirrors the messages array so we can identify
      // which specific users were accepted by Expo.
      const successfulUsers = users.filter(
        (_, idx) => result.successPerMessage[idx],
      );

      if (successfulUsers.length > 0) {
        const sentAt = now.toISOString();

        const notificationRows = successfulUsers.map((user) => ({
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
          notificationsSent += successfulUsers.length;
        }
      }

      if (result.errorCount > 0) {
        console.warn(
          `reminder-push: ${result.errorCount} push errors for match ${match.matchId} (${match.windowMinutes}min window)`,
        );
      }
    }

    // Log full error details internally; return only counts in the response
    // to avoid leaking DB schema, table names, or token values to callers.
    if (allErrors.length > 0) {
      console.error("reminder-push errors:", JSON.stringify(allErrors));
    }

    const summary = {
      matches_checked: batches.length,
      notifications_sent: notificationsSent,
      error_count: allErrors.length,
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
