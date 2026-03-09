import {
  validateUsername,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
} from "@lib/profile-service";

// ── Mock Supabase with chainable builder ────────────────────────────

// Terminal methods that return the final result
const mockLimit = jest.fn();
const mockSingle = jest.fn();

// Build a self-referencing chain object
const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn(() => mockChain);
mockChain.eq = jest.fn(() => mockChain);
mockChain.neq = jest.fn(() => mockChain);
mockChain.limit = mockLimit;
mockChain.single = mockSingle;
mockChain.update = jest.fn(() => mockChain);

jest.mock("@lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => mockChain),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
      }),
    },
  },
}));

// Must import AFTER mock is set up
/* eslint-disable @typescript-eslint/no-require-imports */
const {
  checkUsernameAvailable,
  updateProfile,
  checkProfileComplete,
  uploadAvatar,
} = require("@lib/profile-service");
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
  // Re-bind chain methods after clearAllMocks
  mockChain.select = jest.fn(() => mockChain);
  mockChain.eq = jest.fn(() => mockChain);
  mockChain.neq = jest.fn(() => mockChain);
  mockChain.update = jest.fn(() => mockChain);
  mockChain.limit = mockLimit;
  mockChain.single = mockSingle;
});

// ── validateUsername ─────────────────────────────────────────────────

describe("validateUsername", () => {
  it("rejects usernames shorter than minimum length", () => {
    const result = validateUsername("ab");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain(`at least ${USERNAME_MIN_LENGTH}`);
  });

  it("rejects empty string", () => {
    const result = validateUsername("");
    expect(result.isValid).toBe(false);
  });

  it("rejects usernames longer than maximum length", () => {
    const result = validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1));
    expect(result.isValid).toBe(false);
    expect(result.error).toContain(`${USERNAME_MAX_LENGTH} characters or less`);
  });

  it("rejects usernames with special characters", () => {
    const invalidNames = [
      "user@name",
      "user name",
      "user-name",
      "user.name",
      "user!",
    ];
    for (const name of invalidNames) {
      const result = validateUsername(name);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("letters, numbers, and underscores");
    }
  });

  it("accepts valid usernames", () => {
    const validNames = [
      "abc",
      "user_123",
      "Player1",
      "my_user_name",
      "A".repeat(USERNAME_MAX_LENGTH),
    ];
    for (const name of validNames) {
      const result = validateUsername(name);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("accepts usernames with underscores", () => {
    const result = validateUsername("user_name_123");
    expect(result.isValid).toBe(true);
  });

  it("accepts username at exact minimum length", () => {
    const result = validateUsername("abc");
    expect(result.isValid).toBe(true);
  });

  it("accepts username at exact maximum length", () => {
    const result = validateUsername("a".repeat(USERNAME_MAX_LENGTH));
    expect(result.isValid).toBe(true);
  });
});

// ── checkUsernameAvailable ──────────────────────────────────────────

describe("checkUsernameAvailable", () => {
  it("returns true when no matching username found", async () => {
    mockLimit.mockReturnValueOnce({ data: [], error: null });
    const result = await checkUsernameAvailable("newuser", "user-123");
    expect(result).toBe(true);
  });

  it("returns false when username is taken", async () => {
    mockLimit.mockReturnValueOnce({
      data: [{ id: "other-user" }],
      error: null,
    });
    const result = await checkUsernameAvailable("taken", "user-123");
    expect(result).toBe(false);
  });

  it("throws on supabase error", async () => {
    mockLimit.mockReturnValueOnce({
      data: null,
      error: new Error("DB error"),
    });
    await expect(checkUsernameAvailable("test", "user-123")).rejects.toThrow(
      "DB error",
    );
  });
});

// ── updateProfile ───────────────────────────────────────────────────

describe("updateProfile", () => {
  it("resolves without error on success", async () => {
    // update().eq() chain: update returns chain, eq returns the final result
    mockChain.eq = jest.fn(() => ({ error: null }));

    await expect(
      updateProfile("user-123", {
        username: "newname",
        display_name: "New Name",
        favorite_team: "Nacional",
      }),
    ).resolves.toBeUndefined();
  });

  it("throws on supabase error", async () => {
    mockChain.eq = jest.fn(() => ({ error: new Error("Update failed") }));

    await expect(
      updateProfile("user-123", {
        username: "newname",
        display_name: "New Name",
      }),
    ).rejects.toThrow("Update failed");
  });
});

// ── checkProfileComplete ────────────────────────────────────────────

describe("checkProfileComplete", () => {
  it("returns false for default username pattern", async () => {
    mockSingle.mockReturnValueOnce({
      data: { username: "user_550e8400e29b" },
      error: null,
    });
    const result = await checkProfileComplete("some-id");
    expect(result).toBe(false);
  });

  it("returns true for custom username", async () => {
    mockSingle.mockReturnValueOnce({
      data: { username: "johndoe" },
      error: null,
    });
    const result = await checkProfileComplete("some-id");
    expect(result).toBe(true);
  });

  it("throws on supabase error", async () => {
    mockSingle.mockReturnValueOnce({
      data: null,
      error: new Error("Not found"),
    });
    await expect(checkProfileComplete("some-id")).rejects.toThrow("Not found");
  });
});

// ── uploadAvatar ─────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-require-imports */
describe("uploadAvatar", () => {
  let mockStorageUpload: jest.Mock;
  let mockStorageGetPublicUrl: jest.Mock;
  let mockStorageFrom: jest.Mock;

  beforeEach(() => {
    const { supabase } = require("@lib/supabase");
    mockStorageFrom = supabase.storage.from as jest.Mock;
    mockStorageUpload = jest.fn();
    mockStorageGetPublicUrl = jest.fn();
    mockStorageFrom.mockReturnValue({
      upload: mockStorageUpload,
      getPublicUrl: mockStorageGetPublicUrl,
    });

    global.fetch = jest.fn().mockResolvedValue({
      blob: jest
        .fn()
        .mockResolvedValue(new Blob(["img"], { type: "image/jpeg" })),
    }) as jest.Mock;
  });

  it("uploads blob and returns public URL", async () => {
    mockStorageUpload.mockResolvedValueOnce({ error: null });
    mockStorageGetPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://example.com/avatars/uid123/avatar.jpg" },
    });

    const url = await uploadAvatar("uid123", "file:///local/photo.jpg");

    expect(mockStorageFrom).toHaveBeenCalledWith("avatars");
    expect(mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^uid123\/\d+\.jpg$/),
      expect.any(Blob),
      { upsert: true, contentType: "image/jpeg" },
    );
    expect(url).toBe("https://example.com/avatars/uid123/avatar.jpg");
  });

  it("throws when storage upload fails", async () => {
    mockStorageUpload.mockResolvedValueOnce({
      error: new Error("Storage error"),
    });

    await expect(
      uploadAvatar("uid123", "file:///local/photo.jpg"),
    ).rejects.toThrow("Storage error");
  });
});
/* eslint-enable @typescript-eslint/no-require-imports */
