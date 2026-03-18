import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";

type DateSectionHeaderProps = {
  title: string;
};

export function DateSectionHeader({ title }: DateSectionHeaderProps) {
  return (
    <View style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
    </View>
  );
}
