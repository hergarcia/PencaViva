import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { colors } from "@lib/constants";
import { useSkeletonAnimation } from "./useSkeletonAnimation";

const SHAPE_COLOR = colors.surfaceBorder;

export function SkeletonMemberRow() {
  const opacity = useSkeletonAnimation();
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="skeleton-member-row"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {/* Avatar */}
      <Animated.View
        style={[
          {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: SHAPE_COLOR,
            marginRight: 12,
          },
          animStyle,
        ]}
      />
      {/* Name + username */}
      <View style={{ flex: 1, gap: 4 }}>
        <Animated.View
          style={[
            {
              width: "50%",
              height: 15,
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
      {/* Role */}
      <Animated.View
        style={[
          {
            width: 40,
            height: 12,
            borderRadius: 4,
            backgroundColor: SHAPE_COLOR,
          },
          animStyle,
        ]}
      />
    </View>
  );
}
