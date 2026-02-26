import * as SecureStoreMock from "expo-secure-store";
import { secureStoreAdapter } from "@lib/secure-store-adapter";

const { __resetStore } = SecureStoreMock as typeof SecureStoreMock & {
  __resetStore: () => void;
};

beforeEach(() => {
  __resetStore();
});

describe("secureStoreAdapter", () => {
  describe("small values (no chunking)", () => {
    it("stores and retrieves a value", () => {
      secureStoreAdapter.setItem("token", "abc123");
      expect(secureStoreAdapter.getItem("token")).toBe("abc123");
    });

    it("returns null for a missing key", () => {
      expect(secureStoreAdapter.getItem("nonexistent")).toBeNull();
    });

    it("removes a value", () => {
      secureStoreAdapter.setItem("token", "abc123");
      secureStoreAdapter.removeItem("token");
      expect(secureStoreAdapter.getItem("token")).toBeNull();
    });

    it("stores an empty string", () => {
      secureStoreAdapter.setItem("empty", "");
      expect(secureStoreAdapter.getItem("empty")).toBe("");
    });
  });

  describe("large values (chunking)", () => {
    const largeValue = "x".repeat(4000);

    it("stores and retrieves a large value via chunks", () => {
      secureStoreAdapter.setItem("session", largeValue);
      expect(secureStoreAdapter.getItem("session")).toBe(largeValue);
    });

    it("removes all chunks when removing a large value", () => {
      secureStoreAdapter.setItem("session", largeValue);
      secureStoreAdapter.removeItem("session");
      expect(secureStoreAdapter.getItem("session")).toBeNull();
    });

    it("transitions from chunked to non-chunked value", () => {
      secureStoreAdapter.setItem("session", largeValue);
      secureStoreAdapter.setItem("session", "small");
      expect(secureStoreAdapter.getItem("session")).toBe("small");
    });

    it("transitions from non-chunked to chunked value", () => {
      secureStoreAdapter.setItem("session", "small");
      secureStoreAdapter.setItem("session", largeValue);
      expect(secureStoreAdapter.getItem("session")).toBe(largeValue);
    });
  });

  describe("edge cases", () => {
    it("returns null when a chunk is missing (corrupted state)", () => {
      // Manually set count but skip chunk_1 to simulate corruption
      SecureStoreMock.setItem("broken__count", "3");
      SecureStoreMock.setItem("broken__chunk_0", "aaa");
      // chunk_1 missing
      expect(secureStoreAdapter.getItem("broken")).toBeNull();
    });
  });
});
