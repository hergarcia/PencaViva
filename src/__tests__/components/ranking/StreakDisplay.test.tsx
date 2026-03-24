import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StreakDisplay } from "@components/ranking/StreakDisplay";

describe("StreakDisplay", () => {
  it("renders current correct streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 5, type: "correct" }}
        bestStreak={7}
      />,
    );
    expect(screen.getByText(/5 correct in a row/)).toBeTruthy();
  });

  it("renders current wrong streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 3, type: "wrong" }}
        bestStreak={5}
      />,
    );
    expect(screen.getByText(/3 wrong in a row/)).toBeTruthy();
  });

  it("renders best streak", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 2, type: "correct" }}
        bestStreak={8}
      />,
    );
    expect(screen.getByText(/Best: 8 correct/)).toBeTruthy();
  });

  it("renders no streak message when count is 0", () => {
    render(
      <StreakDisplay
        currentStreak={{ count: 0, type: "correct" }}
        bestStreak={0}
      />,
    );
    expect(screen.getByText(/No streak yet/)).toBeTruthy();
  });
});
