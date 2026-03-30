import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { ExactStar } from "@components/common/ExactStar";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

// Visual config per podium position
const PODIUM_CONFIG: Record<
  number,
  {
    avatarSize: number;
    avatarBorder: string;
    letterColor: string;
    badgeBg: string;
    cardBg: string;
    leftBorder: string;
    pointsColor: string;
    ghostSize: number;
  }
> = {
  1: {
    avatarSize: 56,
    avatarBorder: "#FFB800",
    letterColor: "#FFB800",
    badgeBg: "#FFB800",
    cardBg: "rgba(255, 184, 0, 0.08)",
    leftBorder: colors.primary,
    pointsColor: "#FFB800",
    ghostSize: 64,
  },
  2: {
    avatarSize: 48,
    avatarBorder: "#85948D",
    letterColor: "#C0C0C0",
    badgeBg: "#85948D",
    cardBg: "rgba(229, 226, 225, 0.04)",
    leftBorder: "rgba(133, 148, 141, 0.3)",
    pointsColor: colors.textPrimary,
    ghostSize: 52,
  },
  3: {
    avatarSize: 48,
    avatarBorder: "rgba(205, 127, 50, 0.5)",
    letterColor: "#CD7F32",
    badgeBg: "#CD7F32",
    cardBg: "rgba(229, 226, 225, 0.04)",
    leftBorder: "rgba(133, 148, 141, 0.3)",
    pointsColor: colors.textPrimary,
    ghostSize: 52,
  },
};

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
  const podium = PODIUM_CONFIG[entry.position];
  const letter = entry.display_name.charAt(0).toUpperCase();

  // Glow animation
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

  // Stats text
  const statsText =
    entry.exact_scores > 0 || entry.correct_results > 0
      ? `${entry.matches_played} MATCHES | ${entry.exact_scores} EXACT | ${entry.correct_results} CORRECT`
      : `${entry.matches_played} MATCHES PLAYED`;

  // ── Podium card (positions 1-3) ──
  if (isPodium && podium) {
    return (
      <Pressable
        testID={`leaderboard-row-${entry.user_id}`}
        onPress={onPress}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          backgroundColor: podium.cardBg,
          borderLeftWidth: 3,
          borderLeftColor: podium.leftBorder,
          padding: 16,
          marginBottom: 12,
          marginHorizontal: 16,
        }}
      >
        {/* Animated glow overlay */}
        <Animated.View
          testID="position-glow-overlay"
          style={[StyleSheet.absoluteFillObject, glowStyle]}
          pointerEvents="none"
        />
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

        {/* Ghost position number watermark */}
        <Text
          style={{
            position: "absolute",
            top: 4,
            right: 8,
            fontSize: podium.ghostSize,
            fontWeight: "900",
            color: colors.textPrimary,
            opacity: 0.04,
          }}
        >
          {String(entry.position).padStart(2, "0")}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {/* Avatar with medal badge */}
          <View>
            <View
              style={{
                width: podium.avatarSize,
                height: podium.avatarSize,
                borderRadius: podium.avatarSize / 2,
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: podium.avatarBorder,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: podium.letterColor,
                  fontWeight: "700",
                  fontSize: podium.avatarSize * 0.36,
                }}
              >
                {letter}
              </Text>
            </View>
            {/* Medal badge */}
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: podium.badgeBg,
                borderWidth: 2,
                borderColor: colors.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="medal-outline" size={12} color="#FFF" />
            </View>
          </View>

          {/* Name + stats */}
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontWeight: "700",
                  fontSize: entry.position === 1 ? 18 : 16,
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {statsText}
              </Text>
              {entry.exact_scores > 0 && <ExactStar />}
            </View>
          </View>

          {/* Position change indicator */}
          {positionChange !== undefined && positionChange !== 0 && (
            <View style={{ alignItems: "center", marginRight: 2 }}>
              <Text
                testID={
                  positionChange > 0
                    ? "position-change-up"
                    : "position-change-down"
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
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                color: podium.pointsColor,
                fontWeight: "900",
                fontSize: entry.position === 1 ? 26 : 22,
              }}
            >
              {entry.total_points}
            </Text>
            <Text
              style={{
                color:
                  entry.position === 1
                    ? podium.pointsColor + "B3"
                    : colors.textSecondary,
                fontWeight: "700",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginTop: 1,
              }}
            >
              POINTS
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Competitor card (positions 4+) ──
  return (
    <Pressable
      testID={`leaderboard-row-${entry.user_id}`}
      onPress={onPress}
      style={{
        position: "relative",
        overflow: "hidden",
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
        borderLeftWidth: isCurrentUser ? 3 : 1,
        borderLeftColor: isCurrentUser
          ? colors.primary
          : "rgba(133, 148, 141, 0.08)",
      }}
    >
      {/* Animated glow overlay */}
      <Animated.View
        testID="position-glow-overlay"
        style={[StyleSheet.absoluteFillObject, glowStyle]}
        pointerEvents="none"
      />
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

      {/* Position number */}
      <Text
        style={{
          width: 28,
          textAlign: "center",
          color: colors.textSecondary,
          fontWeight: "900",
          fontSize: 14,
        }}
      >
        {String(entry.position).padStart(2, "0")}
      </Text>

      {/* Avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: "rgba(133, 148, 141, 0.15)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontWeight: "700",
            fontSize: 16,
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
              fontWeight: "700",
              fontSize: 14,
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 3,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 9,
              letterSpacing: 0.5,
              opacity: 0.7,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {statsText}
          </Text>
          {entry.exact_scores > 0 && <ExactStar size={12} />}
        </View>
      </View>

      {/* Position change indicator */}
      {positionChange !== undefined && positionChange !== 0 && (
        <View style={{ alignItems: "center", marginRight: 2 }}>
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
      <Text
        style={{
          color: colors.primary,
          fontWeight: "700",
          fontSize: 18,
        }}
      >
        {entry.total_points}
      </Text>
    </Pressable>
  );
}
