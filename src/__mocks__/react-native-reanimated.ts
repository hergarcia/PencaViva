/* eslint-disable @typescript-eslint/no-explicit-any */

const useSharedValue = (initialValue: any) => ({ value: initialValue });

const useAnimatedStyle = (fn: () => any) => fn();

const useDerivedValue = (fn: () => any) => ({ value: fn() });

const withTiming = (toValue: any) => toValue;
const withSpring = (toValue: any) => toValue;
const withDelay = (_delay: number, value: any) => value;
const withSequence = (...values: any[]) => values[values.length - 1];

const runOnJS = (fn: (...args: any[]) => any) => fn;

const useAnimatedScrollHandler = () => () => {};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { View, Text, ScrollView } = require("react-native");
const Animated = {
  View,
  Text,
  ScrollView,
};

export {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  useAnimatedScrollHandler,
};
export default Animated;
