import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { colors } from "@lib/constants";
import { useSkeletonAnimation } from "./useSkeletonAnimation";

const SHAPE_COLOR = colors.surfaceBorder;

export function SkeletonMatchCard() {
  const opacity = useSkeletonAnimation();
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="skeleton-match-card"
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
    >
      {/* Tournament bar */}
      <Animated.View
        style={[
          {
            width: "40%",
            height: 10,
            borderRadius: 5,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />

      {/* Team rows */}
      <View style={{ marginTop: 12, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Animated.View
            style={[
              {
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: SHAPE_COLOR,
              },
              animStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: "60%",
                height: 14,
                borderRadius: 8,
                backgroundColor: SHAPE_COLOR,
              },
              animStyle,
            ]}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Animated.View
            style={[
              {
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: SHAPE_COLOR,
              },
              animStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: "55%",
                height: 14,
                borderRadius: 8,
                backgroundColor: SHAPE_COLOR,
              },
              animStyle,
            ]}
          />
        </View>
      </View>

      {/* Bottom row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <Animated.View
          style={[
            {
              width: "30%",
              height: 10,
              borderRadius: 5,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              width: 50,
              height: 20,
              borderRadius: 10,
              backgroundColor: SHAPE_COLOR,
            },
            animStyle,
          ]}
        />
      </View>
    </View>
  );
}
