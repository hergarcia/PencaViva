import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-white">Inicio</Text>
        <Text className="mt-2 text-base text-[#A0A0B8]">
          Próximos partidos y predicciones
        </Text>
      </View>
    </SafeAreaView>
  );
}
