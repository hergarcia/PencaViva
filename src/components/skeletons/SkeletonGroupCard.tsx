import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { colors } from "@lib/constants";
import { useSkeletonAnimation } from "./useSkeletonAnimation";

const SHAPE_COLOR = colors.surfaceBorder;

export function SkeletonGroupCard() {
  const opacity = useSkeletonAnimation();
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="skeleton-group-card"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {/* Avatar */}
      <Animated.View
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />
      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12, gap: 4 }}>
        <Animated.View
          style={[
            {
              width: "60%",
              height: 16,
              borderRadius: 8,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              width: "80%",
              height: 13,
              borderRadius: 8,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              width: "30%",
              height: 12,
              borderRadius: 8,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
      </View>
    </View>
  );
}
