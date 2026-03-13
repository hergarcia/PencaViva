import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@hooks/use-auth";
import {
  createGroup,
  fetchActiveTournaments,
  ScoringSystem,
  Tournament,
} from "@lib/groups-service";
import {
  ScoringPresetCard,
  ScoringPreset,
} from "@components/groups/ScoringPresetCard";
import { colors } from "@lib/constants";

// ── Scoring presets ──────────────────────────────────────────────────

export type PresetKey =
  | "balanced"
  | "punish_draws"
  | "reward_accuracy"
  | "custom";

type Preset = ScoringPreset & { key: PresetKey };

export const SCORING_PRESETS: Preset[] = [
  {
    key: "balanced",
    label: "Balanced",
    description: "A fair mix of rewards. Great for casual groups.",
    values: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  },
  {
    key: "punish_draws",
    label: "Punish Draws",
    description: "No bonus for goal difference. Rewards decisive picks.",
    values: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 0,
      wrong: 0,
    },
  },
  {
    key: "reward_accuracy",
    label: "Reward Accuracy",
    description: "Higher exact score bonus. Only for the confident.",
    values: {
      exact_score: 7,
      correct_result: 2,
      correct_goal_diff: 1,
      wrong: 0,
    },
  },
  {
    key: "custom",
    label: "Custom",
    description: "Define your own point values for each outcome.",
    values: {
      exact_score: 5,
      correct_result: 3,
      correct_goal_diff: 1,
      wrong: 0,
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

function toNonNegativeInt(raw: string): number {
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

// ── Screen ───────────────────────────────────────────────────────────

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("balanced");
  const [customScoring, setCustomScoring] = useState<ScoringSystem>({
    exact_score: 5,
    correct_result: 3,
    correct_goal_diff: 1,
    wrong: 0,
  });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentIds, setSelectedTournamentIds] = useState<string[]>(
    [],
  );
  const [isFetchingTournaments, setIsFetchingTournaments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActiveTournaments()
      .then((data) => {
        if (!cancelled) setTournaments(data);
      })
      .catch(() => {
        // Silent degrade — tournaments are optional
      })
      .finally(() => {
        if (!cancelled) setIsFetchingTournaments(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeScoringSystem: ScoringSystem =
    selectedPreset === "custom"
      ? customScoring
      : SCORING_PRESETS.find((p) => p.key === selectedPreset)!.values;

  function toggleTournament(id: string) {
    setSelectedTournamentIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      Alert.alert("Invalid name", "Group name must be at least 3 characters.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Error", "You must be signed in to create a group.");
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createGroup(user.id, {
        name: trimmedName,
        description: description.trim() || undefined,
        scoring_system: activeScoringSystem,
        tournament_ids:
          selectedTournamentIds.length > 0 ? selectedTournamentIds : undefined,
      });
      router.replace(`/(tabs)/groups/${created.id}`);
    } catch (err) {
      Alert.alert(
        "Could not create group",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: colors.background }}
      >
        {/* Header */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 26,
            fontWeight: "700",
            marginBottom: 4,
          }}
        >
          Create Group
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            marginBottom: 28,
          }}
        >
          Set up your group and invite friends to predict together.
        </Text>

        {/* Group Name */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 8,
          }}
        >
          Group Name *
        </Text>
        <TextInput
          testID="name-input"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekend Warriors"
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            color: colors.textPrimary,
            padding: 14,
            fontSize: 15,
            marginBottom: 20,
          }}
        />

        {/* Description */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 8,
          }}
        >
          Description (optional)
        </Text>
        <TextInput
          testID="description-input"
          value={description}
          onChangeText={setDescription}
          placeholder="What is this group about?"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={200}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            color: colors.textPrimary,
            padding: 14,
            fontSize: 15,
            minHeight: 80,
            marginBottom: 20,
            textAlignVertical: "top",
          }}
        />

        {/* Tournaments */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 8,
          }}
        >
          Tournaments (optional)
        </Text>
        {isFetchingTournaments ? (
          <ActivityIndicator
            testID="tournaments-loading"
            color={colors.primary}
            style={{ marginBottom: 20, alignSelf: "flex-start" }}
          />
        ) : tournaments.length === 0 ? (
          <Text
            testID="no-tournaments"
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            No active tournaments available.
          </Text>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {tournaments.map((t) => {
              const isSelected = selectedTournamentIds.includes(t.id);
              return (
                <Pressable
                  key={t.id}
                  testID={`tournament-chip-${t.id}`}
                  onPress={() => toggleTournament(t.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.surfaceBorder,
                    backgroundColor: isSelected
                      ? colors.primary + "20"
                      : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    {t.short_name ?? t.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Scoring System */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontWeight: "600",
            marginBottom: 12,
          }}
        >
          Scoring System
        </Text>
        {SCORING_PRESETS.map((preset) => (
          <ScoringPresetCard
            key={preset.key}
            preset={preset}
            selected={selectedPreset === preset.key}
            onPress={() => setSelectedPreset(preset.key)}
          />
        ))}

        {/* Custom scoring inputs */}
        {selectedPreset === "custom" && (
          <View
            testID="custom-scoring-inputs"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              padding: 16,
              marginBottom: 12,
            }}
          >
            {(
              [
                { field: "exact_score", label: "Exact score" },
                { field: "correct_result", label: "Correct result" },
                { field: "correct_goal_diff", label: "Goal difference" },
                { field: "wrong", label: "Wrong prediction" },
              ] as const
            ).map(({ field, label }) => (
              <View
                key={field}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
                  {label}
                </Text>
                <TextInput
                  testID={`custom-${field}`}
                  value={String(customScoring[field])}
                  onChangeText={(v) =>
                    setCustomScoring((prev) => ({
                      ...prev,
                      [field]: toNonNegativeInt(v),
                    }))
                  }
                  keyboardType="number-pad"
                  maxLength={2}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                    color: colors.textPrimary,
                    padding: 8,
                    width: 56,
                    textAlign: "center",
                    fontSize: 15,
                  }}
                />
              </View>
            ))}
          </View>
        )}

        {/* Submit */}
        <Pressable
          testID="create-button"
          onPress={handleCreate}
          disabled={isSubmitting}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 8,
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text
              style={{
                color: colors.background,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              Create Group
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
