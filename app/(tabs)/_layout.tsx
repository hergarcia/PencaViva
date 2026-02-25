import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TAB_CONFIG = [
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

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#00D4AA",
        tabBarInactiveTintColor: "#A0A0B8",
        tabBarStyle: {
          backgroundColor: "#1A1A2E",
          borderTopColor: "#2A2A3E",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
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
