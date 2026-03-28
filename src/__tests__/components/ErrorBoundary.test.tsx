import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { GlobalErrorBoundary } from "@components/ErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("render crash");
  return <Text>Normal content</Text>;
}

describe("GlobalErrorBoundary", () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders children when no error", () => {
    const { getByText } = render(
      <GlobalErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </GlobalErrorBoundary>,
    );
    expect(getByText("Normal content")).toBeTruthy();
  });

  it("renders error UI when child throws", () => {
    const { getByText } = render(
      <GlobalErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </GlobalErrorBoundary>,
    );
    expect(getByText("Something went wrong")).toBeTruthy();
    expect(getByText("Restart")).toBeTruthy();
  });

  it("recovers when restart is pressed", () => {
    let shouldThrow = true;

    function DynamicChild() {
      if (shouldThrow) throw new Error("crash");
      return <Text>Recovered</Text>;
    }

    const { getByText } = render(
      <GlobalErrorBoundary>
        <DynamicChild />
      </GlobalErrorBoundary>,
    );

    expect(getByText("Restart")).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(getByText("Restart"));

    expect(getByText("Recovered")).toBeTruthy();
  });
});
