import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PlayerStatsHeader } from "@components/ranking/PlayerStatsHeader";

describe("PlayerStatsHeader", () => {
  const baseProps = {
    displayName: "Alice Rodriguez",
    username: "alice_mvd",
    avatarUrl: null as string | null,
    userId: "u1",
    position: 1,
    totalPoints: 42,
  };

  it("renders display name and username", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText("Alice Rodriguez")).toBeTruthy();
    expect(screen.getByText("@alice_mvd")).toBeTruthy();
  });

  it("renders medal emoji for position 1", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText(/🥇/)).toBeTruthy();
  });

  it("renders position number for rank 4+", () => {
    render(<PlayerStatsHeader {...baseProps} position={4} />);
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("renders total points", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("renders letter avatar from first char of display name", () => {
    render(<PlayerStatsHeader {...baseProps} />);
    expect(screen.getByText("A")).toBeTruthy();
  });
});
