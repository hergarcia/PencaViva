import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import type { PredictionStatus } from "@lib/matches-service";

type PredictionBadgeProps = {
  status: PredictionStatus;
  predictedHome?: number | null;
  predictedAway?: number | null;
};

const STATUS_CONFIG = {
  predicted: {
    icon: "checkmark-circle" as const,
    color: colors.primary,
    label: "Predicted",
  },
  open: {
    icon: "ellipse-outline" as const,
    color: colors.textSecondary,
    label: "Open",
  },
  closed: {
    icon: "lock-closed" as const,
    color: colors.textSecondary,
    label: "Closed",
  },
} as const;

export function PredictionBadge({
  status,
  predictedHome,
  predictedAway,
}: PredictionBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <View style={{ alignItems: "flex-end" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={{ color: config.color, fontSize: 12, fontWeight: "500" }}>
          {config.label}
        </Text>
      </View>
      {status === "predicted" &&
        predictedHome != null &&
        predictedAway != null && (
          <Text
            style={{
              color: colors.primary,
              fontSize: 11,
              marginTop: 2,
              fontWeight: "600",
            }}
          >
            Your pick: {predictedHome}-{predictedAway}
          </Text>
        )}
    </View>
  );
}
