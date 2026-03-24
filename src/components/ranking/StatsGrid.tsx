import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

interface StatsGridProps {
  matchesPlayed: number;
  exactScores: number;
  correctResults: number;
  totalPoints: number;
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        paddingVertical: 12,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
      }}
    >
      <Text
        style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 20 }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export function StatsGrid({
  matchesPlayed,
  exactScores,
  correctResults,
  totalPoints,
}: StatsGridProps) {
  const avg =
    matchesPlayed > 0 ? (totalPoints / matchesPlayed).toFixed(1) : "0.0";
  return (
    <View testID="stats-grid" style={{ paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCell value={String(matchesPlayed)} label="Matches" />
        <StatCell value={String(exactScores)} label="Exact" />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatCell value={String(correctResults)} label="Correct" />
        <StatCell value={avg} label="Avg Pts" />
      </View>
    </View>
  );
}
