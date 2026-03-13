import React from "react";
import { render, screen } from "@testing-library/react-native";
import GroupDetailScreen from "../../../app/(tabs)/groups/[id]";
import CreateGroupScreen from "../../../app/(tabs)/groups/create";
import JoinGroupScreen from "../../../app/(tabs)/groups/join";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "7" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@lib/groups-service", () => ({
  createGroup: jest.fn(),
  fetchActiveTournaments: jest.fn().mockResolvedValue([]),
}));

describe("Group nested screens", () => {
  it("renders group detail with id", () => {
    render(<GroupDetailScreen />);
    expect(screen.getByText("Group")).toBeTruthy();
    expect(screen.getByText("Group detail 7")).toBeTruthy();
  });

  it("renders create group screen", async () => {
    render(<CreateGroupScreen />);
    expect(screen.getAllByText("Create Group").length).toBeGreaterThan(0);
  });

  it("renders join group screen", () => {
    render(<JoinGroupScreen />);
    expect(screen.getByText("Join Group")).toBeTruthy();
  });
});
