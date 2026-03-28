import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
};

export function ErrorState({
  message,
  title = "Something went wrong",
  onRetry,
  icon = "alert-circle-outline",
}: ErrorStateProps) {
  return (
    <View
      testID="error-state"
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
    >
      <Ionicons
        testID="error-state-icon"
        name={icon}
        size={48}
        color={colors.accent}
      />
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginTop: 12,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 14,
          marginTop: 4,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          testID="retry-button"
          onPress={onRetry}
          style={{
            backgroundColor: colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 10,
            borderRadius: 20,
            marginTop: 16,
          }}
        >
          <Text style={{ color: colors.background, fontWeight: "600" }}>
            Try again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
