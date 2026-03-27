import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";

// ── Types ───────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

type ToastData = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  showToast: (type: ToastType, message: string, duration?: number) => void;
};

// ── Config ──────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
  ToastType,
  { borderColor: string; icon: React.ComponentProps<typeof Ionicons>["name"] }
> = {
  success: { borderColor: colors.primary, icon: "checkmark-circle" },
  error: { borderColor: colors.danger, icon: "alert-circle" },
  info: { borderColor: colors.secondary, icon: "information-circle" },
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 300;

// ── Context ─────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

// ── Toast UI ────────────────────────────────────────────────────────

function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: ANIMATION_DURATION });
    translateY.value = withTiming(0, { duration: ANIMATION_DURATION });
  }, [opacity, translateY]);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    dismissTimerRef.current = setTimeout(() => {
      onDismissRef.current();
    }, DEFAULT_DURATION);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [toast.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      testID="toast-banner"
      style={[
        {
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          zIndex: 9999,
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: config.borderColor,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        },
        animatedStyle,
      ]}
    >
      <Ionicons
        name={config.icon}
        size={20}
        color={config.borderColor}
        style={{ marginRight: 10 }}
      />
      <Text
        numberOfLines={2}
        style={{
          color: colors.textPrimary,
          fontSize: 14,
          flex: 1,
        }}
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}

// ── Provider ────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((type: ToastType, message: string) => {
    idRef.current += 1;
    setToast({ id: idRef.current, type, message });
  }, []);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <ToastBanner toast={toast} onDismiss={dismiss} />}
    </ToastContext.Provider>
  );
}
