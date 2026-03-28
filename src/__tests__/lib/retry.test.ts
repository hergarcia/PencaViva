import { withRetry, isTransientError } from "@lib/retry";

describe("withRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns result on first success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { baseDelay: 100 });

    // Advance past the first retry delay
    await jest.advanceTimersByTimeAsync(150);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all retries exhausted", async () => {
    const fn = jest.fn().mockImplementation(async () => {
      throw new Error("network error");
    });

    const promise = withRetry(fn, { maxRetries: 2, baseDelay: 100 });
    // Suppress unhandled rejection: attach a no-op catch so Node.js does not
    // emit PromiseRejectionHandledWarning before the assertion below.
    promise.catch(() => {});

    // Advance through both retry delays (100ms + 200ms)
    await jest.advanceTimersByTimeAsync(350);

    await expect(promise).rejects.toThrow("network error");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry on non-transient error", async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(new Error("row-level security violation"));

    await expect(withRetry(fn)).rejects.toThrow("row-level security");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry when custom shouldRetry returns false", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("custom error"));

    await expect(withRetry(fn, { shouldRetry: () => false })).rejects.toThrow(
      "custom error",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isTransientError", () => {
  it("returns false for RLS errors", () => {
    expect(isTransientError(new Error("row-level security"))).toBe(false);
  });

  it("returns false for validation errors", () => {
    expect(isTransientError(new Error("already_member"))).toBe(false);
    expect(isTransientError(new Error("group_not_found"))).toBe(false);
    expect(isTransientError(new Error("group_full"))).toBe(false);
  });

  it("returns true for network errors", () => {
    expect(isTransientError(new Error("network error"))).toBe(true);
    expect(isTransientError(new Error("Failed to fetch"))).toBe(true);
  });

  it("returns true for unknown errors", () => {
    expect(isTransientError(new Error("something unexpected"))).toBe(true);
  });
});
