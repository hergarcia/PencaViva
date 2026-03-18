-- Enable extensions for scheduled Edge Function invocation.
-- pg_cron + pg_net are platform extensions available on Supabase hosted.
-- Wrapped in exception handlers so this migration is non-fatal on local dev
-- (where these extensions may not be available).

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available (local dev), skipping';
END $$;

DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net not available (local dev), skipping';
END $$;

-- Schedule cron jobs (only if pg_cron is available)
DO $$ BEGIN
  -- Daily sync: runs at 04:00 UTC, syncs all active tournaments
  PERFORM cron.schedule(
    'match-sync-daily',
    '0 4 * * *',
    $job$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"mode": "daily"}'::jsonb
    );
    $job$
  );

  -- Live polling: every 2 minutes (Pro tier only for API quota)
  PERFORM cron.schedule(
    'match-sync-live',
    '*/2 * * * *',
    $job$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/match-sync',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{"mode": "live"}'::jsonb
    );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling not available (local dev), skipping';
END $$;
