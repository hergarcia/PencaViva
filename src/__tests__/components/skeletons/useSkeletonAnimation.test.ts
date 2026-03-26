import { renderHook } from "@testing-library/react-native";
import { useSkeletonAnimation } from "@components/skeletons/useSkeletonAnimation";

describe("useSkeletonAnimation", () => {
  it("returns a shared value with numeric value", () => {
    const { result } = renderHook(() => useSkeletonAnimation());
    expect(result.current).toHaveProperty("value");
    expect(typeof result.current.value).toBe("number");
  });
});
