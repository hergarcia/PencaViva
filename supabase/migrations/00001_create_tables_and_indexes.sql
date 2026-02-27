-- =============================================
-- Migration 001: Tables and Indexes
-- PencaViva - Social Sports Predictions
-- =============================================

-- =============================================
-- PROFILES (extends auth.users)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  push_token TEXT,
  bio TEXT,
  favorite_team TEXT,
  points_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TOURNAMENTS
-- =============================================
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  sport TEXT NOT NULL DEFAULT 'football',
  country TEXT,
  season TEXT NOT NULL,
  api_league_id INTEGER,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'finished')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MATCHES
-- =============================================
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  api_match_id INTEGER UNIQUE,
  home_team_name TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  kickoff_time TIMESTAMPTZ NOT NULL,
  matchday INTEGER,
  venue TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_matches_tournament_status ON matches(tournament_id, status);
CREATE INDEX idx_matches_kickoff ON matches(kickoff_time);

-- =============================================
-- GROUPS
-- =============================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  scoring_system JSONB NOT NULL DEFAULT '{
    "exact_score": 5,
    "correct_result": 3,
    "correct_goal_diff": 1,
    "wrong": 0
  }'::jsonb,
  max_members INTEGER DEFAULT 50,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- GROUP_MEMBERS
-- =============================================
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (group_id, user_id)
);

-- Index for RLS subqueries: SELECT group_id FROM group_members WHERE user_id = auth.uid()
-- The composite PK (group_id, user_id) only helps lookups starting with group_id.
CREATE INDEX idx_group_members_user ON group_members(user_id, group_id);

-- =============================================
-- GROUP_TOURNAMENTS
-- =============================================
CREATE TABLE group_tournaments (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, tournament_id)
);

-- =============================================
-- PREDICTIONS
-- =============================================
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  match_id UUID NOT NULL REFERENCES matches(id),
  group_id UUID NOT NULL REFERENCES groups(id),
  home_score_pred INTEGER NOT NULL CHECK (home_score_pred >= 0),
  away_score_pred INTEGER NOT NULL CHECK (away_score_pred >= 0),
  points INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, match_id, group_id)
);

CREATE INDEX idx_predictions_group_match ON predictions(group_id, match_id);
CREATE INDEX idx_predictions_user_group ON predictions(user_id, group_id);

-- =============================================
-- LEADERBOARD_CACHE
-- =============================================
CREATE TABLE leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES tournaments(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  total_points INTEGER DEFAULT 0,
  position INTEGER,
  matches_played INTEGER DEFAULT 0,
  exact_scores INTEGER DEFAULT 0,
  correct_results INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, tournament_id, user_id)
);

CREATE INDEX idx_leaderboard_group_tournament
  ON leaderboard_cache(group_id, tournament_id, position);

-- Partial unique index for NULL tournament_id. PostgreSQL UNIQUE does not
-- enforce uniqueness when NULLs are present (NULL != NULL), so the UPSERT
-- ON CONFLICT would fail to match existing rows where tournament_id IS NULL.
CREATE UNIQUE INDEX idx_leaderboard_cache_no_tournament
  ON leaderboard_cache(group_id, user_id)
  WHERE tournament_id IS NULL;

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('match_reminder', 'result_update', 'ranking_change',
                    'group_invite', 'achievement', 'social')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);
