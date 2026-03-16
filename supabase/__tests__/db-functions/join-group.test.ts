import { pool, isSupabaseAvailable, closePool } from "../setup";
import {
  withTransaction,
  createTestUser,
  createTestGroup,
  setAuthContext,
  addGroupMember,
} from "../helpers";

afterAll(closePool);

const describeFn = isSupabaseAvailable ? describe : describe.skip;

describeFn("lookup_group_by_invite_code", () => {
  it("returns group preview for valid invite code", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client, { displayName: "Admin" });
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id, {
        name: "Test Group",
      });

      // Get the invite code that was created
      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      // Call as the searching user (not a member)
      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [inviteCode],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(groupId);
      expect(result.rows[0].name).toBe("Test Group");
      expect(Number(result.rows[0].member_count)).toBe(1); // admin only
      expect(result.rows[0].max_members).toBe(50);
      expect(result.rows[0].scoring_system).toBeDefined();
    });
  });

  it("is case-insensitive for invite code", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [inviteCode.toUpperCase()],
      );
      expect(result.rows).toHaveLength(1);
    });
  });

  it("raises group_not_found for invalid code", async () => {
    await withTransaction(pool!, async (client) => {
      const user = await createTestUser(client);
      await setAuthContext(client, user.id);

      await expect(
        client.query(`SELECT * FROM lookup_group_by_invite_code($1)`, [
          "ZZZZZZZZ",
        ]),
      ).rejects.toThrow("group_not_found");
    });
  });

  it("returns correct member count with multiple members", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const member1 = await createTestUser(client);
      const member2 = await createTestUser(client);
      const searcher = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);
      await addGroupMember(client, groupId, member1.id);
      await addGroupMember(client, groupId, member2.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, searcher.id);
      const result = await client.query(
        `SELECT * FROM lookup_group_by_invite_code($1)`,
        [codeResult.rows[0].invite_code],
      );
      expect(Number(result.rows[0].member_count)).toBe(3);
    });
  });
});

describeFn("join_group_by_code", () => {
  it("successfully joins a group as member", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const joiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id, {
        name: "Join Me",
      });

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );
      const inviteCode = codeResult.rows[0].invite_code;

      await setAuthContext(client, joiner.id);
      const result = await client.query(
        `SELECT * FROM join_group_by_code($1)`,
        [inviteCode],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(groupId);
      expect(result.rows[0].name).toBe("Join Me");

      // Verify membership was created
      const memberResult = await client.query(
        `SELECT role, is_active FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, joiner.id],
      );
      expect(memberResult.rows[0].role).toBe("member");
      expect(memberResult.rows[0].is_active).toBe(true);
    });
  });

  it("raises already_member for active member", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const member = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);
      await addGroupMember(client, groupId, member.id);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, member.id);
      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, [
          codeResult.rows[0].invite_code,
        ]),
      ).rejects.toThrow("already_member");
    });
  });

  it("raises group_full when group is at max capacity", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const joiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      // Set max_members to 1 (admin already fills it)
      await client.query(`UPDATE groups SET max_members = 1 WHERE id = $1`, [
        groupId,
      ]);

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, joiner.id);
      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, [
          codeResult.rows[0].invite_code,
        ]),
      ).rejects.toThrow("group_full");
    });
  });

  it("reactivates an inactive member instead of inserting", async () => {
    await withTransaction(pool!, async (client) => {
      const admin = await createTestUser(client);
      const rejoiner = await createTestUser(client);
      const { id: groupId } = await createTestGroup(client, admin.id);

      // Add then deactivate the user
      await addGroupMember(client, groupId, rejoiner.id);
      await client.query(
        `UPDATE group_members SET is_active = false WHERE group_id = $1 AND user_id = $2`,
        [groupId, rejoiner.id],
      );

      const codeResult = await client.query(
        `SELECT invite_code FROM groups WHERE id = $1`,
        [groupId],
      );

      await setAuthContext(client, rejoiner.id);
      const result = await client.query(
        `SELECT * FROM join_group_by_code($1)`,
        [codeResult.rows[0].invite_code],
      );
      expect(result.rows).toHaveLength(1);

      // Verify reactivated (not duplicate row)
      const memberResult = await client.query(
        `SELECT is_active, role FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, rejoiner.id],
      );
      expect(memberResult.rows).toHaveLength(1);
      expect(memberResult.rows[0].is_active).toBe(true);
      expect(memberResult.rows[0].role).toBe("member");
    });
  });

  it("raises group_not_found for invalid code", async () => {
    await withTransaction(pool!, async (client) => {
      const user = await createTestUser(client);
      await setAuthContext(client, user.id);

      await expect(
        client.query(`SELECT * FROM join_group_by_code($1)`, ["ZZZZZZZZ"]),
      ).rejects.toThrow("group_not_found");
    });
  });
});
