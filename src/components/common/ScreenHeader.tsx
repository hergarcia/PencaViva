import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

interface ScreenHeaderProps {
  title: string;
}

export function ScreenHeader({ title }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        padding: 24,
        paddingBottom: 12,
      }}
    >
      <TouchableOpacity onPress={() => router.back()} testID="back-button">
        <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: "bold",
          flex: 1,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}
