import React from "react";
import { render } from "@testing-library/react-native";
import { LeaderboardRow } from "@components/ranking/LeaderboardRow";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

const baseEntry: LeaderboardEntry = {
  id: "lb1",
  group_id: "g1",
  user_id: "user-1",
  total_points: 42,
  position: 1,
  matches_played: 15,
  exact_scores: 3,
  correct_results: 8,
  display_name: "Alice",
  username: "alice",
  avatar_url: null,
};

describe("LeaderboardRow", () => {
  it("renders display name and points", () => {
    const { getByText, getByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(getByText("Alice")).toBeTruthy();
    // Points are in a nested Text node alongside " pts"
    expect(getByTestId(`leaderboard-row-${baseEntry.user_id}`)).toBeTruthy();
    expect(getByText(/42/)).toBeTruthy();
  });

  it("shows medal for top 3 positions", () => {
    const { getByText } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(getByText("🥇")).toBeTruthy();
  });

  it("shows You badge for current user", () => {
    const { getByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={true} />,
    );
    expect(getByTestId(`you-badge-${baseEntry.user_id}`)).toBeTruthy();
  });

  it("renders without crashing when positionChange is undefined", () => {
    const { getByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(getByTestId(`leaderboard-row-${baseEntry.user_id}`)).toBeTruthy();
  });

  it("renders without crashing when positionChange is 0", () => {
    const { getByTestId, queryByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={0}
      />,
    );
    expect(getByTestId(`leaderboard-row-${baseEntry.user_id}`)).toBeTruthy();
    // No glow overlay when no change
    expect(queryByTestId("position-glow-up")).toBeNull();
    expect(queryByTestId("position-glow-down")).toBeNull();
  });

  it("shows green glow overlay when positionChange > 0 (moved up)", () => {
    const { getByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={2}
      />,
    );
    expect(getByTestId("position-glow-up")).toBeTruthy();
  });

  it("shows red glow overlay when positionChange < 0 (moved down)", () => {
    const { getByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={-1}
      />,
    );
    expect(getByTestId("position-glow-down")).toBeTruthy();
  });

  it("does not show glow overlay when positionChange is undefined", () => {
    const { queryByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(queryByTestId("position-glow-up")).toBeNull();
    expect(queryByTestId("position-glow-down")).toBeNull();
  });

  it("shows stats detail line when exact and correct scores are non-zero", () => {
    const { getByText } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(getByText("15 matches · 3 exact · 8 correct")).toBeTruthy();
  });

  it("shows simplified stats when exact and correct scores are zero", () => {
    const { getByText } = render(
      <LeaderboardRow
        entry={{ ...baseEntry, exact_scores: 0, correct_results: 0 }}
        isCurrentUser={false}
      />,
    );
    expect(getByText("15 matches played")).toBeTruthy();
  });
});
