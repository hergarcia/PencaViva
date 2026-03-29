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
import { ErrorState } from "@components/ErrorState";
import { useToast } from "@components/Toast";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { colors } from "@lib/constants";
import {
  getPredictionStatus,
  calculatePotentialPoints,
} from "@lib/scoring-utils";
import type { PredictionStatus } from "@lib/scoring-utils";
import { useGroupStore } from "@stores/group-store";
import { useMatchDetail } from "@hooks/use-match-detail";
import { useCountdown } from "@hooks/use-countdown";
import { ScoreStepper } from "@components/predictions/ScoreStepper";
import { SaveConfirmation } from "@components/predictions/SaveConfirmation";
import { GroupPredictions } from "@components/predictions/GroupPredictions";
import { LivePulse } from "@components/predictions/LivePulse";
import { ExactStar } from "@components/common/ExactStar";
import { useAuth } from "@hooks/use-auth";
import { useGroupDetail } from "@hooks/use-group-detail";

function getResultStyle(status: PredictionStatus) {
  switch (status) {
    case "exact":
      return {
        color: colors.exact,
        label: "Exact Score!",
        bg: colors.exact + "26",
      };
    case "correct_result_and_diff":
      return {
        color: colors.success,
        label: "Correct Result",
        bg: colors.success + "26",
      };
    case "correct_result":
      return {
        color: colors.success,
        label: "Correct Result",
        bg: colors.success + "26",
      };
    case "wrong":
      return { color: colors.wrong, label: "Wrong", bg: colors.wrong + "26" };
  }
}

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
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

  useEffect(() => {
    if (error) showToast("error", error);
  }, [error, showToast]);

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
      showToast("success", "Prediction saved!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHomeScore(null);
      setAwayScore(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [save, displayHome, displayAway, showToast]);

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
        <ErrorState message={error ?? "Match not found"} onRetry={refetch} />
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
        title={match.tournament_short_name ?? match.tournament_name}
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* Tournament + Status row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 4,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {match.tournament_name}
            {match.matchday != null ? ` · Matchday ${match.matchday}` : ""}
          </Text>
          {isLive && (
            <View
              style={{
                backgroundColor: colors.live,
                paddingHorizontal: 8,
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

        {/* ── Score Hero (live/finished) ── */}
        {showScores && (
          <View
            style={{ alignItems: "center", marginTop: 24, marginBottom: 8 }}
          >
            {/* Finished badge */}
            {isFinished && (
              <View
                style={{
                  backgroundColor: colors.surfaceBorder + "80",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 6,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  FINISHED
                </Text>
              </View>
            )}

            {/* Teams + Scores row */}
            <View
              testID="score-hero"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                paddingHorizontal: 8,
              }}
            >
              {/* Home team */}
              <View style={{ flex: 1, alignItems: "center" }}>
                <TeamLogo
                  logo={match.home_team_logo}
                  name={match.home_team_name}
                  size={56}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontWeight: "600",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                  numberOfLines={2}
                >
                  {match.home_team_name}
                </Text>
              </View>

              {/* Scores */}
              <View
                style={{
                  alignItems: "center",
                  paddingHorizontal: 4,
                  minWidth: 100,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 10,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 40,
                      fontWeight: "700",
                    }}
                  >
                    {match.home_score ?? 0}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 22,
                      fontWeight: "500",
                    }}
                  >
                    -
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 40,
                      fontWeight: "700",
                    }}
                  >
                    {match.away_score ?? 0}
                  </Text>
                </View>
              </View>

              {/* Away team */}
              <View style={{ flex: 1, alignItems: "center" }}>
                <TeamLogo
                  logo={match.away_team_logo}
                  name={match.away_team_name}
                  size={56}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontWeight: "600",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                  numberOfLines={2}
                >
                  {match.away_team_name}
                </Text>
              </View>
            </View>

            {/* Date + Venue (below hero) */}
            <View style={{ alignItems: "center", marginTop: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {kickoffFormatted}
              </Text>
              {match.venue && (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {match.venue}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Prediction Section ── */}
        {activeGroupId && (
          <View style={{ marginTop: showScores ? 20 : 24 }}>
            {isEditable ? (
              <>
                {/* "Your Prediction" heading — centered */}
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontWeight: "700",
                    textAlign: "center",
                    marginBottom: 8,
                  }}
                >
                  Your Prediction
                </Text>

                {/* Countdown pill */}
                {countdownFormatted !== "" && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.accent,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.accent,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Locks in {countdownFormatted}
                    </Text>
                  </View>
                )}

                {/* Stepper card with green indicator */}
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: colors.cardRadius,
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <View
                    testID="prediction-card-indicator"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      backgroundColor: colors.primary,
                      borderTopLeftRadius: colors.cardRadius,
                      borderBottomLeftRadius: colors.cardRadius,
                    }}
                  />
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
                      color: colors.danger,
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    {saveError}
                  </Text>
                )}

                {/* Group predictions locked message */}
                <View style={{ marginTop: 28 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 12,
                    }}
                  >
                    GROUP PREDICTIONS
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: colors.cardRadius,
                      padding: 24,
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        marginTop: 8,
                      }}
                    >
                      Predictions will appear after kickoff
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                {/* ── Live state — with prediction ── */}
                {isLive && prediction && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: colors.cardRadius,
                      padding: colors.cardPadding,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: colors.live,
                        borderTopLeftRadius: colors.cardRadius,
                        borderBottomLeftRadius: colors.cardRadius,
                      }}
                    />
                    {/* Header: YOUR PREDICTION + LIVE */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                          fontWeight: "700",
                        }}
                      >
                        YOUR PREDICTION
                      </Text>
                      <View
                        testID="live-indicator"
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <LivePulse />
                        <Text
                          style={{
                            color: colors.live,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          LIVE
                        </Text>
                      </View>
                    </View>

                    {/* Score comparison columns */}
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            marginBottom: 6,
                          }}
                        >
                          Prediction
                        </Text>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 28,
                            fontWeight: "700",
                          }}
                        >
                          {prediction.home_score_pred} -{" "}
                          {prediction.away_score_pred}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 1,
                          height: 44,
                          backgroundColor: colors.surfaceBorder,
                        }}
                      />
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            marginBottom: 6,
                          }}
                        >
                          Current Score
                        </Text>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontSize: 28,
                            fontWeight: "700",
                          }}
                        >
                          {match.home_score} - {match.away_score}
                        </Text>
                      </View>
                    </View>

                    {/* Live status pill */}
                    {match.home_score != null &&
                      match.away_score != null &&
                      (() => {
                        const status = getPredictionStatus(
                          prediction.home_score_pred,
                          prediction.away_score_pred,
                          match.home_score!,
                          match.away_score!,
                        );
                        const style = getResultStyle(status);
                        const points = group
                          ? calculatePotentialPoints(
                              prediction.home_score_pred,
                              prediction.away_score_pred,
                              match.home_score!,
                              match.away_score!,
                              group.scoring_system,
                            )
                          : 0;
                        return (
                          <View
                            testID="result-badge"
                            style={{
                              backgroundColor: style.bg,
                              borderRadius: 20,
                              paddingVertical: 10,
                              paddingHorizontal: 16,
                              alignItems: "center",
                              marginTop: 16,
                              flexDirection: "row",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            {status === "exact" && <ExactStar size={14} />}
                            <Text
                              style={{
                                color: style.color,
                                fontSize: 14,
                                fontWeight: "700",
                              }}
                            >
                              {style.label} +{points} pts
                            </Text>
                          </View>
                        );
                      })()}
                  </View>
                )}

                {/* ── Finished state — with prediction ── */}
                {isFinished && prediction && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: colors.cardRadius,
                      padding: colors.cardPadding,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {match.home_score != null &&
                      match.away_score != null &&
                      (() => {
                        const status = getPredictionStatus(
                          prediction.home_score_pred,
                          prediction.away_score_pred,
                          match.home_score!,
                          match.away_score!,
                        );
                        const style = getResultStyle(status);
                        const points = prediction.points ?? 0;
                        return (
                          <>
                            {/* Left indicator */}
                            <View
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 3,
                                backgroundColor: style.color,
                                borderTopLeftRadius: colors.cardRadius,
                                borderBottomLeftRadius: colors.cardRadius,
                              }}
                            />

                            {/* Result badge pill */}
                            <View
                              testID="result-badge"
                              style={{
                                backgroundColor: style.bg,
                                borderRadius: 12,
                                paddingVertical: 10,
                                alignItems: "center",
                                marginBottom: 16,
                                flexDirection: "row",
                                justifyContent: "center",
                                gap: 6,
                              }}
                            >
                              {status === "exact" && (
                                <ExactStar animated size={16} />
                              )}
                              <Text
                                style={{
                                  color: style.color,
                                  fontSize: 15,
                                  fontWeight: "700",
                                }}
                              >
                                {style.label}
                              </Text>
                            </View>

                            {/* Score comparison columns */}
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <View style={{ flex: 1, alignItems: "center" }}>
                                <Text
                                  style={{
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    marginBottom: 6,
                                  }}
                                >
                                  Your Prediction
                                </Text>
                                <Text
                                  style={{
                                    color: colors.textPrimary,
                                    fontSize: 28,
                                    fontWeight: "700",
                                  }}
                                >
                                  {prediction.home_score_pred} -{" "}
                                  {prediction.away_score_pred}
                                </Text>
                              </View>
                              <View
                                style={{
                                  width: 1,
                                  height: 44,
                                  backgroundColor: colors.surfaceBorder,
                                }}
                              />
                              <View style={{ flex: 1, alignItems: "center" }}>
                                <Text
                                  style={{
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    marginBottom: 6,
                                  }}
                                >
                                  Final Score
                                </Text>
                                <Text
                                  style={{
                                    color: colors.textPrimary,
                                    fontSize: 28,
                                    fontWeight: "700",
                                  }}
                                >
                                  {match.home_score} - {match.away_score}
                                </Text>
                              </View>
                            </View>

                            {/* Points display */}
                            <Text
                              style={{
                                color: style.color,
                                fontSize: 28,
                                fontWeight: "700",
                                textAlign: "center",
                                marginTop: 16,
                              }}
                            >
                              +{points} pts
                            </Text>
                          </>
                        );
                      })()}
                  </View>
                )}

                {/* ── No prediction (live or finished) ── */}
                {(isLive || isFinished) && !prediction && (
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: colors.cardRadius,
                      padding: 24,
                      overflow: "hidden",
                      position: "relative",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: isLive ? colors.live : colors.wrong,
                        borderTopLeftRadius: colors.cardRadius,
                        borderBottomLeftRadius: colors.cardRadius,
                      }}
                    />
                    <Ionicons
                      name="lock-closed"
                      size={28}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 15,
                        marginTop: 10,
                        fontWeight: "500",
                      }}
                    >
                      No prediction submitted
                    </Text>
                    <Text
                      style={{
                        color: colors.wrong,
                        fontSize: 18,
                        fontWeight: "700",
                        marginTop: 6,
                      }}
                    >
                      0 pts
                    </Text>
                  </View>
                )}

                {/* Error banner — auto-clears after 3s (RLS transition) */}
                {errorBanner && (
                  <Text
                    style={{
                      color: colors.danger,
                      fontSize: 13,
                      textAlign: "center",
                      marginTop: 12,
                    }}
                  >
                    {errorBanner}
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        {/* Group predictions (visible after kickoff) */}
        {activeGroupId && user?.id && group && !isEditable && (
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
          flex: 1,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
    </View>
  );
}

function TeamLogo({
  logo,
  name,
  size = 56,
}: {
  logo: string | null;
  name: string;
  size?: number;
}) {
  if (logo) {
    return (
      <Image
        source={{ uri: logo }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: size * 0.36,
          fontWeight: "700",
        }}
      >
        {name[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}
