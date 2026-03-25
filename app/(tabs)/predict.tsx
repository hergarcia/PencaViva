import React, { useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import { EmptyState } from "@components/common/EmptyState";
import { useActiveGroup } from "@hooks/use-active-group";
import { useGroupMatches } from "@hooks/use-group-matches";
import { MatchCard } from "@components/predictions/MatchCard";
import { DateSectionHeader } from "@components/predictions/DateSectionHeader";
import { GroupSelector } from "@components/predictions/GroupSelector";
import type { DateSection } from "@hooks/use-group-matches";
import type { MatchWithPrediction } from "@lib/matches-service";

export default function PredictScreen() {
  const router = useRouter();
  const {
    activeGroupId,
    activeGroup,
    groups,
    setActiveGroupId,
    isLoading: groupsLoading,
  } = useActiveGroup();
  const {
    sections,
    isLoading: matchesLoading,
    error,
    refetch,
  } = useGroupMatches(activeGroupId);

  const isLoading = groupsLoading || matchesLoading;

  const handleMatchPress = useCallback(
    (matchId: string) => {
      router.push(`/match/${matchId}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: MatchWithPrediction }) => (
      <MatchCard match={item} onPress={handleMatchPress} />
    ),
    [handleMatchPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <DateSectionHeader title={section.title} />
    ),
    [],
  );

  // ── Empty state: no groups ──────────────────────────────────────

  if (!groupsLoading && groups.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            Predict
          </Text>
        </View>
        <EmptyState
          icon="people-outline"
          title="No groups yet"
          description="Join or create a group to start predicting"
          actions={[
            {
              label: "Join Group",
              onPress: () => router.push("/groups/join"),
              variant: "outline",
            },
            {
              label: "Create Group",
              onPress: () => router.push("/groups/create"),
              variant: "primary",
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 8,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 24,
            fontWeight: "700",
          }}
        >
          Predict
        </Text>
        {groups.length > 1 && (
          <GroupSelector
            groups={groups}
            activeGroup={activeGroup}
            onSelect={setActiveGroupId}
          />
        )}
        {groups.length === 1 && activeGroup && (
          <Text
            style={{ color: colors.textSecondary, fontSize: 14 }}
            numberOfLines={1}
          >
            {activeGroup.name}
          </Text>
        )}
      </View>

      {/* Loading */}
      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        /* Error state */
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.accent}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              marginTop: 12,
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <TouchableOpacity
            testID="retry-button"
            onPress={refetch}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 20,
              marginTop: 16,
            }}
          >
            <Text style={{ color: colors.background, fontWeight: "600" }}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : sections.length === 0 ? (
        /* Empty matches state */
        <EmptyState
          icon="football-outline"
          title="No upcoming matches"
          description="Check back later for new fixtures"
        />
      ) : (
        /* Match list */
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
