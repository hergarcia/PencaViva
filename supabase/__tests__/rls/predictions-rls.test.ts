import { pool, isSupabaseAvailable, closePool } from "../setup";
import {
  withTransaction,
  createTestUser,
  createTestTournament,
  createTestMatch,
  createTestGroup,
  addGroupMember,
  addGroupTournament,
  setAuthContext,
  resetAuthContext,
} from "../helpers";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

describeFn("predictions RLS policies", () => {
  describe("INSERT policy", () => {
    it("allows a group member to insert their own prediction before kickoff", async () => {
      await withTransaction(pool!, async (client) => {
        const user = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() + 3600000).toISOString(),
        });
        const group = await createTestGroup(client, user.id);
        await addGroupTournament(client, group.id, tournament.id);

        await setAuthContext(client, user.id);

        const result = await client.query(
          `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
           VALUES ($1, $2, $3, 2, 1)
           RETURNING id`,
          [user.id, match.id, group.id],
        );
        expect(result.rows).toHaveLength(1);

        await resetAuthContext(client);
      });
    });

    it("blocks a prediction insert after kickoff", async () => {
      await withTransaction(pool!, async (client) => {
        const user = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        });
        const group = await createTestGroup(client, user.id);
        await addGroupTournament(client, group.id, tournament.id);

        await setAuthContext(client, user.id);
        await client.query("SAVEPOINT rls_test");

        let blocked = false;
        try {
          await client.query(
            `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
             VALUES ($1, $2, $3, 2, 1)`,
            [user.id, match.id, group.id],
          );
        } catch (err: unknown) {
          blocked = true;
          expect(err instanceof Error && err.message).toMatch(
            /new row violates row-level security/,
          );
        }

        await client.query("ROLLBACK TO SAVEPOINT rls_test");
        expect(blocked).toBe(true);
        await resetAuthContext(client);
      });
    });

    it("blocks a non-member from inserting a prediction", async () => {
      await withTransaction(pool!, async (client) => {
        const owner = await createTestUser(client);
        const outsider = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() + 3600000).toISOString(),
        });
        const group = await createTestGroup(client, owner.id);
        await addGroupTournament(client, group.id, tournament.id);

        await setAuthContext(client, outsider.id);
        await client.query("SAVEPOINT rls_test");

        let blocked = false;
        try {
          await client.query(
            `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
             VALUES ($1, $2, $3, 2, 1)`,
            [outsider.id, match.id, group.id],
          );
        } catch (err: unknown) {
          blocked = true;
          expect(err instanceof Error && err.message).toMatch(
            /new row violates row-level security/,
          );
        }

        await client.query("ROLLBACK TO SAVEPOINT rls_test");
        expect(blocked).toBe(true);
        await resetAuthContext(client);
      });
    });

    it("blocks a user from inserting a prediction for another user", async () => {
      await withTransaction(pool!, async (client) => {
        const user1 = await createTestUser(client);
        const user2 = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() + 3600000).toISOString(),
        });
        const group = await createTestGroup(client, user1.id);
        await addGroupMember(client, group.id, user2.id);
        await addGroupTournament(client, group.id, tournament.id);

        // user1 tries to insert a prediction with user2's ID
        await setAuthContext(client, user1.id);
        await client.query("SAVEPOINT rls_test");

        let blocked = false;
        try {
          await client.query(
            `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
             VALUES ($1, $2, $3, 2, 1)`,
            [user2.id, match.id, group.id],
          );
        } catch (err: unknown) {
          blocked = true;
          expect(err instanceof Error && err.message).toMatch(
            /new row violates row-level security/,
          );
        }

        await client.query("ROLLBACK TO SAVEPOINT rls_test");
        expect(blocked).toBe(true);
        await resetAuthContext(client);
      });
    });
  });

  describe("SELECT policy", () => {
    it("member can see predictions in their group after kickoff", async () => {
      await withTransaction(pool!, async (client) => {
        const user1 = await createTestUser(client);
        const user2 = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() - 3600000).toISOString(), // past kickoff
        });
        const group = await createTestGroup(client, user1.id);
        await addGroupMember(client, group.id, user2.id);
        await addGroupTournament(client, group.id, tournament.id);

        // Insert predictions as superuser
        await client.query(
          `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
           VALUES ($1, $3, $4, 2, 1), ($2, $3, $4, 0, 0)`,
          [user1.id, user2.id, match.id, group.id],
        );

        // Switch to user2 and query through RLS
        await setAuthContext(client, user2.id);

        const result = await client.query(
          `SELECT user_id FROM public.predictions WHERE group_id = $1 ORDER BY user_id`,
          [group.id],
        );

        // User2 should see both predictions (kickoff is past)
        expect(result.rows).toHaveLength(2);

        await resetAuthContext(client);
      });
    });

    it("hides other users predictions before kickoff", async () => {
      await withTransaction(pool!, async (client) => {
        const user1 = await createTestUser(client);
        const user2 = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() + 3600000).toISOString(), // future kickoff
        });
        const group = await createTestGroup(client, user1.id);
        await addGroupMember(client, group.id, user2.id);
        await addGroupTournament(client, group.id, tournament.id);

        // Insert predictions as superuser
        await client.query(
          `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
           VALUES ($1, $3, $4, 2, 1), ($2, $3, $4, 0, 0)`,
          [user1.id, user2.id, match.id, group.id],
        );

        // Switch to user2 — should only see own prediction (kickoff is future)
        await setAuthContext(client, user2.id);

        const result = await client.query(
          `SELECT user_id FROM public.predictions WHERE group_id = $1`,
          [group.id],
        );

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0].user_id).toBe(user2.id);

        await resetAuthContext(client);
      });
    });

    it("non-member cannot see predictions", async () => {
      await withTransaction(pool!, async (client) => {
        const owner = await createTestUser(client);
        const outsider = await createTestUser(client);
        const tournament = await createTestTournament(client);
        const match = await createTestMatch(client, tournament.id, {
          kickoffTime: new Date(Date.now() - 3600000).toISOString(),
        });
        const group = await createTestGroup(client, owner.id);
        await addGroupTournament(client, group.id, tournament.id);

        await client.query(
          `INSERT INTO public.predictions (user_id, match_id, group_id, home_score_pred, away_score_pred)
           VALUES ($1, $2, $3, 2, 1)`,
          [owner.id, match.id, group.id],
        );

        // Switch to outsider — should see nothing
        await setAuthContext(client, outsider.id);

        const result = await client.query(
          `SELECT user_id FROM public.predictions WHERE group_id = $1`,
          [group.id],
        );

        expect(result.rows).toHaveLength(0);

        await resetAuthContext(client);
      });
    });
  });
});
