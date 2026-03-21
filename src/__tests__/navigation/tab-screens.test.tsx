import React from "react";
import { render, screen } from "@testing-library/react-native";

import HomeScreen from "../../../app/(tabs)/index";

// GroupsScreen removed — has its own test suite in groups-screen.test.tsx
// PredictScreen removed — has its own test suite in predict-screen.test.tsx
// RankingScreen removed — has its own test suite in ranking-screen.test.tsx

const screens = [{ Component: HomeScreen, title: "Inicio" }];

describe("Tab placeholder screens", () => {
  screens.forEach(({ Component, title }) => {
    it(`renders ${title} screen with correct title`, () => {
      render(<Component />);
      expect(screen.getByText(title)).toBeTruthy();
    });
  });
});
