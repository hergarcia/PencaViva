import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[GlobalErrorBoundary]", error, info.componentStack);
  }

  handleRestart = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View
          testID="global-error-boundary"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            paddingHorizontal: 32,
          }}
        >
          <Ionicons name="warning-outline" size={64} color={colors.accent} />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "700",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            An unexpected error occurred. Please restart the app.
          </Text>
          <TouchableOpacity
            onPress={this.handleRestart}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 32,
              paddingVertical: 14,
              borderRadius: 12,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Restart
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
