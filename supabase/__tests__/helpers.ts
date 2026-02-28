import { Pool, PoolClient } from "pg";
import { randomUUID } from "crypto";

/**
 * Runs a test function inside a transaction that is always rolled back.
 * Ensures tests never persist data to the database.
 */
export async function withTransaction(
  pool: Pool,
  fn: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

/**
 * Creates a user in auth.users and the corresponding profile in public.profiles.
 * Must be called within a transaction (which will be rolled back).
 *
 * Supabase's auth.users has many required columns. This provides the minimum
 * set needed for RLS policies that depend on auth.uid().
 */
export async function createTestUser(
  client: PoolClient,
  options: {
    id?: string;
    email?: string;
    username?: string;
    displayName?: string;
  } = {},
): Promise<{ id: string; email: string; username: string }> {
  const id = options.id ?? randomUUID();
  const email = options.email ?? `test-${id.slice(0, 8)}@test.pencaviva.com`;
  const username = options.username ?? `user_${id.slice(0, 8)}`;
  const displayName = options.displayName ?? `Test User ${id.slice(0, 8)}`;

  // Insert into auth.users with all required columns
  await client.query(
    `INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      $1,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      $2,
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )`,
    [id, email],
  );

  // Insert corresponding profile
  await client.query(
    `INSERT INTO public.profiles (id, username, display_name)
     VALUES ($1, $2, $3)`,
    [id, username, displayName],
  );

  return { id, email, username };
}

/**
 * Sets the auth context so that RLS policies using auth.uid() resolve to the given user.
 *
 * Supabase's auth.uid() reads:
 *   ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub')::uuid
 *
 * We must set both the role to 'authenticated' and the JWT claims with the user's UUID.
 * Uses SET LOCAL so the settings are scoped to the current transaction.
 */
export async function setAuthContext(
  client: PoolClient,
  userId: string,
): Promise<void> {
  await client.query(`SET LOCAL role = 'authenticated'`);
  await client.query(
    `SET LOCAL "request.jwt.claims" = '${JSON.stringify({ sub: userId, role: "authenticated" })}'`,
  );
}

/**
 * Resets the auth context back to the default (superuser) role.
 * Useful when a test needs to switch between users or reset to admin.
 */
export async function resetAuthContext(client: PoolClient): Promise<void> {
  await client.query("RESET role");
  await client.query(`SET LOCAL "request.jwt.claims" = ''`);
}

/**
 * Creates a test tournament.
 */
export async function createTestTournament(
  client: PoolClient,
  overrides: {
    id?: string;
    name?: string;
    apiLeagueId?: number;
    status?: string;
  } = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? `Tournament ${id.slice(0, 8)}`;
  const apiLeagueId =
    overrides.apiLeagueId ?? Math.floor(Math.random() * 99999);
  const status = overrides.status ?? "active";

  await client.query(
    `INSERT INTO public.tournaments (id, name, api_league_id, season, status)
     VALUES ($1, $2, $3, '2025', $4)`,
    [id, name, apiLeagueId, status],
  );

  return { id };
}

/**
 * Creates a test match. Kickoff defaults to 1 hour in the future.
 */
export async function createTestMatch(
  client: PoolClient,
  tournamentId: string,
  overrides: {
    id?: string;
    homeTeam?: string;
    awayTeam?: string;
    kickoffTime?: string;
    status?: string;
    homeScore?: number;
    awayScore?: number;
  } = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  const homeTeam = overrides.homeTeam ?? "Nacional";
  const awayTeam = overrides.awayTeam ?? "Peñarol";
  const kickoffTime =
    overrides.kickoffTime ?? new Date(Date.now() + 3600000).toISOString();
  const status = overrides.status ?? "scheduled";
  const apiMatchId = Math.floor(Math.random() * 999999);

  await client.query(
    `INSERT INTO public.matches (id, tournament_id, home_team_name, away_team_name, kickoff_time, status, api_match_id, home_score, away_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      tournamentId,
      homeTeam,
      awayTeam,
      kickoffTime,
      status,
      apiMatchId,
      overrides.homeScore ?? null,
      overrides.awayScore ?? null,
    ],
  );

  return { id };
}

/**
 * Creates a test group with the creator as admin member.
 */
export async function createTestGroup(
  client: PoolClient,
  createdBy: string,
  overrides: { id?: string; name?: string } = {},
): Promise<{ id: string }> {
  const id = overrides.id ?? randomUUID();
  const name = overrides.name ?? `Group ${id.slice(0, 8)}`;
  const inviteCode = `INV${id.slice(0, 5).toUpperCase()}`;

  await client.query(
    `INSERT INTO public.groups (id, name, created_by, invite_code)
     VALUES ($1, $2, $3, $4)`,
    [id, name, createdBy, inviteCode],
  );

  // Add creator as admin member
  await client.query(
    `INSERT INTO public.group_members (group_id, user_id, role)
     VALUES ($1, $2, 'admin')`,
    [id, createdBy],
  );

  return { id };
}

/**
 * Adds a user to a group.
 */
export async function addGroupMember(
  client: PoolClient,
  groupId: string,
  userId: string,
  role: string = "member",
): Promise<void> {
  await client.query(
    `INSERT INTO public.group_members (group_id, user_id, role)
     VALUES ($1, $2, $3)`,
    [groupId, userId, role],
  );
}

/**
 * Links a tournament to a group.
 */
export async function addGroupTournament(
  client: PoolClient,
  groupId: string,
  tournamentId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO public.group_tournaments (group_id, tournament_id)
     VALUES ($1, $2)`,
    [groupId, tournamentId],
  );
}
