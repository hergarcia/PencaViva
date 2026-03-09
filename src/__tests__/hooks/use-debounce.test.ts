import { renderHook, act } from "@testing-library/react-native";
import { useDebounce } from "@hooks/use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 500));
    expect(result.current).toBe("hello");
  });

  it("does not update value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("a");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe("ab");
  });

  it("resets timer on rapid changes and only emits final value", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "ab" });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    rerender({ value: "abc" });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    // Only 300ms since last change, should still be "a"
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(200);
    });
    // 500ms since last change ("abc"), should update
    expect(result.current).toBe("abc");
  });
});
