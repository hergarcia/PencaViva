/**
 * Design tokens from PLAN_MAESTRO.md
 * Single source of truth for colors used across layouts and components.
 */

export const colors = {
  primary: "#00D4AA",
  secondary: "#7C5CFC",
  accent: "#FFB800",
  background: "#0D0D0D",
  surface: "#1A1A2E",
  surfaceBorder: "#2A2A3E",
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0B8",
  success: "#00C48C",
  successRgb: "0, 196, 140", // for rgba() templates in animations
  danger: "#FF4D6A",
  dangerRgb: "255, 77, 106", // for rgba() templates in animations
  // Prediction result colors
  exact: "#FFB800",
  wrong: "#6B6B80",
  // Match status
  live: "#FF4444",
  // Card tokens
  cardRadius: 16,
  cardPadding: 16,
  cardBorderWidth: 1,
} as const;

export const APP_BASE_URL = "https://pencaviva.app";
