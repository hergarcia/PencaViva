import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { View, TouchableOpacity } from "react-native";
import { ToastProvider, useToast } from "@components/Toast";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function TestConsumer() {
  const { showToast } = useToast();
  return (
    <View>
      <TouchableOpacity
        testID="show-error"
        onPress={() => showToast("error", "Something failed")}
      />
      <TouchableOpacity
        testID="show-success"
        onPress={() => showToast("success", "Saved!")}
      />
      <TouchableOpacity
        testID="show-info"
        onPress={() => showToast("info", "FYI")}
      />
    </View>
  );
}

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows error toast with message", () => {
    const { getByTestId, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();
  });

  it("shows success toast with message", () => {
    const { getByTestId, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-success"));
    expect(getByText("Saved!")).toBeTruthy();
  });

  it("auto-dismisses after duration", () => {
    const { getByTestId, getByText, queryByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    expect(queryByText("Something failed")).toBeNull();
  });

  it("replaces current toast with new one", () => {
    const { getByTestId, queryByText, getByText } = render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    fireEvent.press(getByTestId("show-error"));
    expect(getByText("Something failed")).toBeTruthy();

    fireEvent.press(getByTestId("show-success"));
    expect(queryByText("Something failed")).toBeNull();
    expect(getByText("Saved!")).toBeTruthy();
  });

  it("throws when useToast is used outside provider", () => {
    function BadConsumer() {
      useToast();
      return null;
    }

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BadConsumer />)).toThrow(
      "useToast must be used within a ToastProvider",
    );
    spy.mockRestore();
  });
});
