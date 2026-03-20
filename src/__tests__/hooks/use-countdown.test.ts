import { renderHook, act } from "@testing-library/react-native";

/* eslint-disable @typescript-eslint/no-require-imports */
const { useCountdown } = require("@hooks/use-countdown");
/* eslint-enable @typescript-eslint/no-require-imports */

describe("useCountdown", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns expired state when targetDate is null", () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.formatted).toBe("");
  });

  it("returns expired state when targetDate is in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const { result } = renderHook(() => useCountdown(past));
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.formatted).toBe("");
  });

  it("returns correct secondsRemaining for future date", () => {
    const future = new Date(Date.now() + 7200_000).toISOString(); // 2h
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.secondsRemaining).toBeGreaterThan(7190);
    expect(result.current.isExpired).toBe(false);
  });

  it("formats > 1h as 'Xh Ym'", () => {
    const future = new Date(
      Date.now() + 2 * 3600_000 + 34 * 60_000,
    ).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toMatch(/^\d+h \d+m$/);
  });

  it("formats exactly 3600s as '1h 0m' not '60m 0s'", () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toBe("1h 0m");
  });

  it("formats 1m–1h as 'Xm Ys'", () => {
    const future = new Date(Date.now() + 4 * 60_000 + 23_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toMatch(/^\d+m \d+s$/);
  });

  it("formats < 1m as 'Xs'", () => {
    const future = new Date(Date.now() + 42_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    expect(result.current.formatted).toBe("42s");
  });

  it("ticks down every second", () => {
    const future = new Date(Date.now() + 10_000).toISOString();
    const { result } = renderHook(() => useCountdown(future));
    const initial = result.current.secondsRemaining;
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current.secondsRemaining).toBeLessThanOrEqual(initial - 3);
  });

  it("clears interval on unmount", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const future = new Date(Date.now() + 60_000).toISOString();
    const { unmount } = renderHook(() => useCountdown(future));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("restarts interval when targetDate changes", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const future1 = new Date(Date.now() + 60_000).toISOString();
    const future2 = new Date(Date.now() + 120_000).toISOString();
    const { rerender } = renderHook(
      ({ date }: { date: string }) => useCountdown(date),
      { initialProps: { date: future1 } },
    );
    const callsBefore = clearIntervalSpy.mock.calls.length;
    rerender({ date: future2 });
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    clearIntervalSpy.mockRestore();
  });
});
