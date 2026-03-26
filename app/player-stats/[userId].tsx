import React, { useCallback } from "react";
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { colors } from "@lib/constants";
import { usePlayerStats } from "@hooks/use-player-stats";
import { PlayerStatsHeader } from "@components/ranking/PlayerStatsHeader";
import { StatsGrid } from "@components/ranking/StatsGrid";
import { StreakDisplay } from "@components/ranking/StreakDisplay";
import { PredictionHistoryRow } from "@components/ranking/PredictionHistoryRow";
import { SkeletonPredictionHistoryRow } from "@components/skeletons/SkeletonPredictionHistoryRow";
import type { PlayerPredictionRecord } from "@lib/player-stats-service";

type Section = {
  title: string;
  data: PlayerPredictionRecord[];
};

function groupByDate(predictions: PlayerPredictionRecord[]): Section[] {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const map = new Map<string, PlayerPredictionRecord[]>();

  for (const pred of predictions) {
    const local = new TZDate(pred.match.kickoff_time, tz);
    const key = format(local, "MMM d, yyyy");
    const arr = map.get(key);
    if (arr) {
      arr.push(pred);
    } else {
      map.set(key, [pred]);
    }
  }

  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

export default function PlayerStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    userId: string;
    groupId: string;
    displayName: string;
    username: string;
    avatarUrl: string;
    position: string;
    totalPoints: string;
    exactScores: string;
    correctResults: string;
    matchesPlayed: string;
  }>();

  const userId = params.userId;
  const groupId = params.groupId;

  const { predictions, streaks, isLoading, isRefreshing, error, refetch } =
    usePlayerStats(userId, groupId);

  const sections = groupByDate(predictions);

  const renderItem = useCallback(
    ({ item }: { item: PlayerPredictionRecord }) => (
      <PredictionHistoryRow prediction={item} />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View
        style={{
          backgroundColor: colors.background,
          paddingHorizontal: 16,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  const position = Number(params.position) || 0;
  const totalPoints = Number(params.totalPoints) || 0;
  const exactScores = Number(params.exactScores) || 0;
  const correctResults = Number(params.correctResults) || 0;
  const matchesPlayed = Number(params.matchesPlayed) || 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top bar with back button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <TouchableOpacity
          testID="back-button"
          onPress={() => router.back()}
          style={{ padding: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "600",
            marginLeft: 4,
          }}
        >
          Player Stats
        </Text>
      </View>

      {isLoading && !isRefreshing ? (
        <View testID="loading-indicator" style={{ paddingTop: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonPredictionHistoryRow key={i} />
          ))}
        </View>
      ) : error ? (
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
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={
            <>
              <PlayerStatsHeader
                displayName={params.displayName || "Player"}
                username={params.username || "unknown"}
                avatarUrl={params.avatarUrl || null}
                userId={userId}
                position={position}
                totalPoints={totalPoints}
              />
              <StatsGrid
                matchesPlayed={matchesPlayed}
                exactScores={exactScores}
                correctResults={correctResults}
                totalPoints={totalPoints}
              />
              <StreakDisplay
                currentStreak={streaks.currentStreak}
                bestStreak={streaks.bestStreak}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  fontWeight: "600",
                  paddingHorizontal: 16,
                  paddingTop: 20,
                  paddingBottom: 8,
                }}
              >
                PREDICTION HISTORY
              </Text>
            </>
          }
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                paddingVertical: 32,
                paddingHorizontal: 32,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={40}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                No predictions scored yet
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
