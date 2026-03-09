import React from "react";
import { render, screen } from "@testing-library/react-native";

import HomeScreen from "../../../app/(tabs)/index";
import PredictScreen from "../../../app/(tabs)/predict";
import RankingScreen from "../../../app/(tabs)/ranking";
import GroupsScreen from "../../../app/(tabs)/groups/index";
const screens = [
  { Component: HomeScreen, title: "Inicio" },
  { Component: PredictScreen, title: "Predecir" },
  { Component: RankingScreen, title: "Ranking" },
  { Component: GroupsScreen, title: "Grupos" },
];

describe("Tab placeholder screens", () => {
  screens.forEach(({ Component, title }) => {
    it(`renders ${title} screen with correct title`, () => {
      render(<Component />);
      expect(screen.getByText(title)).toBeTruthy();
    });
  });
});
