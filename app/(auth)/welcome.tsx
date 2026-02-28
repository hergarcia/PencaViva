import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ONBOARDING_PAGES, ONBOARDING_STORAGE_KEY } from "@lib/onboarding";
import { setStorageItem } from "@lib/storage";
import OnboardingPageView from "@components/onboarding/OnboardingPageView";
import PageIndicator from "@components/onboarding/PageIndicator";

function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLastPage = activeIndex === ONBOARDING_PAGES.length - 1;

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveIndex(index);
    },
    [width],
  );

  const completeOnboarding = useCallback(async () => {
    await setStorageItem(ONBOARDING_STORAGE_KEY, "true");
    router.replace("/(auth)/login");
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      completeOnboarding();
    } else {
      const nextIndex = activeIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setActiveIndex(nextIndex);
    }
  }, [activeIndex, isLastPage, width, completeOnboarding]);

  return (
    <SafeAreaView className="flex-1 bg-[#0D0D0D]" testID="welcome-screen">
      {/* Skip button */}
      <View className="flex-row justify-end px-4 pt-2">
        {!isLastPage && (
          <Pressable onPress={completeOnboarding} testID="skip-button">
            <Text className="text-base text-[#A0A0B8]">Skip</Text>
          </Pressable>
        )}
      </View>

      {/* Pages */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        testID="onboarding-scroll"
      >
        {ONBOARDING_PAGES.map((page, index) => (
          <OnboardingPageView
            key={page.id}
            page={page}
            isActive={index === activeIndex}
          />
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View className="px-8 pb-4">
        <PageIndicator
          total={ONBOARDING_PAGES.length}
          activeIndex={activeIndex}
        />

        <Pressable
          onPress={handleNext}
          className="mt-6 items-center rounded-xl bg-[#00D4AA] py-4"
          testID="next-button"
        >
          <Text className="text-base font-bold text-[#0D0D0D]">
            {isLastPage ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default WelcomeScreen;
