import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";
import { ExactStar } from "@components/common/ExactStar";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

interface PredictionHistoryRowProps {
  prediction: PlayerPredictionRecord;
}

function pointsColor(points: number): string {
  if (points >= 5) return colors.success;
  if (points >= 3) return colors.primary;
  return colors.textSecondary;
}

function rowBg(points: number): string {
  if (points >= 5) return "rgba(0, 196, 140, 0.08)";
  if (points >= 3) return "rgba(0, 212, 170, 0.06)";
  return "transparent";
}

export function PredictionHistoryRow({
  prediction,
}: PredictionHistoryRowProps) {
  const { match, points } = prediction;
  return (
    <View
      testID={`prediction-history-row-${prediction.id}`}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: rowBg(points),
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {match.tournament_short_name && (
        <Text
          style={{ color: colors.textSecondary, fontSize: 10, marginBottom: 2 }}
        >
          {match.tournament_short_name}
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "500",
            }}
            numberOfLines={1}
          >
            {match.home_team_name} vs {match.away_team_name}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginTop: 4,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Pred:
            </Text>
            <Text
              testID={`pred-score-${prediction.id}`}
              style={{
                color: colors.textPrimary,
                fontWeight: "600",
                fontSize: 12,
              }}
            >
              {prediction.home_score_pred} - {prediction.away_score_pred}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {`Result: ${match.home_score}-${match.away_score}`}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginLeft: 8,
          }}
        >
          {points >= 5 && <ExactStar size={12} />}
          <Text
            style={{
              color: pointsColor(points),
              fontWeight: "700",
              fontSize: 16,
            }}
          >
            +{points}
          </Text>
        </View>
      </View>
    </View>
  );
}
