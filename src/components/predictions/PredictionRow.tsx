import React from "react";
import { View, Text, Image } from "react-native";
import { colors } from "@lib/constants";
import type { GroupPrediction } from "@lib/prediction-service";
import type { PredictionStatus } from "@lib/scoring-utils";

type PredictionRowProps = {
  prediction: GroupPrediction;
  rank: number | null;
  status: PredictionStatus | null;
  potentialPoints: number | null;
  isCurrentUser: boolean;
  isFinished: boolean;
};

const STATUS_LABELS: Record<PredictionStatus, string> = {
  exact: "Exact!",
  correct_result_and_diff: "Result + diff",
  correct_result: "Correct result",
  wrong: "Wrong",
};

const STATUS_COLORS: Record<PredictionStatus, string> = {
  exact: colors.primary,
  correct_result_and_diff: colors.accent,
  correct_result: colors.accent,
  wrong: "#555555",
};

const RANK_COLORS: Record<number, string> = {
  1: colors.accent, // gold
  2: "#C0C0C0", // silver
  3: "#CD7F32", // bronze
};

export function PredictionRow({
  prediction,
  rank,
  status,
  potentialPoints,
  isCurrentUser,
  isFinished,
}: PredictionRowProps) {
  const hasPrediction =
    prediction.homeScorePred !== null && prediction.awayScorePred !== null;

  const isExact = status === "exact";
  const isNoPrediction = !hasPrediction;

  // Row background
  const rowBg = isExact
    ? "#0D2E27"
    : isCurrentUser
      ? "#1F1F35"
      : colors.surface;

  // Row border
  const borderStyle = isExact
    ? { borderWidth: 1, borderColor: `${colors.primary}33` }
    : isCurrentUser
      ? { borderWidth: 1, borderColor: `${colors.secondary}44` }
      : {};

  const statusColor = status ? STATUS_COLORS[status] : "#555555";

  return (
    <View
      testID={`prediction-row-${prediction.userId}`}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          padding: 10,
          paddingHorizontal: 12,
          backgroundColor: rowBg,
          borderRadius: 10,
          marginBottom: 6,
          opacity: isNoPrediction ? 0.4 : 1,
        },
        borderStyle,
      ]}
    >
      {/* Rank number (finished only) */}
      {isFinished && (
        <Text
          style={{
            width: 20,
            color: rank ? (RANK_COLORS[rank] ?? "#555555") : "#555555",
            fontSize: 13,
            fontWeight: "700",
            marginRight: 8,
          }}
        >
          {rank ?? "\u2013"}
        </Text>
      )}

      {/* Avatar */}
      {prediction.avatarUrl ? (
        <Image
          source={{ uri: prediction.avatarUrl }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            marginRight: 10,
          }}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isCurrentUser
              ? colors.primary
              : isNoPrediction
                ? "#333333"
                : colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Text
            style={{
              color: isCurrentUser ? colors.background : colors.textPrimary,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {prediction.displayName[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}

      {/* Name + prediction */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: isCurrentUser
              ? colors.secondary
              : isNoPrediction
                ? "#888888"
                : colors.textPrimary,
            fontSize: 14,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {isCurrentUser ? "You" : prediction.displayName}
        </Text>
        <Text
          style={{
            color: isNoPrediction
              ? "#555555"
              : isFinished && status
                ? "#888888"
                : colors.textPrimary,
            fontSize: 13,
            marginTop: 1,
          }}
        >
          {hasPrediction
            ? isFinished && status
              ? `${prediction.homeScorePred} \u2013 ${prediction.awayScorePred} \u00B7 ${STATUS_LABELS[status]}`
              : `${prediction.homeScorePred} \u2013 ${prediction.awayScorePred}`
            : "No prediction"}
        </Text>
      </View>

      {/* Points / Status */}
      {hasPrediction && status && (
        <View style={{ alignItems: "flex-end" }}>
          {isFinished ? (
            // Finished: show final points
            rank === 1 ? (
              <View
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.background,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  +{potentialPoints ?? 0}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  color:
                    (potentialPoints ?? 0) > 0 ? colors.primary : "#555555",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                +{potentialPoints ?? 0}
              </Text>
            )
          ) : (
            // Live: show status label + "would be +N"
            <>
              <Text
                style={{
                  color: statusColor,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {STATUS_LABELS[status]}
              </Text>
              <Text
                style={{
                  color: statusColor,
                  fontSize: 11,
                  opacity: 0.7,
                  marginTop: 1,
                }}
              >
                would be +{potentialPoints ?? 0}
              </Text>
            </>
          )}
        </View>
      )}

      {/* No prediction indicator */}
      {isNoPrediction && (
        <Text style={{ color: "#555555", fontSize: 13 }}>{"\u2013"}</Text>
      )}
    </View>
  );
}
