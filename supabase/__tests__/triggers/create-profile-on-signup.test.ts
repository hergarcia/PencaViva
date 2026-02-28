import { pool, isSupabaseAvailable, closePool } from "../setup";
import { withTransaction } from "../helpers";
import { randomUUID } from "crypto";
import { PoolClient } from "pg";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

/**
 * Helper to insert a raw auth.users row directly (bypassing createTestUser)
 * so we can test the trigger in isolation.
 */
async function insertAuthUser(
  client: PoolClient,
  options: {
    id?: string;
    email?: string;
    rawUserMetaData?: Record<string, string>;
  } = {},
): Promise<{ id: string; email: string }> {
  const id = options.id ?? randomUUID();
  const email = options.email ?? `test-${id.slice(0, 8)}@test.pencaviva.com`;
  const metaData = JSON.stringify(options.rawUserMetaData ?? {});

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
      $3::jsonb,
      now(),
      now()
    )`,
    [id, email, metaData],
  );

  return { id, email };
}

describeFn("handle_new_user trigger (on_auth_user_created)", () => {
  it("creates a profile when a new auth user is inserted", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "basic@example.com",
        rawUserMetaData: { full_name: "Basic User" },
      });

      const result = await client.query(
        "SELECT id, display_name, username, avatar_url, points_total FROM public.profiles WHERE id = $1",
        [id],
      );

      expect(result.rows).toHaveLength(1);
      const profile = result.rows[0];
      expect(profile.id).toBe(id);
      expect(profile.display_name).toBe("Basic User");
      expect(profile.username).toMatch(/^user_[0-9a-f]{12}$/);
      expect(profile.avatar_url).toBeNull();
      expect(profile.points_total).toBe(0);
    });
  });

  it("uses full_name from metadata as display_name", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "maria@example.com",
        rawUserMetaData: { full_name: "María García" },
      });

      const result = await client.query(
        "SELECT display_name FROM public.profiles WHERE id = $1",
        [id],
      );

      expect(result.rows[0].display_name).toBe("María García");
    });
  });

  it("falls back to name metadata when full_name is absent", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "juan@example.com",
        rawUserMetaData: { name: "Juan Pérez" },
      });

      const result = await client.query(
        "SELECT display_name FROM public.profiles WHERE id = $1",
        [id],
      );

      expect(result.rows[0].display_name).toBe("Juan Pérez");
    });
  });

  it("falls back to email prefix when no metadata names exist", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "carlos.fernandez@example.com",
        rawUserMetaData: {},
      });

      const result = await client.query(
        "SELECT display_name FROM public.profiles WHERE id = $1",
        [id],
      );

      expect(result.rows[0].display_name).toBe("carlos.fernandez");
    });
  });

  it("generates deterministic username from user UUID", async () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    // UUID without hyphens: 550e8400e29b41d4a716446655440000
    // First 12 chars: 550e8400e29b
    const expectedUsername = "user_550e8400e29b";

    await withTransaction(pool!, async (client) => {
      await insertAuthUser(client, {
        id: userId,
        email: "deterministic@example.com",
      });

      const result = await client.query(
        "SELECT username FROM public.profiles WHERE id = $1",
        [userId],
      );

      expect(result.rows[0].username).toBe(expectedUsername);
    });
  });

  it("generates unique usernames for users with identical email prefixes", async () => {
    await withTransaction(pool!, async (client) => {
      const { id: id1 } = await insertAuthUser(client, {
        email: "testuser@domainA.com",
      });
      const { id: id2 } = await insertAuthUser(client, {
        email: "testuser@domainB.com",
      });

      const result1 = await client.query(
        "SELECT username FROM public.profiles WHERE id = $1",
        [id1],
      );
      const result2 = await client.query(
        "SELECT username FROM public.profiles WHERE id = $1",
        [id2],
      );

      expect(result1.rows).toHaveLength(1);
      expect(result2.rows).toHaveLength(1);
      expect(result1.rows[0].username).not.toBe(result2.rows[0].username);
      expect(result1.rows[0].username).toMatch(/^user_[0-9a-f]{12}$/);
      expect(result2.rows[0].username).toMatch(/^user_[0-9a-f]{12}$/);
    });
  });

  it("handles whitespace-only full_name by falling back to email prefix", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "emptyname@example.com",
        rawUserMetaData: { full_name: "   " },
      });

      const result = await client.query(
        "SELECT display_name FROM public.profiles WHERE id = $1",
        [id],
      );

      expect(result.rows[0].display_name).toBe("emptyname");
    });
  });

  it("sets default values for optional profile fields", async () => {
    await withTransaction(pool!, async (client) => {
      const { id } = await insertAuthUser(client, {
        email: "defaults@example.com",
      });

      const result = await client.query(
        `SELECT avatar_url, bio, favorite_team, points_total, created_at, updated_at
         FROM public.profiles WHERE id = $1`,
        [id],
      );

      expect(result.rows).toHaveLength(1);
      const profile = result.rows[0];
      expect(profile.avatar_url).toBeNull();
      expect(profile.bio).toBeNull();
      expect(profile.favorite_team).toBeNull();
      expect(profile.points_total).toBe(0);
      expect(profile.created_at).toBeInstanceOf(Date);
      expect(profile.updated_at).toBeInstanceOf(Date);
    });
  });
});
