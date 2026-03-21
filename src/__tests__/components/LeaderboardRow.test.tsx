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

  it("shows position change up indicator when positionChange > 0", () => {
    const { getByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={2}
      />,
    );
    expect(getByTestId("position-change-up")).toBeTruthy();
  });

  it("shows position change down indicator when positionChange < 0", () => {
    const { getByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={-1}
      />,
    );
    expect(getByTestId("position-change-down")).toBeTruthy();
  });

  it("shows no position change indicator when positionChange is 0", () => {
    const { queryByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={0}
      />,
    );
    expect(queryByTestId("position-change-up")).toBeNull();
    expect(queryByTestId("position-change-down")).toBeNull();
  });

  it("shows no position change indicator when positionChange is undefined", () => {
    const { queryByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(queryByTestId("position-change-up")).toBeNull();
    expect(queryByTestId("position-change-down")).toBeNull();
  });
});
