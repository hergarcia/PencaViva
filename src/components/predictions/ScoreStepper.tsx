import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@lib/constants";

type ScoreStepperProps = {
  teamName: string;
  teamLogo: string | null;
  score: number;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
  minScore?: number;
  maxScore?: number;
};

function TeamLogoSmall({ uri, name }: { uri: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 28, height: 28, borderRadius: 14 }}
      />
    );
  }
  const initial = name[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "600" }}
      >
        {initial}
      </Text>
    </View>
  );
}

export function ScoreStepper({
  teamName,
  teamLogo,
  score,
  onIncrement,
  onDecrement,
  disabled = false,
  minScore = 0,
  maxScore = 20,
}: ScoreStepperProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1.2, { damping: 8, stiffness: 300 });
    const timeout = setTimeout(() => {
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
    }, 100);
    return () => clearTimeout(timeout);
  }, [score, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const canDecrement = !disabled && score > minScore;
  const canIncrement = !disabled && score < maxScore;

  const handleDecrement = () => {
    if (!canDecrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement();
  };

  const handleIncrement = () => {
    if (!canIncrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncrement();
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 4,
      }}
    >
      {/* Team */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          gap: 10,
        }}
      >
        <TeamLogoSmall uri={teamLogo} name={teamName} />
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 15,
            fontWeight: "500",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {teamName}
        </Text>
      </View>

      {/* Stepper controls */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity
          testID="decrement-btn"
          onPress={handleDecrement}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: canDecrement
              ? colors.surface
              : colors.surfaceBorder,
            borderWidth: 1,
            borderColor: canDecrement
              ? colors.textSecondary
              : colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={canDecrement ? 0.7 : 1}
        >
          <Text
            style={{
              color: canDecrement ? colors.textPrimary : colors.textSecondary,
              fontSize: 22,
              fontWeight: "600",
              marginTop: -2,
            }}
          >
            −
          </Text>
        </TouchableOpacity>

        <Animated.View
          style={[{ width: 40, alignItems: "center" }, animatedStyle]}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: "700",
            }}
          >
            {score}
          </Text>
        </Animated.View>

        <TouchableOpacity
          testID="increment-btn"
          onPress={handleIncrement}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: canIncrement
              ? colors.surface
              : colors.surfaceBorder,
            borderWidth: 1,
            borderColor: canIncrement
              ? colors.textSecondary
              : colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
          activeOpacity={canIncrement ? 0.7 : 1}
        >
          <Text
            style={{
              color: canIncrement ? colors.textPrimary : colors.textSecondary,
              fontSize: 22,
              fontWeight: "600",
              marginTop: -2,
            }}
          >
            +
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
