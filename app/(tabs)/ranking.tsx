import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import { useAuth } from "@hooks/use-auth";
import { useActiveGroup } from "@hooks/use-active-group";
import { useGroupLeaderboard } from "@hooks/use-group-leaderboard";
import { LeaderboardRow } from "@components/ranking/LeaderboardRow";
import { GroupSelector } from "@components/predictions/GroupSelector";
import type { LeaderboardEntry } from "@lib/leaderboard-service";

// ── Sticky footer: shows current user position when scrolled out of view ──

interface StickyMyPositionProps {
  entry: LeaderboardEntry;
}

function StickyMyPosition({ entry }: StickyMyPositionProps) {
  const letter = entry.display_name.charAt(0).toUpperCase();
  return (
    <View
      testID="sticky-my-position"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.primary + "66",
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 12, width: 36 }}>
        #{entry.position}
      </Text>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + "33",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
          marginRight: 10,
        }}
      >
        <Text
          style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}
        >
          {letter}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontWeight: "600",
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {entry.display_name}
        <Text style={{ color: colors.primary }}> (You)</Text>
      </Text>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>
        {entry.total_points}
        <Text
          style={{
            color: colors.textSecondary,
            fontWeight: "400",
            fontSize: 12,
          }}
        >
          {" "}
          pts
        </Text>
      </Text>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────

export default function RankingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    activeGroupId,
    activeGroup,
    groups,
    setActiveGroupId,
    isLoading: groupsLoading,
  } = useActiveGroup();
  const {
    entries,
    isLoading: leaderboardLoading,
    error,
    refetch,
  } = useGroupLeaderboard(activeGroupId);

  const isLoading = groupsLoading || leaderboardLoading;

  // Track visibility of current user's row for sticky footer
  const [myRowVisible, setMyRowVisible] = useState(true);
  const myEntry = entries.find((e) => e.user_id === user?.id) ?? null;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!myEntry) return;
      const visible = viewableItems.some(
        (item) => (item.item as LeaderboardEntry).user_id === myEntry.user_id,
      );
      setMyRowVisible(visible);
    },
    [myEntry],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow entry={item} isCurrentUser={item.user_id === user?.id} />
    ),
    [user?.id],
  );

  const keyExtractor = useCallback((item: LeaderboardEntry) => item.id, []);

  // ── Empty state: no groups ─────────────────────────────────────────

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
            Ranking
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="trophy-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "600",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No groups yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Join or create a group to see the leaderboard
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
            <TouchableOpacity
              testID="join-group-cta"
              onPress={() => router.push("/groups/join")}
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                Join
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="create-group-cta"
              onPress={() => router.push("/groups/create")}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: "600" }}>
                Create
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ────────────────────────────────────────────────────

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
          Ranking
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
      ) : entries.length === 0 ? (
        /* Empty leaderboard state */
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="podium-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "600",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No rankings yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Rankings appear after the first match is scored
          </Text>
        </View>
      ) : (
        /* Leaderboard list */
        <>
          <FlatList
            data={entries}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={refetch}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig.current}
          />
          {/* Sticky footer: only visible when current user's row is not visible */}
          {myEntry && !myRowVisible && <StickyMyPosition entry={myEntry} />}
        </>
      )}
    </SafeAreaView>
  );
}
