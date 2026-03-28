import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { colors, APP_BASE_URL } from "@lib/constants";
import { useGroupDetail } from "@hooks/use-group-detail";
import { useAuth } from "@hooks/use-auth";
import { ScreenHeader } from "@components/common/ScreenHeader";
import { MemberRow } from "@components/groups/MemberRow";
import { SkeletonMemberRow } from "@components/skeletons/SkeletonMemberRow";
import type { GroupMember } from "@lib/groups-service";

type Tab = "members" | "info";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { group, members, tournaments, loading, isRefreshing, error, refetch } =
    useGroupDetail(id);
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const hasMountedRef = useRef(false);

  // Refetch data when returning from another screen (e.g. manage-tournaments)
  useFocusEffect(
    useCallback(() => {
      if (hasMountedRef.current) {
        refetch();
      } else {
        hasMountedRef.current = true;
      }
    }, [refetch]),
  );

  const inviteUrl = group ? `${APP_BASE_URL}/join/${group.invite_code}` : "";
  const [copiedState, setCopiedState] = useState<"code" | "link" | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  function copyWithFeedback(text: string, type: "code" | "link") {
    Clipboard.setString(text);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    setCopiedState(type);
    copyTimeoutRef.current = setTimeout(() => setCopiedState(null), 1500);
  }

  if (loading && !isRefreshing) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="loading-indicator"
      >
        <ScreenHeader title="Loading..." />
        <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonMemberRow key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            testID="error-message"
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              fontSize: 15,
            }}
          >
            {error ?? "Group not found."}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Go back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={group.name} />

      {/* Tab bar */}
      <View
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceBorder,
        }}
      >
        {(["members", "info"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            testID={`tab-${tab}`}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1,
              paddingVertical: 12,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor:
                activeTab === tab ? colors.primary : "transparent",
            }}
          >
            <Text
              style={{
                color:
                  activeTab === tab ? colors.primary : colors.textSecondary,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {tab === "members" ? `Members (${members.length})` : "Info"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Members tab */}
      {activeTab === "members" && (
        <FlatList
          testID="members-list"
          data={members}
          keyExtractor={(item: GroupMember) => item.user_id}
          renderItem={({ item }: { item: GroupMember }) => (
            <MemberRow
              member={item}
              isCurrentUser={item.user_id === user?.id}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 24,
                fontSize: 14,
              }}
            >
              No members found.
            </Text>
          }
        />
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <ScrollView
          testID="group-info-tab"
          contentContainerStyle={{ padding: 24 }}
        >
          {/* Description */}
          {group.description ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              {group.description}
            </Text>
          ) : null}

          {/* Scoring system */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Scoring
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 24,
            }}
          >
            {(
              [
                {
                  label: "Exact score",
                  testId: "scoring-exact-score",
                  value: group.scoring_system.exact_score,
                },
                {
                  label: "Correct result",
                  testId: "scoring-correct-result",
                  value: group.scoring_system.correct_result,
                },
                {
                  label: "Goal difference",
                  testId: "scoring-goal-difference",
                  value: group.scoring_system.correct_goal_diff,
                },
                {
                  label: "Wrong",
                  testId: "scoring-wrong",
                  value: group.scoring_system.wrong,
                },
              ] as const
            ).map(({ label, testId, value }) => (
              <View
                key={label}
                testID={testId}
                style={{
                  width: "47%",
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                >
                  {label.toUpperCase()}
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 22,
                    fontWeight: "700",
                  }}
                >
                  {value} pts
                </Text>
              </View>
            ))}
          </View>

          {/* Tournaments */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              Tournaments
            </Text>
            {group.role === "admin" && (
              <TouchableOpacity
                testID="manage-tournaments-button"
                onPress={() =>
                  router.push(`/groups/manage-tournaments?groupId=${id}`)
                }
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Manage
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {tournaments.length === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginBottom: 24,
              }}
            >
              No tournaments assigned yet.
            </Text>
          ) : (
            <View style={{ marginBottom: 24, gap: 8 }}>
              {tournaments.map((t) => (
                <View
                  key={t.id}
                  testID={`tournament-${t.id}`}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
                    {t.name}
                    {t.short_name ? ` (${t.short_name})` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Invite section */}
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            Invite
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              INVITE CODE
            </Text>

            <TouchableOpacity
              testID="invite-code"
              onPress={() => copyWithFeedback(group.invite_code, "code")}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.primary + "4D",
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: 18,
                width: "100%",
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 26,
                  fontWeight: "700",
                  letterSpacing: 6,
                }}
              >
                {group.invite_code}
              </Text>
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
            </TouchableOpacity>

            {copiedState !== null ? (
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  marginTop: 6,
                  marginBottom: 4,
                }}
              >
                {copiedState === "code" ? "Code copied!" : "Link copied!"}
              </Text>
            ) : null}

            <View
              style={{
                marginTop: 24,
                backgroundColor: "#FFFFFF",
                padding: 8,
                borderRadius: 8,
              }}
            >
              <QRCode value={inviteUrl} size={160} color="#000000" />
            </View>

            <TouchableOpacity
              testID="copy-link-button"
              onPress={() => copyWithFeedback(inviteUrl, "link")}
              style={{
                marginTop: 16,
                width: "100%",
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                borderRadius: 8,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name="link-outline"
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Copy link
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="share-button"
            onPress={async () => {
              try {
                await Share.share({
                  message: `Join my group "${group.name}" on PencaViva: ${inviteUrl}`,
                  url: inviteUrl,
                });
              } catch {
                // User cancelled share — no action needed
              }
            }}
            style={{
              marginTop: 16,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#000000", fontWeight: "700", fontSize: 16 }}>
              Share with friends
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
