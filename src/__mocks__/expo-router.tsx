import React from "react";
import { View, Text } from "react-native";

function Redirect({ href }: { href: string }) {
  return <Text testID="mock-redirect">{`Redirect to ${href}`}</Text>;
}

function Tabs({ children }: { children?: React.ReactNode }) {
  return <View testID="mock-tabs">{children}</View>;
}

function TabsScreen(
  _props: { name?: string; options?: Record<string, unknown> } & {
    key?: string;
  },
) {
  return null;
}

Tabs.Screen = TabsScreen;

function Stack({ children }: { children?: React.ReactNode }) {
  return <View testID="mock-stack">{children}</View>;
}

function StackScreen(
  _props: { name?: string; options?: Record<string, unknown> } & {
    key?: string;
  },
) {
  return null;
}

Stack.Screen = StackScreen;

function Slot() {
  return <View testID="mock-slot" />;
}

function useRouter() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  };
}

function useLocalSearchParams() {
  return {};
}

function useSegments() {
  return [];
}

export {
  Redirect,
  Tabs,
  Stack,
  Slot,
  useRouter,
  useLocalSearchParams,
  useSegments,
};
