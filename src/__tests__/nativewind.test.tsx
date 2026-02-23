import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text, View } from "react-native";

function TailwindBox() {
  return (
    <View className="flex-1 items-center justify-center bg-[#0D0D0D]">
      <Text className="text-xl font-bold text-[#00D4AA]">PencaViva</Text>
    </View>
  );
}

function ThemedCard() {
  return (
    <View className="rounded-2xl bg-[#1A1A2E] p-4">
      <Text className="text-base text-white">Match Day</Text>
      <Text className="text-sm text-[#7C5CFC]">Predictions open</Text>
    </View>
  );
}

describe("NativeWind v5 Integration", () => {
  it("renders a component with Tailwind className without crashing", () => {
    render(<TailwindBox />);
    expect(screen.getByText("PencaViva")).toBeTruthy();
  });

  it("accepts className prop on View and Text components", () => {
    const { getByText } = render(
      <View className="p-4">
        <Text className="text-lg">Hello Tailwind</Text>
      </View>,
    );
    expect(getByText("Hello Tailwind")).toBeTruthy();
  });

  it("renders themed card with design token colors", () => {
    render(<ThemedCard />);
    expect(screen.getByText("Match Day")).toBeTruthy();
    expect(screen.getByText("Predictions open")).toBeTruthy();
  });

  it("imports global.css without crashing", () => {
    // Verify the CSS mock works — importing global.css should not throw
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(() => require("../../global.css")).not.toThrow();
  });
});
