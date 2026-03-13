import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JoinGroupScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0D0D0D" }}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-3xl font-bold text-white">Join Group</Text>
        <Text className="mt-2 text-base text-[#A0A0B8]">
          Join an existing group
        </Text>
      </View>
    </SafeAreaView>
  );
}
