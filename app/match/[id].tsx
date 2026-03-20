import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { colors } from "@lib/constants";
import { useGroupStore } from "@stores/group-store";
import { useMatchDetail } from "@hooks/use-match-detail";
import { useCountdown } from "@hooks/use-countdown";
import { ScoreStepper } from "@components/predictions/ScoreStepper";
import { SaveConfirmation } from "@components/predictions/SaveConfirmation";
import { GroupPredictions } from "@components/predictions/GroupPredictions";
import { useAuth } from "@hooks/use-auth";
import { useGroupDetail } from "@hooks/use-group-detail";

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { user } = useAuth();
  const { group } = useGroupDetail(activeGroupId ?? "");

  const {
    match,
    prediction,
    isLoading,
    error,
    refetch,
    save,
    isSaving,
    saveError,
    isLockedByServer,
  } = useMatchDetail(id, activeGroupId);

  const { isExpired, formatted: countdownFormatted } = useCountdown(
    match?.kickoff_time ?? null,
  );

  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Show saveError for 3s then auto-clear (for read-only section after RLS transition)
  useEffect(() => {
    if (!saveError) {
      setErrorBanner(null);
      return;
    }
    setErrorBanner(saveError);
    const timeoutId = setTimeout(() => setErrorBanner(null), 3000);
    return () => clearTimeout(timeoutId);
  }, [saveError]);

  // Derive displayed scores (stepper state or prediction fallback)
  const displayHome = homeScore ?? prediction?.home_score_pred ?? 0;
  const displayAway = awayScore ?? prediction?.away_score_pred ?? 0;

  const isEditable =
    match?.status === "scheduled" && !isExpired && !isLockedByServer;

  const isChanged =
    prediction != null
      ? displayHome !== prediction.home_score_pred ||
        displayAway !== prediction.away_score_pred
      : homeScore !== null || awayScore !== null;

  const handleSave = useCallback(async () => {
    const success = await save(displayHome, displayAway);
    if (success) {
      setShowConfirmation(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHomeScore(null);
      setAwayScore(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [save, displayHome, displayAway]);

  // ── Loading ──
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header onBack={() => router.back()} />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Header onBack={() => router.back()} />
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
            {error ?? "Match not found"}
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
      </SafeAreaView>
    );
  }

  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScores = isLive || isFinished;
  const kickoffFormatted = format(
    new Date(match.kickoff_time),
    "EEE, MMM d · h:mm a",
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        onBack={() => router.back()}
        title={match.tournament_short_name ?? "Match Detail"}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Tournament */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {match.tournament_name}
          </Text>
          {isLive && (
            <View
              style={{
                backgroundColor: "#FF4444",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {/* Matchday */}
        {match.matchday != null && (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Matchday {match.matchday}
          </Text>
        )}

        {/* Teams + Scores */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <TeamRow
            name={match.home_team_name}
            logo={match.home_team_logo}
            score={showScores ? match.home_score : null}
          />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              fontWeight: "600",
              marginVertical: 8,
            }}
          >
            {showScores ? "" : "vs"}
          </Text>
          <TeamRow
            name={match.away_team_name}
            logo={match.away_team_logo}
            score={showScores ? match.away_score : null}
          />
        </View>

        {/* Time + Venue */}
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {kickoffFormatted}
          </Text>
          {match.venue && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {match.venue}
            </Text>
          )}
        </View>

        {/* Prediction section */}
        {activeGroupId && (
          <View style={{ marginTop: 28 }}>
            {isEditable ? (
              <>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  Your Prediction
                </Text>

                {/* Countdown label */}
                {countdownFormatted !== "" && (
                  <Text
                    style={{
                      color: colors.accent,
                      fontSize: 13,
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    Locks in {countdownFormatted}
                  </Text>
                )}

                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                  }}
                >
                  <ScoreStepper
                    teamName={match.home_team_name}
                    teamLogo={match.home_team_logo}
                    score={displayHome}
                    onIncrement={() => setHomeScore(displayHome + 1)}
                    onDecrement={() => setHomeScore(displayHome - 1)}
                  />
                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.surfaceBorder,
                      marginHorizontal: 4,
                    }}
                  />
                  <ScoreStepper
                    teamName={match.away_team_name}
                    teamLogo={match.away_team_logo}
                    score={displayAway}
                    onIncrement={() => setAwayScore(displayAway + 1)}
                    onDecrement={() => setAwayScore(displayAway - 1)}
                  />
                </View>

                {/* Save button */}
                <TouchableOpacity
                  testID="save-prediction-btn"
                  onPress={handleSave}
                  disabled={isSaving || (!isChanged && prediction != null)}
                  style={{
                    backgroundColor:
                      isSaving || (!isChanged && prediction != null)
                        ? colors.surfaceBorder
                        : colors.primary,
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    marginTop: 20,
                  }}
                >
                  <Text
                    style={{
                      color:
                        isSaving || (!isChanged && prediction != null)
                          ? colors.textSecondary
                          : colors.background,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {isSaving
                      ? "Saving..."
                      : prediction != null
                        ? "Update Prediction"
                        : "Save Prediction"}
                  </Text>
                </TouchableOpacity>

                {/* Save error (editable branch) */}
                {saveError && (
                  <Text
                    style={{
                      color: "#FF4444",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    {saveError}
                  </Text>
                )}
              </>
            ) : (
              /* Read-only prediction display */
              <View style={{ alignItems: "center", marginTop: 8 }}>
                {prediction ? (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 16,
                        fontWeight: "600",
                        marginTop: 8,
                      }}
                    >
                      Your prediction: {prediction.home_score_pred} –{" "}
                      {prediction.away_score_pred}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="lock-closed"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 14,
                        marginTop: 8,
                      }}
                    >
                      No prediction submitted
                    </Text>
                  </>
                )}

                {/* Error banner — auto-clears after 3s (RLS transition) */}
                {errorBanner && (
                  <Text
                    style={{
                      color: "#FF4444",
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 12,
                    }}
                  >
                    {errorBanner}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Group predictions (visible after kickoff) */}
        {activeGroupId && user?.id && group && (
          <GroupPredictions
            matchId={id ?? ""}
            groupId={activeGroupId}
            matchStatus={match.status}
            homeScore={match.home_score}
            awayScore={match.away_score}
            currentUserId={user.id}
            scoringSystem={group.scoring_system}
          />
        )}
      </ScrollView>

      <SaveConfirmation
        visible={showConfirmation}
        onDismiss={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function Header({
  onBack,
  title = "Match Detail",
}: {
  onBack: () => void;
  title?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <TouchableOpacity
        testID="back-button"
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "600",
          marginLeft: 12,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function TeamRow({
  name,
  logo,
  score,
}: {
  name: string;
  logo: string | null;
  score: number | null;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", width: "100%" }}>
      {logo ? (
        <Image
          source={{ uri: logo }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
        />
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {name[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginLeft: 12,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
      {score != null && (
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {score}
        </Text>
      )}
    </View>
  );
}
