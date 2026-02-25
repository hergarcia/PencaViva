import React from "react";
import { render, screen } from "@testing-library/react-native";

import WelcomeScreen from "../../../app/(auth)/welcome";
import LoginScreen from "../../../app/(auth)/login";
import CompleteProfileScreen from "../../../app/(auth)/complete-profile";

describe("Auth placeholder screens", () => {
  it("renders Welcome screen", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("Bienvenido")).toBeTruthy();
  });

  it("renders Login screen", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Iniciar Sesión")).toBeTruthy();
  });

  it("renders Complete Profile screen", () => {
    render(<CompleteProfileScreen />);
    expect(screen.getByText("Completar Perfil")).toBeTruthy();
  });
});
