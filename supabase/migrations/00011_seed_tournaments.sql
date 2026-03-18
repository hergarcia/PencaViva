-- Add unique constraint on (api_league_id, season) so match-sync can resolve
-- API-Football league IDs to tournament UUIDs unambiguously, and so the seed
-- INSERT is safely re-runnable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_api_league_season
  ON tournaments (api_league_id, season)
  WHERE api_league_id IS NOT NULL;

-- Seed initial tournaments with API-Football league IDs.
INSERT INTO tournaments (name, short_name, sport, country, season, api_league_id, status, start_date, end_date)
VALUES
  ('Primera División Uruguay', 'PDU', 'football', 'Uruguay', '2026', 268, 'active', '2026-02-01', '2026-12-15'),
  ('Copa Libertadores', 'Libertadores', 'football', 'South America', '2026', 13, 'active', '2026-02-01', '2026-11-30'),
  ('Copa Sudamericana', 'Sudamericana', 'football', 'South America', '2026', 11, 'active', '2026-02-01', '2026-11-30')
ON CONFLICT (api_league_id, season) DO NOTHING;
