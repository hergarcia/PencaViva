import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@lib/constants";
import type { ScoringSystem } from "@lib/groups-service";

export interface ScoringPreset {
  key: string;
  label: string;
  description: string;
  values: ScoringSystem;
}

interface Props {
  preset: ScoringPreset;
  selected: boolean;
  onPress: () => void;
}

export function ScoringPresetCard({ preset, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.surfaceBorder,
        backgroundColor: selected ? colors.primary + "1A" : colors.surface,
        padding: 16,
        marginBottom: 12,
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={preset.label}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <Text
          style={{
            color: selected ? colors.primary : colors.textPrimary,
            fontWeight: "600",
            fontSize: 15,
          }}
        >
          {preset.label}
        </Text>
        {selected && (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              ✓
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}
      >
        {preset.description}
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Exact:{" "}
          <Text style={{ color: colors.textPrimary }}>
            {preset.values.exact_score}pt
          </Text>
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Result:{" "}
          <Text style={{ color: colors.textPrimary }}>
            {preset.values.correct_result}pt
          </Text>
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Diff:{" "}
          <Text style={{ color: colors.textPrimary }}>
            {preset.values.correct_goal_diff}pt
          </Text>
        </Text>
      </View>
    </Pressable>
  );
}
