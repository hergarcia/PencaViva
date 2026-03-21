import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { colors } from "@lib/constants";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

// Medal config for top 3 positions
const MEDAL: Record<number, { emoji: string; bg: string }> = {
  1: { emoji: "🥇", bg: "rgba(255, 184, 0, 0.10)" },
  2: { emoji: "🥈", bg: "rgba(192, 192, 192, 0.08)" },
  3: { emoji: "🥉", bg: "rgba(205, 127, 50, 0.08)" },
};

// Cycle through accent colors for avatars
const AVATAR_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  "#E05C7F",
  "#4ECDC4",
];

function avatarColor(userId: string): string {
  // Stable color derived from last char of user ID
  const idx = userId.charCodeAt(userId.length - 1) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// Glow color per direction
const GLOW_COLOR_UP = "0, 196, 140"; // green
const GLOW_COLOR_DOWN = "255, 77, 106"; // red

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  positionChange?: number; // positive = moved up, negative = moved down
}

export function LeaderboardRow({
  entry,
  isCurrentUser,
  positionChange,
}: LeaderboardRowProps) {
  const medal = MEDAL[entry.position];
  const letter = entry.display_name.charAt(0).toUpperCase();
  const accentColor = avatarColor(entry.user_id);

  // Glow animation: triggered when positionChange is set
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (positionChange === undefined || positionChange === 0) return;
    // Flash: appear quickly (200ms), hold for 500ms, then fade out (800ms)
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(500, withTiming(0, { duration: 800 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionChange]);

  const glowStyle = useAnimatedStyle(() => ({
    backgroundColor:
      positionChange && positionChange !== 0
        ? `rgba(${positionChange > 0 ? GLOW_COLOR_UP : GLOW_COLOR_DOWN}, ${glowOpacity.value * 0.25})`
        : "transparent",
  }));

  const hasPositionChange =
    positionChange !== undefined && positionChange !== 0;

  return (
    <View
      testID={`leaderboard-row-${entry.user_id}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: medal ? medal.bg : "transparent",
        borderLeftWidth: isCurrentUser ? 3 : 0,
        borderLeftColor: colors.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
        overflow: "hidden",
      }}
    >
      {/* Animated glow overlay (absolute, behind content) */}
      {hasPositionChange && (
        <Animated.View
          testID={
            positionChange > 0 ? "position-glow-up" : "position-glow-down"
          }
          style={[StyleSheet.absoluteFillObject, glowStyle]}
          pointerEvents="none"
        />
      )}

      {/* Position */}
      <View style={{ width: 36, alignItems: "center" }}>
        {medal ? (
          <Text style={{ fontSize: 20 }}>{medal.emoji}</Text>
        ) : (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            #{entry.position}
          </Text>
        )}
      </View>

      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: accentColor + "33",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
          marginRight: 12,
        }}
      >
        <Text style={{ color: accentColor, fontWeight: "700", fontSize: 16 }}>
          {letter}
        </Text>
      </View>

      {/* Name + stats */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 15,
            }}
            numberOfLines={1}
          >
            {entry.display_name}
          </Text>
          {isCurrentUser && (
            <Text
              testID={`you-badge-${entry.user_id}`}
              style={{ color: colors.primary, fontSize: 11 }}
            >
              You
            </Text>
          )}
        </View>
        <Text
          style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}
          numberOfLines={1}
        >
          {entry.exact_scores > 0 || entry.correct_results > 0
            ? `${entry.matches_played} matches · ${entry.exact_scores} exact · ${entry.correct_results} correct`
            : `${entry.matches_played} matches played`}
        </Text>
      </View>

      {/* Points */}
      <Text
        style={{
          color: isCurrentUser ? colors.primary : colors.textPrimary,
          fontWeight: "700",
          fontSize: 18,
          marginLeft: 8,
        }}
      >
        {entry.total_points}
        <Text
          style={{
            color: colors.textSecondary,
            fontWeight: "400",
            fontSize: 12,
          }}
        >
          {" "}
          pts
        </Text>
      </Text>
    </View>
  );
}
