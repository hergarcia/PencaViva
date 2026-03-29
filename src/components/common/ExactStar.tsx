import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

interface ExactStarProps {
  size?: number;
  animated?: boolean;
}

export function ExactStar({ size = 14, animated = false }: ExactStarProps) {
  const scale = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (animated) {
      scale.value = withSpring(1, { damping: 8, stiffness: 200 });
    }
  }, [animated, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (animated) {
    return (
      <Animated.View testID="exact-star" style={animatedStyle}>
        <Ionicons name="star" size={size} color={colors.accent} />
      </Animated.View>
    );
  }

  return (
    <View testID="exact-star">
      <Ionicons name="star" size={size} color={colors.accent} />
    </View>
  );
}
