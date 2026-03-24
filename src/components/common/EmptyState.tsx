import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type EmptyStateAction = {
  label: string;
  onPress: () => void;
  variant: "primary" | "outline";
};

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconSize?: number;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
};

export function EmptyState({
  icon,
  iconSize = 48,
  title,
  description,
  actions,
}: EmptyStateProps) {
  return (
    <View
      testID="empty-state"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <Ionicons
        testID="empty-state-icon"
        name={icon}
        size={iconSize}
        color={colors.textSecondary}
      />
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "600",
          marginTop: 16,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          testID="empty-state-description"
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {description}
        </Text>
      )}
      {actions && actions.length > 0 && (
        <View style={{ marginTop: 24, width: "100%", gap: 12 }}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              onPress={action.onPress}
              style={
                action.variant === "primary"
                  ? {
                      backgroundColor: colors.primary,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                    }
                  : {
                      backgroundColor: colors.surface,
                      paddingVertical: 14,
                      borderRadius: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: colors.surfaceBorder,
                    }
              }
            >
              <Text
                style={{
                  color:
                    action.variant === "primary"
                      ? colors.background
                      : colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
