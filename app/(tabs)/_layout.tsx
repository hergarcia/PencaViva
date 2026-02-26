import { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/constants";

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  iconDefault: IoniconsName;
  iconFocused: IoniconsName;
}

const TAB_CONFIG: TabConfig[] = [
  {
    name: "index",
    title: "Inicio",
    iconDefault: "home-outline",
    iconFocused: "home",
  },
  {
    name: "predict",
    title: "Predecir",
    iconDefault: "football-outline",
    iconFocused: "football",
  },
  {
    name: "ranking",
    title: "Ranking",
    iconDefault: "trophy-outline",
    iconFocused: "trophy",
  },
  {
    name: "groups",
    title: "Grupos",
    iconDefault: "people-outline",
    iconFocused: "people",
  },
  {
    name: "profile",
    title: "Perfil",
    iconDefault: "person-outline",
    iconFocused: "person",
  },
];

const tabBarStyle = {
  backgroundColor: colors.surface,
  borderTopColor: colors.surfaceBorder,
};

const tabBarLabelStyle = {
  fontSize: 11,
  fontWeight: "600" as const,
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,
        tabBarLabelStyle,
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.iconDefault}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
