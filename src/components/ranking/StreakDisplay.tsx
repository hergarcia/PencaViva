import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

interface StreakDisplayProps {
  currentStreak: { count: number; type: "correct" | "wrong" };
  bestStreak: number;
}

export function StreakDisplay({
  currentStreak,
  bestStreak,
}: StreakDisplayProps) {
  return (
    <View
      testID="streak-display"
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        padding: 16,
        gap: 8,
      }}
    >
      <Text
        style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}
      >
        STREAKS
      </Text>
      {currentStreak.count === 0 ? (
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          No streak yet
        </Text>
      ) : (
        <>
          <Text
            style={{
              color:
                currentStreak.type === "correct"
                  ? colors.success
                  : colors.textSecondary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {currentStreak.count} {currentStreak.type} in a row
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            Best: {bestStreak} correct in a row
          </Text>
        </>
      )}
    </View>
  );
}
