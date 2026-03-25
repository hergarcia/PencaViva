import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { colors } from "@lib/constants";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

// Position badge colors for top 3
const POSITION_BADGE: Record<
  number,
  { bg: string; text: string; rowBg: string }
> = {
  1: {
    bg: "rgba(255, 184, 0, 0.20)",
    text: "#FFB800",
    rowBg: "rgba(255, 184, 0, 0.06)",
  },
  2: {
    bg: "rgba(192, 192, 192, 0.20)",
    text: "#C0C0C0",
    rowBg: "rgba(192, 192, 192, 0.05)",
  },
  3: {
    bg: "rgba(205, 127, 50, 0.20)",
    text: "#CD7F32",
    rowBg: "rgba(205, 127, 50, 0.05)",
  },
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
  const idx = userId.charCodeAt(userId.length - 1) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  positionChange?: number;
  onPress?: () => void;
}

export function LeaderboardRow({
  entry,
  isCurrentUser,
  positionChange,
  onPress,
}: LeaderboardRowProps) {
  const isPodium = entry.position <= 3;
  const badge = POSITION_BADGE[entry.position];
  const letter = entry.display_name.charAt(0).toUpperCase();
  const accentColor = avatarColor(entry.user_id);

  // Glow animation: P0-2 fix — store direction in shared value, always render overlay
  const glowDirection = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (!positionChange || positionChange === 0) return;
    glowDirection.value = positionChange > 0 ? 1 : -1;
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(500, withTiming(0, { duration: 800 })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [positionChange]);

  const glowStyle = useAnimatedStyle(() => ({
    backgroundColor:
      glowDirection.value !== 0
        ? `rgba(${glowDirection.value > 0 ? colors.successRgb : colors.dangerRgb}, ${glowOpacity.value * 0.25})`
        : "transparent",
  }));

  // Stats text — uppercase pipe-separated
  const statsText =
    entry.exact_scores > 0 || entry.correct_results > 0
      ? `${entry.matches_played} MATCHES | ${entry.exact_scores} EXACT | ${entry.correct_results} CORRECT`
      : `${entry.matches_played} MATCHES PLAYED`;

  return (
    <Pressable
      testID={`leaderboard-row-${entry.user_id}`}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: isPodium ? 14 : 12,
        paddingHorizontal: 16,
        backgroundColor: badge ? badge.rowBg : "transparent",
        borderLeftWidth: isCurrentUser ? 3 : 0,
        borderLeftColor: colors.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
        overflow: "hidden",
      }}
    >
      {/* Animated glow overlay (always mounted for animation continuity) */}
      <Animated.View
        testID="position-glow-overlay"
        style={[StyleSheet.absoluteFillObject, glowStyle]}
        pointerEvents="none"
      />
      {/* Directional testID markers for test assertions */}
      {positionChange !== undefined && positionChange > 0 && (
        <View
          testID="position-glow-up"
          style={{ position: "absolute", width: 0, height: 0 }}
        />
      )}
      {positionChange !== undefined && positionChange < 0 && (
        <View
          testID="position-glow-down"
          style={{ position: "absolute", width: 0, height: 0 }}
        />
      )}

      {/* Position badge */}
      <View style={{ width: 36, alignItems: "center" }}>
        {badge ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: badge.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: badge.text,
                fontSize: 13,
                fontWeight: "800",
              }}
            >
              {entry.position}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {String(entry.position).padStart(2, "0")}
          </Text>
        )}
      </View>

      {/* Avatar */}
      <View
        style={{
          width: isPodium ? 44 : 36,
          height: isPodium ? 44 : 36,
          borderRadius: isPodium ? 22 : 18,
          backgroundColor: accentColor + "33",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
          marginRight: 12,
        }}
      >
        <Text
          style={{
            color: accentColor,
            fontWeight: "700",
            fontSize: isPodium ? 18 : 14,
          }}
        >
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
              fontSize: isPodium ? 16 : 15,
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
          style={{
            color: colors.textSecondary,
            fontSize: 10,
            marginTop: 3,
            letterSpacing: 0.3,
          }}
          numberOfLines={1}
        >
          {statsText}
        </Text>
      </View>

      {/* Position change indicator */}
      {positionChange !== undefined && positionChange !== 0 && (
        <View style={{ alignItems: "center", marginRight: 6 }}>
          <Text
            testID={
              positionChange > 0 ? "position-change-up" : "position-change-down"
            }
            style={{
              color: positionChange > 0 ? colors.success : colors.danger,
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {positionChange > 0
              ? `▲${positionChange}`
              : `▼${Math.abs(positionChange)}`}
          </Text>
        </View>
      )}

      {/* Points */}
      <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
        <Text
          style={{
            color: isCurrentUser ? colors.primary : colors.textPrimary,
            fontWeight: "700",
            fontSize: isPodium ? 22 : 18,
          }}
        >
          {entry.total_points}
        </Text>
        {isPodium && (
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "500",
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginTop: 1,
            }}
          >
            POINTS
          </Text>
        )}
      </View>
    </Pressable>
  );
}
