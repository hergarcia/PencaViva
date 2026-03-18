import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { colors } from "@lib/constants";
import { PredictionBadge } from "./PredictionBadge";
import { format } from "date-fns";
import type { MatchWithPrediction } from "@lib/matches-service";

type MatchCardProps = {
  match: MatchWithPrediction;
  onPress: (matchId: string) => void;
};

function TeamLogo({ uri, teamName }: { uri: string | null; teamName: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 24, height: 24, borderRadius: 12 }}
      />
    );
  }

  const initial = teamName[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceBorder,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}
      >
        {initial}
      </Text>
    </View>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  return (
    <Text
      style={{
        color: colors.textPrimary,
        fontSize: 18,
        fontWeight: "700",
        width: 24,
        textAlign: "center",
      }}
    >
      {score != null ? String(score) : "-"}
    </Text>
  );
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScores = isLive || isFinished;
  const kickoffTime = format(new Date(match.kickoff_time), "h:mm a");

  return (
    <TouchableOpacity
      testID={`match-card-${match.id}`}
      onPress={() => onPress(match.id)}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isLive ? colors.accent + "40" : colors.surfaceBorder,
        opacity: isFinished ? 0.7 : 1,
      }}
    >
      {/* Tournament + Live badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{ color: colors.textSecondary, fontSize: 11, flex: 1 }}
          numberOfLines={1}
        >
          {match.tournament_name}
        </Text>
        {isLive && (
          <View
            style={{
              backgroundColor: "#FF4444",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
              LIVE
            </Text>
          </View>
        )}
      </View>

      {/* Teams + Scores */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 8 }}>
          {/* Home team */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TeamLogo
              uri={match.home_team_logo}
              teamName={match.home_team_name}
            />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {match.home_team_name}
            </Text>
            <ScoreDisplay score={showScores ? match.home_score : null} />
          </View>

          {/* Away team */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TeamLogo
              uri={match.away_team_logo}
              teamName={match.away_team_name}
            />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {match.away_team_name}
            </Text>
            <ScoreDisplay score={showScores ? match.away_score : null} />
          </View>
        </View>
      </View>

      {/* Bottom: Time/Venue + Prediction badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          marginTop: 10,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {kickoffTime}
            {match.venue ? ` · ${match.venue}` : ""}
          </Text>
        </View>
        <PredictionBadge
          status={match.prediction_status}
          predictedHome={match.predicted_home}
          predictedAway={match.predicted_away}
        />
      </View>
    </TouchableOpacity>
  );
}
