-- Add notification_settings JSONB column to profiles.
-- Stores per-user notification preferences with a sensible all-on default.
--
-- Schema:
--   reminders        BOOLEAN  — match-kickoff reminders
--   results          BOOLEAN  — score result updates
--   ranking          BOOLEAN  — ranking change alerts
--   invitations      BOOLEAN  — group invite notifications
--   quietHoursEnabled BOOLEAN  — whether quiet window is active
--   quietFrom        TEXT     — quiet window start (HH:MM, 24h)
--   quietTo          TEXT     — quiet window end   (HH:MM, 24h)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_settings JSONB
    NOT NULL DEFAULT '{
      "reminders": true,
      "results": true,
      "ranking": true,
      "invitations": true,
      "quietHoursEnabled": false,
      "quietFrom": "22:00",
      "quietTo": "08:00"
    }'::jsonb;
