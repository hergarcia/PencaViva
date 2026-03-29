import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PredictionHistoryRow } from "@components/ranking/PredictionHistoryRow";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

const basePred: PlayerPredictionRecord = {
  id: "p1",
  home_score_pred: 3,
  away_score_pred: 1,
  points: 5,
  match: {
    id: "m1",
    home_team_name: "Cerro Porteno",
    away_team_name: "Olimpia",
    home_score: 3,
    away_score: 1,
    kickoff_time: "2026-03-20T20:00:00Z",
    status: "finished",
    matchday: 4,
    tournament_name: "Copa Libertadores",
    tournament_short_name: "Libertadores",
  },
};

describe("PredictionHistoryRow", () => {
  it("renders team names", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText(/Cerro Porteno/)).toBeTruthy();
    expect(screen.getByText(/Olimpia/)).toBeTruthy();
  });

  it("renders prediction and actual scores", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("3 - 1")).toBeTruthy();
  });

  it("renders points", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("+5")).toBeTruthy();
  });

  it("renders tournament short name", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByText("Libertadores")).toBeTruthy();
  });

  it("shows 0 points for wrong prediction", () => {
    render(<PredictionHistoryRow prediction={{ ...basePred, points: 0 }} />);
    expect(screen.getByText("+0")).toBeTruthy();
  });

  it("has testID with prediction id", () => {
    render(<PredictionHistoryRow prediction={basePred} />);
    expect(screen.getByTestId("prediction-history-row-p1")).toBeTruthy();
  });

  it("renders exact star when prediction is an exact score (points >= 5)", () => {
    const exactPrediction = {
      ...basePred,
      points: 5,
      home_score_pred: 2,
      away_score_pred: 1,
      match: { ...basePred.match, home_score: 2, away_score: 1 },
    };
    const { getByTestId } = render(
      <PredictionHistoryRow prediction={exactPrediction} />,
    );
    expect(getByTestId("exact-star")).toBeTruthy();
  });

  it("does not render exact star when points < 5", () => {
    const wrongPrediction = { ...basePred, points: 3 };
    const { queryByTestId } = render(
      <PredictionHistoryRow prediction={wrongPrediction} />,
    );
    expect(queryByTestId("exact-star")).toBeNull();
  });
});
