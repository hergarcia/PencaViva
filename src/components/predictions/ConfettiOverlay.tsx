import React, { useEffect, useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from "react-native-reanimated";
import { colors } from "@lib/constants";

const PARTICLE_COUNT = 30;
const CONFETTI_COLORS = [
  colors.primary,
  colors.secondary,
  colors.accent,
  colors.success,
  colors.danger,
];

interface ParticleConfig {
  color: string;
  startX: number;
  endX: number;
  rotation: number;
}

function generateParticles(): ParticleConfig[] {
  const particles: ParticleConfig[] = [];
  const { width } = Dimensions.get("window");
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      startX: width / 2 - 4,
      endX: Math.random() * width - width / 2,
      rotation: Math.random() * 720 - 360,
    });
  }
  return particles;
}

function ConfettiParticle({
  config,
  index,
  active,
}: {
  config: ParticleConfig;
  index: number;
  active: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const { height } = Dimensions.get("window");

  useEffect(() => {
    if (active) {
      const delay = Math.random() * 100;
      translateX.value = withDelay(
        delay,
        withTiming(config.endX, { duration: 1200 }),
      );
      translateY.value = withDelay(
        delay,
        withSequence(
          withTiming(-height * 0.3, { duration: 400 }),
          withTiming(height * 0.5, { duration: 800 }),
        ),
      );
      rotate.value = withDelay(
        delay,
        withTiming(config.rotation, { duration: 1200 }),
      );
      opacity.value = withDelay(800, withTiming(0, { duration: 400 }));
    } else {
      translateX.value = 0;
      translateY.value = 0;
      rotate.value = 0;
      opacity.value = 1;
    }
  }, [active, config, translateX, translateY, rotate, opacity, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID={`confetti-particle-${index}`}
      style={[
        {
          position: "absolute",
          width: 8,
          height: 4,
          borderRadius: 2,
          backgroundColor: config.color,
          left: config.startX,
          top: "50%",
        },
        animatedStyle,
      ]}
    />
  );
}

interface ConfettiOverlayProps {
  active: boolean;
}

export function ConfettiOverlay({ active }: ConfettiOverlayProps) {
  const particles = useMemo(() => generateParticles(), []);

  if (!active) return null;

  return (
    <View
      testID="confetti-container"
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      {particles.map((config, i) => (
        <ConfettiParticle key={i} config={config} index={i} active={active} />
      ))}
    </View>
  );
}
