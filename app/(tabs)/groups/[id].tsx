import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";
import Clipboard from "@react-native-clipboard/clipboard";
import { colors, APP_BASE_URL } from "@lib/constants";
import { useGroupDetail } from "@hooks/use-group-detail";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { group, loading, error } = useGroupDetail(id);

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

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="loading-indicator"
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={colors.primary} size="large" />
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
      {/* Header bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceBorder,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          testID="back-button"
          style={{ padding: 4, marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: "700",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {group.name}
        </Text>
      </View>

      <ScrollView
        testID="group-detail-screen"
        contentContainerStyle={{ padding: 24 }}
      >
        {/* Group info */}
        {group.description ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 15,
              marginBottom: 4,
            }}
          >
            {group.description}
          </Text>
        ) : null}
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {group.member_count} {group.member_count === 1 ? "member" : "members"}
        </Text>

        {/* Invite section */}
        <View
          style={{
            marginTop: 24,
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

          {/* Tap-to-copy code pill */}
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

          {/* Inline copy feedback */}
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

          {/* QR code */}
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

          {/* Copy link button */}
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

        {/* Share button */}
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
    </SafeAreaView>
  );
}
