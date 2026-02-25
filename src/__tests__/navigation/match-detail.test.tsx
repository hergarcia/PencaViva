import React from "react";
import { render, screen } from "@testing-library/react-native";
import MatchDetailScreen from "../../../app/match/[id]";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({ id: "42" }),
  };
});

describe("MatchDetailScreen", () => {
  it("renders match detail with id from params", () => {
    render(<MatchDetailScreen />);
    expect(screen.getByText("Partido")).toBeTruthy();
    expect(screen.getByText("Detalle del partido 42")).toBeTruthy();
  });
});
