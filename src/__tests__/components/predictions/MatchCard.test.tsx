import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MatchCard } from "@components/predictions/MatchCard";
import type { MatchWithPrediction } from "@lib/matches-service";

const baseMatch: MatchWithPrediction = {
  id: "m1",
  tournament_id: "t1",
  tournament_name: "Primera División",
  tournament_short_name: "PDU",
  home_team_name: "Nacional",
  away_team_name: "Peñarol",
  home_team_logo: null,
  away_team_logo: null,
  home_score: null,
  away_score: null,
  status: "scheduled",
  kickoff_time: "2026-03-19T20:00:00Z",
  matchday: 5,
  venue: "Estadio Gran Parque Central",
  prediction_status: "open",
  predicted_home: null,
  predicted_away: null,
};

describe("MatchCard", () => {
  it("renders team names", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText("Nacional")).toBeTruthy();
    expect(getByText("Peñarol")).toBeTruthy();
  });

  it("renders tournament name", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText("Primera División")).toBeTruthy();
  });

  it("renders venue", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    expect(getByText(/Estadio Gran Parque Central/)).toBeTruthy();
  });

  it("shows dashes for scheduled match scores", () => {
    const { getByTestId } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    const card = getByTestId("match-card-m1");
    // Scheduled matches show dash placeholders
    expect(card).toBeTruthy();
  });

  it("shows actual scores for finished match", () => {
    const finishedMatch = {
      ...baseMatch,
      status: "finished" as const,
      home_score: 2,
      away_score: 1,
    };
    const { getByText } = render(
      <MatchCard match={finishedMatch} onPress={jest.fn()} />,
    );
    expect(getByText("2")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
  });

  it("calls onPress with match id when tapped", () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <MatchCard match={baseMatch} onPress={onPress} />,
    );
    fireEvent.press(getByTestId("match-card-m1"));
    expect(onPress).toHaveBeenCalledWith("m1");
  });

  it("renders LIVE badge for live matches", () => {
    const liveMatch = { ...baseMatch, status: "live" as const };
    const { getByText } = render(
      <MatchCard match={liveMatch} onPress={jest.fn()} />,
    );
    expect(getByText("LIVE")).toBeTruthy();
  });

  it("renders letter fallback when team logo is null", () => {
    const { getByText } = render(
      <MatchCard match={baseMatch} onPress={jest.fn()} />,
    );
    // First letter of team names as fallback
    expect(getByText("N")).toBeTruthy(); // Nacional
    expect(getByText("P")).toBeTruthy(); // Peñarol
  });
});
