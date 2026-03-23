import React from "react";
import { render, screen } from "@testing-library/react-native";
import { LeaderboardRow } from "@components/ranking/LeaderboardRow";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

const baseEntry: LeaderboardEntry = {
  id: "lb1",
  group_id: "g1",
  user_id: "u1",
  total_points: 42,
  position: 1,
  matches_played: 15,
  exact_scores: 3,
  correct_results: 8,
  display_name: "Alice Smith",
  username: "alice",
  avatar_url: null,
};

describe("LeaderboardRow", () => {
  it("renders display name and stats", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText(/15 matches/)).toBeTruthy();
    expect(screen.getByText(/3 exact/)).toBeTruthy();
    expect(screen.getByText(/8 correct/)).toBeTruthy();
  });

  it("renders 42 pts for position 1", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(screen.getByText(/42/)).toBeTruthy();
  });

  it("renders gold medal emoji for position 1", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(screen.getByText("🥇")).toBeTruthy();
  });

  it("renders silver medal emoji for position 2", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, position: 2 }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("🥈")).toBeTruthy();
  });

  it("renders bronze medal emoji for position 3", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, position: 3 }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("🥉")).toBeTruthy();
  });

  it("renders position number for rank 4+", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, position: 4 }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("renders 'You' badge when isCurrentUser is true", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={true} />);
    expect(screen.getByTestId(`you-badge-${baseEntry.user_id}`)).toBeTruthy();
  });

  it("does not render 'You' badge when isCurrentUser is false", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(screen.queryByTestId(`you-badge-${baseEntry.user_id}`)).toBeNull();
  });

  it("has correct testID on the row container", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(
      screen.getByTestId(`leaderboard-row-${baseEntry.user_id}`),
    ).toBeTruthy();
  });

  it("renders letter avatar from first char of display_name", () => {
    render(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("shows simplified stats when exact and correct scores are zero", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, exact_scores: 0, correct_results: 0 }}
        isCurrentUser={false}
      />,
    );
    expect(screen.getByText("15 matches played")).toBeTruthy();
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

  it("does not show directional glow markers when positionChange is undefined", () => {
    const { queryByTestId } = render(
      <LeaderboardRow entry={baseEntry} isCurrentUser={false} />,
    );
    expect(queryByTestId("position-glow-up")).toBeNull();
    expect(queryByTestId("position-glow-down")).toBeNull();
  });

  it("shows ▲ text indicator when positionChange > 0", () => {
    const { getByTestId, getByText } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={2}
      />,
    );
    expect(getByTestId("position-change-up")).toBeTruthy();
    expect(getByText("▲2")).toBeTruthy();
  });

  it("shows ▼ text indicator when positionChange < 0", () => {
    const { getByTestId, getByText } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={-1}
      />,
    );
    expect(getByTestId("position-change-down")).toBeTruthy();
    expect(getByText("▼1")).toBeTruthy();
  });

  it("glow overlay remains mounted when positionChange becomes undefined (P0-2)", () => {
    const { rerender, queryByTestId } = render(
      <LeaderboardRow
        entry={baseEntry}
        isCurrentUser={false}
        positionChange={2}
      />,
    );
    expect(queryByTestId("position-glow-up")).toBeTruthy();
    expect(queryByTestId("position-glow-overlay")).toBeTruthy();

    rerender(<LeaderboardRow entry={baseEntry} isCurrentUser={false} />);
    expect(queryByTestId("position-glow-up")).toBeNull();
    expect(queryByTestId("position-glow-overlay")).toBeTruthy();
  });
});
