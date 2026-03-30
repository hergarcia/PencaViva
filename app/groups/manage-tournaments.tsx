import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors } from "@lib/constants";
import { ScreenHeader } from "@components/common/ScreenHeader";
import {
  fetchActiveTournaments,
  updateGroupTournaments,
} from "@lib/groups-service";
import { useGroupDetail } from "@hooks/use-group-detail";
import type { Tournament } from "@lib/groups-service";

export default function ManageTournamentsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { tournaments: currentTournaments } = useGroupDetail(groupId);

  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize selected IDs from current group tournaments
  useEffect(() => {
    setSelectedIds(currentTournaments.map((t) => t.id));
  }, [currentTournaments]);

  // Fetch all active tournaments
  useEffect(() => {
    let cancelled = false;
    fetchActiveTournaments()
      .then((data) => {
        if (!cancelled) setAllTournaments(data);
      })
      .catch(() => {
        // Silent degrade — will show empty state
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleTournament(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateGroupTournaments(groupId, selectedIds);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Could not update tournaments",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Manage Tournaments" />

      {isFetching ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            testID="tournaments-loading"
            color={colors.primary}
            size="large"
          />
        </View>
      ) : allTournaments.length === 0 ? (
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            No active tournaments available.
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 13,
              fontWeight: "600",
              marginBottom: 12,
            }}
          >
            Select tournaments for this group
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {allTournaments.map((t) => {
              const isSelected = selectedIds.includes(t.id);
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

          <Pressable
            testID="save-button"
            onPress={handleSave}
            disabled={isSaving}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text
                style={{
                  color: colors.background,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
