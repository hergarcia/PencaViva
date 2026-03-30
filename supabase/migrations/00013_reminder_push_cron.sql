-- Schedule the prediction reminder Edge Function via pg_cron.
--
-- pg_cron + pg_net were enabled in migration 00012.
-- This migration only adds a new cron job.
-- Wrapped in an exception handler so this migration is non-fatal on local dev
-- (where pg_cron may not be available).
--
-- Schedule: every 15 minutes.
-- The function checks two reminder windows on each run:
--   - 2h window:   kickoff_time BETWEEN now+110min AND now+130min
--   - 30min window: kickoff_time BETWEEN now+20min AND now+40min
-- Each window is 20 minutes wide, so a 15-minute tick guarantees each match
-- is caught in each window at least once. The notifications table dedup gate
-- (3h lookback) prevents duplicate sends on consecutive ticks.

DO $$ BEGIN
  PERFORM cron.schedule(
    'prediction-reminder',
    '*/15 * * * *',
    $job$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/reminder-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling not available (local dev), skipping prediction-reminder job';
END $$;

-- Verify the required app settings are present at migration time.
-- current_setting(..., false) raises an error if the setting is missing,
-- making misconfiguration visible immediately rather than silently no-oping.
DO $$ BEGIN
  PERFORM current_setting('app.settings.supabase_url', false);
  PERFORM current_setting('app.settings.service_role_key', false);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'app.settings not configured (local dev), reminder cron will not fire until configured';
END $$;
