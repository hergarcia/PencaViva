// src/lib/mock/fixtures.ts

// ── Fixed UUIDs for stable references ────────────────────────────────

export const MOCK_USER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export const MOCK_GROUP_IDS = {
  owned: "g0000001-0000-0000-0000-000000000001",
  member: "g0000002-0000-0000-0000-000000000002",
} as const;

export const MOCK_MEMBER_IDS = {
  alice: "m0000001-0000-0000-0000-000000000001",
  bob: "m0000002-0000-0000-0000-000000000002",
  carol: "m0000003-0000-0000-0000-000000000003",
  dave: "m0000004-0000-0000-0000-000000000004",
} as const;

export const MOCK_TOURNAMENT_ID = "t0000001-0000-0000-0000-000000000001";

export const MOCK_MATCH_IDS = {
  scheduled1: "mt000001-0000-0000-0000-000000000001",
  scheduled2: "mt000002-0000-0000-0000-000000000002",
  scheduled3: "mt000003-0000-0000-0000-000000000003",
  scheduled4: "mt000004-0000-0000-0000-000000000004",
  live1: "mt000005-0000-0000-0000-000000000005",
  live2: "mt000006-0000-0000-0000-000000000006",
  finished1: "mt000007-0000-0000-0000-000000000007",
  finished2: "mt000008-0000-0000-0000-000000000008",
  finished3: "mt000009-0000-0000-0000-000000000009",
  postponed1: "mt000010-0000-0000-0000-000000000010",
} as const;

export const MOCK_PREDICTION_IDS = {
  pred1: "pr000001-0000-0000-0000-000000000001",
  pred2: "pr000002-0000-0000-0000-000000000002",
  pred3: "pr000003-0000-0000-0000-000000000003",
  pred4: "pr000004-0000-0000-0000-000000000004",
} as const;

export const MOCK_LEADERBOARD_IDS = {
  entry1: "lb000001-0000-0000-0000-000000000001",
  entry2: "lb000002-0000-0000-0000-000000000002",
  entry3: "lb000003-0000-0000-0000-000000000003",
} as const;

// ── Date helpers ────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

function daysAgo(days: number): string {
  return daysFromNow(-days);
}

// ── Profiles ────────────────────────────────────────────────────────

export const mockProfiles = [
  {
    id: MOCK_USER_ID,
    username: "hernan_uy",
    display_name: "Hernan Garcia",
    avatar_url: "https://placehold.co/200x200/00D4AA/white?text=HG",
    bio: "Football fan from Montevideo",
    favorite_team: "Nacional",
    points_total: 42,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(30),
  },
  {
    id: MOCK_MEMBER_IDS.alice,
    username: "alice_mvd",
    display_name: "Alice Rodriguez",
    avatar_url: "https://placehold.co/200x200/7C5CFC/white?text=AR",
    bio: null,
    favorite_team: "Penarol",
    points_total: 38,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(28),
  },
  {
    id: MOCK_MEMBER_IDS.bob,
    username: "bob_scores",
    display_name: "Bob Martinez",
    avatar_url: "https://placehold.co/200x200/FFB800/black?text=BM",
    bio: null,
    favorite_team: "Liverpool",
    points_total: 35,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(25),
  },
  {
    id: MOCK_MEMBER_IDS.carol,
    username: "carol_gol",
    display_name: "Carol Fernandez",
    avatar_url: null,
    bio: null,
    favorite_team: null,
    points_total: 29,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(20),
  },
  {
    id: MOCK_MEMBER_IDS.dave,
    username: "dave_futbol",
    display_name: "Dave Suarez",
    avatar_url: "https://placehold.co/200x200/0D0D0D/white?text=DS",
    bio: null,
    favorite_team: "Defensor",
    points_total: 22,
    updated_at: new Date().toISOString(),
    created_at: daysAgo(15),
  },
];

// ── Groups ──────────────────────────────────────────────────────────

export const mockGroups = [
  {
    id: MOCK_GROUP_IDS.owned,
    name: "Los Bolsos",
    description: "Neighborhood prediction league",
    avatar_url: null,
    invite_code: "ABCD1234",
    created_by: MOCK_USER_ID,
    max_members: 50,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    is_active: true,
    created_at: daysAgo(30),
  },
  {
    id: MOCK_GROUP_IDS.member,
    name: "Oficina FC",
    description: "Office prediction league",
    avatar_url: null,
    invite_code: "WXYZ5678",
    created_by: MOCK_MEMBER_IDS.alice,
    max_members: 30,
    scoring_system: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
    is_active: true,
    created_at: daysAgo(25),
  },
];

// ── Group Members ───────────────────────────────────────────────────

export const mockGroupMembers = [
  {
    user_id: MOCK_USER_ID,
    group_id: MOCK_GROUP_IDS.owned,
    role: "admin",
    is_active: true,
    joined_at: daysAgo(30),
  },
  {
    user_id: MOCK_MEMBER_IDS.alice,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(28),
  },
  {
    user_id: MOCK_MEMBER_IDS.bob,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(25),
  },
  {
    user_id: MOCK_MEMBER_IDS.carol,
    group_id: MOCK_GROUP_IDS.owned,
    role: "member",
    is_active: true,
    joined_at: daysAgo(20),
  },
  {
    user_id: MOCK_MEMBER_IDS.alice,
    group_id: MOCK_GROUP_IDS.member,
    role: "admin",
    is_active: true,
    joined_at: daysAgo(25),
  },
  {
    user_id: MOCK_USER_ID,
    group_id: MOCK_GROUP_IDS.member,
    role: "member",
    is_active: true,
    joined_at: daysAgo(22),
  },
  {
    user_id: MOCK_MEMBER_IDS.dave,
    group_id: MOCK_GROUP_IDS.member,
    role: "member",
    is_active: true,
    joined_at: daysAgo(15),
  },
];

// ── Tournaments ─────────────────────────────────────────────────────

export const mockTournaments = [
  {
    id: MOCK_TOURNAMENT_ID,
    name: "Copa Libertadores 2026",
    short_name: "Libertadores",
    logo_url: "https://placehold.co/64x64/00D4AA/white?text=CL",
    country: "South America",
    season: 2026,
    api_league_id: 13,
    status: "active",
    created_at: daysAgo(60),
  },
];

// ── Group Tournaments ───────────────────────────────────────────────

export const mockGroupTournaments = [
  {
    group_id: MOCK_GROUP_IDS.owned,
    tournament_id: MOCK_TOURNAMENT_ID,
    added_at: daysAgo(30),
  },
  {
    group_id: MOCK_GROUP_IDS.member,
    tournament_id: MOCK_TOURNAMENT_ID,
    added_at: daysAgo(25),
  },
];

// ── Matches ─────────────────────────────────────────────────────────

export const mockMatches = [
  {
    id: MOCK_MATCH_IDS.scheduled1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Boca Juniors",
    away_team_name: "River Plate",
    home_team_logo: "https://placehold.co/48x48?text=BOC",
    away_team_logo: "https://placehold.co/48x48?text=RIV",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(1),
    matchday: 5,
    venue: "La Bombonera",
    api_match_id: 1001,
  },
  {
    id: MOCK_MATCH_IDS.scheduled2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Nacional",
    away_team_name: "Penarol",
    home_team_logo: "https://placehold.co/48x48?text=NAC",
    away_team_logo: "https://placehold.co/48x48?text=PEN",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(2),
    matchday: 5,
    venue: "Gran Parque Central",
    api_match_id: 1002,
  },
  {
    id: MOCK_MATCH_IDS.scheduled3,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Flamengo",
    away_team_name: "Palmeiras",
    home_team_logo: "https://placehold.co/48x48?text=FLA",
    away_team_logo: "https://placehold.co/48x48?text=PAL",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(5),
    matchday: 6,
    venue: "Maracana",
    api_match_id: 1003,
  },
  {
    id: MOCK_MATCH_IDS.scheduled4,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Atletico Mineiro",
    away_team_name: "Gremio",
    home_team_logo: "https://placehold.co/48x48?text=CAM",
    away_team_logo: "https://placehold.co/48x48?text=GRE",
    home_score: null,
    away_score: null,
    status: "scheduled",
    kickoff_time: daysFromNow(7),
    matchday: 6,
    venue: "Mineirao",
    api_match_id: 1004,
  },
  {
    id: MOCK_MATCH_IDS.live1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Santos",
    away_team_name: "Sao Paulo",
    home_team_logo: "https://placehold.co/48x48?text=SAN",
    away_team_logo: "https://placehold.co/48x48?text=SAO",
    home_score: 1,
    away_score: 0,
    status: "live",
    kickoff_time: daysFromNow(0),
    matchday: 5,
    venue: "Vila Belmiro",
    api_match_id: 1005,
  },
  {
    id: MOCK_MATCH_IDS.live2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Racing Club",
    away_team_name: "Independiente",
    home_team_logo: "https://placehold.co/48x48?text=RAC",
    away_team_logo: "https://placehold.co/48x48?text=IND",
    home_score: 2,
    away_score: 2,
    status: "live",
    kickoff_time: daysFromNow(0),
    matchday: 5,
    venue: "El Cilindro",
    api_match_id: 1006,
  },
  {
    id: MOCK_MATCH_IDS.finished1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Cerro Porteno",
    away_team_name: "Olimpia",
    home_team_logo: "https://placehold.co/48x48?text=CER",
    away_team_logo: "https://placehold.co/48x48?text=OLI",
    home_score: 3,
    away_score: 1,
    status: "finished",
    kickoff_time: daysAgo(1),
    matchday: 4,
    venue: "La Nueva Olla",
    api_match_id: 1007,
  },
  {
    id: MOCK_MATCH_IDS.finished2,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Universitario",
    away_team_name: "Alianza Lima",
    home_team_logo: "https://placehold.co/48x48?text=UCR",
    away_team_logo: "https://placehold.co/48x48?text=ALI",
    home_score: 0,
    away_score: 0,
    status: "finished",
    kickoff_time: daysAgo(2),
    matchday: 4,
    venue: "Monumental",
    api_match_id: 1008,
  },
  {
    id: MOCK_MATCH_IDS.finished3,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Emelec",
    away_team_name: "Barcelona SC",
    home_team_logo: "https://placehold.co/48x48?text=EME",
    away_team_logo: "https://placehold.co/48x48?text=BSC",
    home_score: 1,
    away_score: 2,
    status: "finished",
    kickoff_time: daysAgo(2),
    matchday: 4,
    venue: "George Capwell",
    api_match_id: 1009,
  },
  {
    id: MOCK_MATCH_IDS.postponed1,
    tournament_id: MOCK_TOURNAMENT_ID,
    home_team_name: "Colon",
    away_team_name: "Union",
    home_team_logo: "https://placehold.co/48x48?text=COL",
    away_team_logo: "https://placehold.co/48x48?text=UNI",
    home_score: null,
    away_score: null,
    status: "postponed",
    kickoff_time: daysAgo(1),
    matchday: 4,
    venue: "Brigadier Lopez",
    api_match_id: 1010,
  },
];

// ── Predictions ─────────────────────────────────────────────────────

export const mockPredictions = [
  {
    id: MOCK_PREDICTION_IDS.pred1,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.finished1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 2,
    away_score_pred: 1,
    points_earned: 3,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  },
  {
    id: MOCK_PREDICTION_IDS.pred2,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.finished2,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 0,
    away_score_pred: 0,
    points_earned: 5,
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
  },
  {
    id: MOCK_PREDICTION_IDS.pred3,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.live1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 2,
    away_score_pred: 0,
    points_earned: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
  {
    id: MOCK_PREDICTION_IDS.pred4,
    user_id: MOCK_USER_ID,
    match_id: MOCK_MATCH_IDS.scheduled1,
    group_id: MOCK_GROUP_IDS.owned,
    home_score_pred: 1,
    away_score_pred: 0,
    points_earned: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
  },
];

// ── Leaderboard Cache ───────────────────────────────────────────────

export const mockLeaderboardCache = [
  {
    id: MOCK_LEADERBOARD_IDS.entry1,
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_USER_ID,
    points_total: 42,
    rank: 1,
    predictions_count: 15,
    exact_scores: 3,
    correct_results: 8,
    updated_at: new Date().toISOString(),
  },
  {
    id: MOCK_LEADERBOARD_IDS.entry2,
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_MEMBER_IDS.alice,
    points_total: 38,
    rank: 2,
    predictions_count: 14,
    exact_scores: 2,
    correct_results: 9,
    updated_at: new Date().toISOString(),
  },
  {
    id: MOCK_LEADERBOARD_IDS.entry3,
    group_id: MOCK_GROUP_IDS.owned,
    user_id: MOCK_MEMBER_IDS.bob,
    points_total: 35,
    rank: 3,
    predictions_count: 13,
    exact_scores: 2,
    correct_results: 7,
    updated_at: new Date().toISOString(),
  },
];

// ── Notifications (empty for now) ───────────────────────────────────

export const mockNotifications: Record<string, unknown>[] = [];
