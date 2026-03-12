import React from "react";
import { render, screen } from "@testing-library/react-native";

import HomeScreen from "../../../app/(tabs)/index";
import PredictScreen from "../../../app/(tabs)/predict";
import RankingScreen from "../../../app/(tabs)/ranking";

// GroupsScreen removed — no longer a placeholder, has its own test suite
// in src/__tests__/navigation/groups-screen.test.tsx

const screens = [
  { Component: HomeScreen, title: "Inicio" },
  { Component: PredictScreen, title: "Predecir" },
  { Component: RankingScreen, title: "Ranking" },
];

describe("Tab placeholder screens", () => {
  screens.forEach(({ Component, title }) => {
    it(`renders ${title} screen with correct title`, () => {
      render(<Component />);
      expect(screen.getByText(title)).toBeTruthy();
    });
  });
});
