import { useEffect } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { OnboardingPage } from "@lib/onboarding";

interface Props {
  page: OnboardingPage;
  isActive: boolean;
}

export default function OnboardingPageView({ page, isActive }: Props) {
  const { width, height } = useWindowDimensions();

  const iconScale = useSharedValue(isActive ? 1 : 0.5);
  const iconOpacity = useSharedValue(isActive ? 1 : 0);
  const textTranslateY = useSharedValue(isActive ? 0 : 30);
  const textOpacity = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    if (isActive) {
      iconScale.value = withTiming(1, { duration: 500 });
      iconOpacity.value = withTiming(1, { duration: 500 });
      textTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));
      textOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    } else {
      iconScale.value = 0.5;
      iconOpacity.value = 0;
      textTranslateY.value = 30;
      textOpacity.value = 0;
    }
  }, [isActive, iconScale, iconOpacity, textTranslateY, textOpacity]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textTranslateY.value }],
    opacity: textOpacity.value,
  }));

  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
      }}
      testID={`onboarding-page-${page.id}`}
    >
      <Animated.View style={iconAnimatedStyle} className="mb-8">
        <Ionicons name={page.icon} size={100} color={page.iconColor} />
      </Animated.View>

      <Animated.View style={textAnimatedStyle} className="items-center">
        <Text className="mb-4 text-center text-2xl font-bold text-white">
          {page.title}
        </Text>
        <Text className="text-center text-base leading-6 text-[#A0A0B8]">
          {page.subtitle}
        </Text>
      </Animated.View>
    </View>
  );
}
