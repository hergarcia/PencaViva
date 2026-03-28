import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { colors } from "@lib/constants";
import { useSkeletonAnimation } from "./useSkeletonAnimation";

const SHAPE_COLOR = colors.surfaceBorder;

export function SkeletonLeaderboardRow() {
  const opacity = useSkeletonAnimation();
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="skeleton-leaderboard-row"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 14,
        borderRadius: 16,
        backgroundColor: "#1C1B1B",
        borderWidth: 1,
        borderColor: "rgba(133, 148, 141, 0.08)",
        marginBottom: 8,
        marginHorizontal: 16,
      }}
    >
      {/* Rank */}
      <Animated.View
        style={[
          {
            width: 28,
            height: 14,
            borderRadius: 4,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />
      {/* Avatar */}
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />
      {/* Name + stats */}
      <View style={{ flex: 1, gap: 6 }}>
        <Animated.View
          style={[
            {
              width: "50%",
              height: 14,
              borderRadius: 8,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              width: "70%",
              height: 9,
              borderRadius: 4,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
      </View>
      {/* Points */}
      <Animated.View
        style={[
          {
            width: 32,
            height: 18,
            borderRadius: 4,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />
    </View>
  );
}
