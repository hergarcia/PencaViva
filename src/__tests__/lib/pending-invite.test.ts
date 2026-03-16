import {
  savePendingInviteCode,
  getPendingInviteCode,
  clearPendingInviteCode,
} from "@lib/pending-invite";
import * as storage from "@lib/storage";

jest.mock("@lib/storage", () => ({
  setStorageItem: jest.fn(),
  getStorageItem: jest.fn(),
  deleteStorageItem: jest.fn(),
}));

const mockedStorage = jest.mocked(storage);

beforeEach(() => jest.clearAllMocks());

describe("pending-invite", () => {
  it("savePendingInviteCode calls setStorageItem with the correct key and code", async () => {
    mockedStorage.setStorageItem.mockResolvedValue(undefined);
    await savePendingInviteCode("ABC12345");
    expect(mockedStorage.setStorageItem).toHaveBeenCalledWith(
      "pending_invite_code",
      "ABC12345",
    );
  });

  it("getPendingInviteCode returns the stored code", async () => {
    mockedStorage.getStorageItem.mockResolvedValue("ABC12345");
    const result = await getPendingInviteCode();
    expect(mockedStorage.getStorageItem).toHaveBeenCalledWith(
      "pending_invite_code",
    );
    expect(result).toBe("ABC12345");
  });

  it("getPendingInviteCode returns null when nothing is stored", async () => {
    mockedStorage.getStorageItem.mockResolvedValue(null);
    const result = await getPendingInviteCode();
    expect(result).toBeNull();
  });

  it("clearPendingInviteCode calls deleteStorageItem with the correct key", async () => {
    mockedStorage.deleteStorageItem.mockResolvedValue(undefined);
    await clearPendingInviteCode();
    expect(mockedStorage.deleteStorageItem).toHaveBeenCalledWith(
      "pending_invite_code",
    );
  });
});
