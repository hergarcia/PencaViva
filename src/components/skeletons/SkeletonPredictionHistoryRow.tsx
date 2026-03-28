import React from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { colors } from "@lib/constants";
import { useSkeletonAnimation } from "./useSkeletonAnimation";

const SHAPE_COLOR = colors.surfaceBorder;

export function SkeletonPredictionHistoryRow() {
  const opacity = useSkeletonAnimation();
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID="skeleton-prediction-history-row"
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {/* Tournament */}
      <Animated.View
        style={[
          {
            width: "25%",
            height: 10,
            borderRadius: 5,
            backgroundColor: SHAPE_COLOR,
            marginBottom: 4,
          },
          animStyle,
        ]}
      />
      {/* Teams row */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
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
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 4,
              alignItems: "center",
            }}
          >
            <Animated.View
              style={[
                {
                  width: "20%",
                  height: 12,
                  borderRadius: 4,
                  backgroundColor: SHAPE_COLOR,
                },
                animStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  width: 30,
                  height: 12,
                  borderRadius: 4,
                  backgroundColor: SHAPE_COLOR,
                },
                animStyle,
              ]}
            />
            <Animated.View
              style={[
                {
                  width: "25%",
                  height: 12,
                  borderRadius: 4,
                  backgroundColor: SHAPE_COLOR,
                },
                animStyle,
              ]}
            />
          </View>
        </View>
        {/* Points */}
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: SHAPE_COLOR,
              marginLeft: 8,
            },
            animStyle,
          ]}
        />
      </View>
    </View>
  );
}
