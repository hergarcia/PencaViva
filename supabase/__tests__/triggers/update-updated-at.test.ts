import { pool, isSupabaseAvailable, closePool } from "../setup";
import { withTransaction, createTestUser } from "../helpers";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

describeFn("update_updated_at_column trigger", () => {
  it("overwrites updated_at even when explicitly set to a different value", async () => {
    await withTransaction(pool!, async (client) => {
      const user = await createTestUser(client, {
        displayName: "Original Name",
      });

      // Try to set updated_at to a specific past value via a regular UPDATE.
      // The trigger should override it with now() (transaction time).
      await client.query(
        `UPDATE public.profiles
         SET display_name = 'Updated Name', updated_at = '2020-01-01T00:00:00Z'
         WHERE id = $1`,
        [user.id],
      );

      const result = await client.query(
        `SELECT updated_at FROM public.profiles WHERE id = $1`,
        [user.id],
      );

      const updatedAt = new Date(result.rows[0].updated_at);
      const yearOfUpdate = updatedAt.getFullYear();

      // The trigger should have overridden our '2020-01-01' with now()
      // now() is the transaction start time, which is 2026
      expect(yearOfUpdate).toBeGreaterThan(2020);
    });
  });

  it("triggers exist on all expected tables", async () => {
    await withTransaction(pool!, async (client) => {
      const result = await client.query(`
        SELECT event_object_table AS table_name, trigger_name
        FROM information_schema.triggers
        WHERE trigger_name LIKE 'set_updated_at_%'
        ORDER BY event_object_table
      `);

      const tables = result.rows.map(
        (r: { table_name: string }) => r.table_name,
      );
      expect(tables).toEqual(
        expect.arrayContaining([
          "groups",
          "leaderboard_cache",
          "matches",
          "predictions",
          "profiles",
        ]),
      );
    });
  });
});
