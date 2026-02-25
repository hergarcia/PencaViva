import React from "react";
import { render, screen } from "@testing-library/react-native";
import GroupDetailScreen from "../../../app/(tabs)/groups/[id]";
import CreateGroupScreen from "../../../app/(tabs)/groups/create";
import JoinGroupScreen from "../../../app/(tabs)/groups/join";

jest.mock("expo-router", () => {
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    useLocalSearchParams: () => ({ id: "7" }),
  };
});

describe("Group nested screens", () => {
  it("renders group detail with id", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByText("Grupo")).toBeTruthy();
    expect(screen.getByText("Detalle del grupo 7")).toBeTruthy();
  });

  it("renders create group screen", () => {
    render(<CreateGroupScreen />);
    expect(screen.getByText("Crear Grupo")).toBeTruthy();
  });

  it("renders join group screen", () => {
    render(<JoinGroupScreen />);
    expect(screen.getByText("Unirse a Grupo")).toBeTruthy();
  });
});
