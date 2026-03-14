import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@hooks/use-auth";
import {
  lookupGroupByInviteCode,
  joinGroupByCode,
  type GroupPreview,
  type ScoringSystem,
} from "@lib/groups-service";
import { colors } from "@lib/constants";

const CODE_LENGTH = 8;
const HEX_REGEX = /^[0-9a-fA-F]$/;

type ScreenState = "idle" | "loading" | "preview" | "error" | "joining";

/** Map RPC error messages to user-friendly text. */
function getErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("group_not_found")) return "No group found with this code";
  if (msg.includes("group_full")) return "This group is full";
  if (msg.includes("already_member"))
    return "You're already a member of this group";
  return "Something went wrong. Please try again.";
}

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const digitsRef = useRef<string[]>(Array(CODE_LENGTH).fill(""));
  const [state, setState] = useState<ScreenState>("idle");
  const [groupPreview, setGroupPreview] = useState<GroupPreview | null>(null);
  const [errorText, setErrorText] = useState("");

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const updateDigits = useCallback((newDigits: string[]) => {
    digitsRef.current = newDigits;
    setDigits(newDigits);
  }, []);

  const resetToIdle = useCallback(() => {
    setState("idle");
    setGroupPreview(null);
    setErrorText("");
  }, []);

  const triggerLookup = useCallback(async (code: string) => {
    setState("loading");
    setErrorText("");
    setGroupPreview(null);
    try {
      const preview = await lookupGroupByInviteCode(code);
      setGroupPreview(preview);
      setState("preview");
    } catch (err) {
      setErrorText(getErrorMessage(err));
      setState("error");
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string, index: number) => {
      // Read latest digits from ref (avoids stale closure across rapid updates)
      const current = digitsRef.current;

      // Handle paste: if text is multiple characters, distribute across boxes
      if (text.length > 1) {
        const chars = text
          .toUpperCase()
          .split("")
          .filter((c) => HEX_REGEX.test(c))
          .slice(0, CODE_LENGTH);
        if (chars.length === 0) return;

        const newDigits = [...current];
        for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i++) {
          newDigits[index + i] = chars[i];
        }
        updateDigits(newDigits);

        // Focus the next empty box or last filled box
        const nextEmpty = newDigits.findIndex((d) => d === "");
        const focusIdx =
          nextEmpty >= 0
            ? nextEmpty
            : Math.min(index + chars.length, CODE_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();

        // Check if all filled
        if (newDigits.every((d) => d !== "")) {
          triggerLookup(newDigits.join(""));
        } else {
          resetToIdle();
        }
        return;
      }

      const char = text.toUpperCase();

      // Clearing
      if (text === "") {
        const newDigits = [...current];
        newDigits[index] = "";
        updateDigits(newDigits);
        resetToIdle();
        return;
      }

      if (!HEX_REGEX.test(char)) return;

      const newDigits = [...current];
      newDigits[index] = char;
      updateDigits(newDigits);

      // Auto-advance to next box
      if (index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if all filled
      if (newDigits.every((d) => d !== "")) {
        triggerLookup(newDigits.join(""));
      }
    },
    [updateDigits, triggerLookup, resetToIdle],
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace") {
        const current = digitsRef.current;
        if (current[index] === "" && index > 0) {
          const newDigits = [...current];
          newDigits[index - 1] = "";
          updateDigits(newDigits);
          inputRefs.current[index - 1]?.focus();
          resetToIdle();
        } else if (current[index] !== "") {
          const newDigits = [...current];
          newDigits[index] = "";
          updateDigits(newDigits);
          resetToIdle();
        }
      }
    },
    [updateDigits, resetToIdle],
  );

  const handleJoin = useCallback(async () => {
    if (!groupPreview || !user) return;
    setState("joining");
    try {
      const result = await joinGroupByCode(digitsRef.current.join(""));
      router.replace(`/(tabs)/groups/${result.id}`);
    } catch (err) {
      setErrorText(getErrorMessage(err));
      setState("error");
    }
  }, [groupPreview, user, router]);

  if (!user) return null;

  const scoring = groupPreview?.scoring_system as ScoringSystem | undefined;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="join-group-screen"
    >
      {/* Header */}
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
          }}
        >
          Join Group
        </Text>
      </View>

      {/* Code Input */}
      <View style={{ paddingHorizontal: 24, marginTop: 16 }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          Invite Code
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {Array.from({ length: CODE_LENGTH }).map((_, i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              testID={`code-input-${i}`}
              value={digits[i]}
              onChangeText={(text) => handleChangeText(text, i)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, i)
              }
              autoCapitalize="characters"
              autoCorrect={false}
              keyboardType="default"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: digits[i] ? colors.primary : colors.surfaceBorder,
                borderRadius: 8,
                width: 38,
                height: 48,
                textAlign: "center",
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "bold",
              }}
            />
          ))}
        </View>

        {/* Error text */}
        {state === "error" && errorText ? (
          <Text
            testID="error-message"
            style={{
              color: "#FF4444",
              fontSize: 14,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            {errorText}
          </Text>
        ) : null}
      </View>

      {/* Loading spinner */}
      {state === "loading" ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            marginTop: 32,
          }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            testID="loading-indicator"
          />
        </View>
      ) : null}

      {/* Group Preview */}
      {(state === "preview" || state === "joining") && groupPreview ? (
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <View
            testID="group-preview"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
            }}
          >
            {/* Avatar + Name */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {groupPreview.avatar_url ? (
                <Image
                  source={{ uri: groupPreview.avatar_url }}
                  style={{ width: 44, height: 44, borderRadius: 10 }}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: colors.secondary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontWeight: "bold",
                      fontSize: 18,
                    }}
                  >
                    {groupPreview.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  {groupPreview.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {groupPreview.member_count} / {groupPreview.max_members}{" "}
                  members
                </Text>
              </View>
            </View>

            {/* Description */}
            {groupPreview.description ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  lineHeight: 18,
                  marginBottom: 10,
                }}
              >
                {groupPreview.description}
              </Text>
            ) : null}

            {/* Scoring chips */}
            {scoring ? (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Exact: {scoring.exact_score}pts
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Result: {scoring.correct_result}pts
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    Diff: {scoring.correct_goal_diff}pts
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Join button */}
          <TouchableOpacity
            testID="join-button"
            onPress={handleJoin}
            disabled={state === "joining"}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 16,
              opacity: state === "joining" ? 0.6 : 1,
            }}
          >
            {state === "joining" ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
                testID="join-loading"
              />
            ) : (
              <Text
                style={{
                  color: colors.background,
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Join Group
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
