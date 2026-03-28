import { useEffect } from "react";
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

/**
 * Returns a SharedValue<number> that pulses between 0.3 and 0.7 opacity.
 * Apply with: useAnimatedStyle(() => ({ opacity: value.value }))
 */
export function useSkeletonAnimation(): SharedValue<number> {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared value is stable
  }, []);

  return opacity;
}
