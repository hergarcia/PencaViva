import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

export interface OnboardingPage {
  id: string;
  icon: IoniconsName;
  iconColor: string;
  title: string;
  subtitle: string;
}

export const ONBOARDING_STORAGE_KEY = "onboarding_completed";

export const ONBOARDING_PAGES: OnboardingPage[] = [
  {
    id: "predict",
    icon: "football-outline",
    iconColor: "#00D4AA",
    title: "Predict Match Scores",
    subtitle:
      "Guess the exact score for every match and earn points for your accuracy.",
  },
  {
    id: "compete",
    icon: "trophy-outline",
    iconColor: "#7C5CFC",
    title: "Compete with Friends",
    subtitle:
      "Create private groups, invite your crew, and climb the real-time leaderboards.",
  },
  {
    id: "win",
    icon: "star-outline",
    iconColor: "#FFB800",
    title: "Prove You Know Best",
    subtitle:
      "Track your stats across tournaments and show everyone who the real expert is.",
  },
];
