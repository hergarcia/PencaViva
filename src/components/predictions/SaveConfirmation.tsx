import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type SaveConfirmationProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function SaveConfirmation({
  visible,
  onDismiss,
}: SaveConfirmationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 10, stiffness: 200 });

      const timeout = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 });
        scale.value = withDelay(
          0,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished) runOnJS(onDismiss)();
          }),
        );
      }, 1500);

      return () => clearTimeout(timeout);
    } else {
      scale.value = 0;
      opacity.value = 0;
    }
  }, [visible, scale, opacity, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13, 13, 13, 0.7)",
  },
});
