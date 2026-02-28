import { View } from "react-native";

interface Props {
  total: number;
  activeIndex: number;
}

export default function PageIndicator({ total, activeIndex }: Props) {
  return (
    <View
      className="flex-row items-center justify-center gap-2"
      testID="page-indicator"
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          testID={`dot-${i}`}
          className={`h-2 rounded-full ${
            i === activeIndex ? "w-6 bg-[#00D4AA]" : "w-2 bg-[#A0A0B8]"
          }`}
        />
      ))}
    </View>
  );
}
