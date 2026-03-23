import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StatsGrid } from "@components/ranking/StatsGrid";

describe("StatsGrid", () => {
  it("renders all four stats", () => {
    render(
      <StatsGrid
        matchesPlayed={15}
        exactScores={3}
        correctResults={8}
        totalPoints={42}
      />,
    );
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("2.8")).toBeTruthy();
  });

  it("renders labels", () => {
    render(
      <StatsGrid
        matchesPlayed={10}
        exactScores={1}
        correctResults={5}
        totalPoints={29}
      />,
    );
    expect(screen.getByText("Matches")).toBeTruthy();
    expect(screen.getByText("Exact")).toBeTruthy();
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(screen.getByText("Avg Pts")).toBeTruthy();
  });

  it("shows 0.0 avg when no matches played", () => {
    render(
      <StatsGrid
        matchesPlayed={0}
        exactScores={0}
        correctResults={0}
        totalPoints={0}
      />,
    );
    expect(screen.getByText("0.0")).toBeTruthy();
  });
});
