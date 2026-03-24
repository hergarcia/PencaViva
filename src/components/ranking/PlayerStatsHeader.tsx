import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const AVATAR_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  "#E05C7F",
  "#4ECDC4",
];

interface PlayerStatsHeaderProps {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  userId: string;
  position: number;
  totalPoints: number;
}

export function PlayerStatsHeader({
  displayName,
  username,
  userId,
  position,
  totalPoints,
}: PlayerStatsHeaderProps) {
  const letter = displayName.charAt(0).toUpperCase();
  const accentColor =
    AVATAR_COLORS[userId.charCodeAt(userId.length - 1) % AVATAR_COLORS.length];
  const medal = MEDAL[position];

  return (
    <View
      testID="player-stats-header"
      style={{
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: accentColor + "33",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: accentColor, fontWeight: "700", fontSize: 28 }}>
          {letter}
        </Text>
      </View>
      <Text
        style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 20 }}
      >
        {displayName}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
        @{username}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {medal ?? `#${position}`}
          </Text>
        </View>
        <Text
          style={{ color: colors.primary, fontWeight: "700", fontSize: 24 }}
        >
          {totalPoints}
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "400",
              fontSize: 14,
            }}
          >
            {" "}
            pts
          </Text>
        </Text>
      </View>
    </View>
  );
}
