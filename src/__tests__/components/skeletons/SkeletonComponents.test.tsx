import React from "react";
import { render } from "@testing-library/react-native";
import { SkeletonMatchCard } from "@components/skeletons/SkeletonMatchCard";
import { SkeletonLeaderboardRow } from "@components/skeletons/SkeletonLeaderboardRow";
import { SkeletonGroupCard } from "@components/skeletons/SkeletonGroupCard";
import { SkeletonMemberRow } from "@components/skeletons/SkeletonMemberRow";
import { SkeletonPredictionHistoryRow } from "@components/skeletons/SkeletonPredictionHistoryRow";

describe("Skeleton components", () => {
  it("SkeletonMatchCard renders", () => {
    const { getByTestId } = render(<SkeletonMatchCard />);
    expect(getByTestId("skeleton-match-card")).toBeTruthy();
  });

  it("SkeletonLeaderboardRow renders", () => {
    const { getByTestId } = render(<SkeletonLeaderboardRow />);
    expect(getByTestId("skeleton-leaderboard-row")).toBeTruthy();
  });

  it("SkeletonGroupCard renders", () => {
    const { getByTestId } = render(<SkeletonGroupCard />);
    expect(getByTestId("skeleton-group-card")).toBeTruthy();
  });

  it("SkeletonMemberRow renders", () => {
    const { getByTestId } = render(<SkeletonMemberRow />);
    expect(getByTestId("skeleton-member-row")).toBeTruthy();
  });

  it("SkeletonPredictionHistoryRow renders", () => {
    const { getByTestId } = render(<SkeletonPredictionHistoryRow />);
    expect(getByTestId("skeleton-prediction-history-row")).toBeTruthy();
  });
});
