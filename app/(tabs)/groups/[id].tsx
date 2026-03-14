import React from "react";
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
import { colors, APP_BASE_URL } from "@lib/constants";
import { useGroupDetail } from "@hooks/use-group-detail";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { group, loading, error } = useGroupDetail(id);

  const inviteUrl = group ? `${APP_BASE_URL}/join/${group.invite_code}` : "";

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
      <ScrollView
        testID="group-detail-screen"
        contentContainerStyle={{ padding: 24 }}
      >
        {/* Header */}
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 28,
            fontWeight: "700",
          }}
        >
          {group.name}
        </Text>
        {group.description ? (
          <Text
            style={{
              color: colors.textSecondary,
              marginTop: 8,
              fontSize: 15,
            }}
          >
            {group.description}
          </Text>
        ) : null}
        <Text
          style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}
        >
          {group.member_count} {group.member_count === 1 ? "member" : "members"}
        </Text>

        {/* Invite section */}
        <View
          style={{
            marginTop: 32,
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
          <Text
            testID="invite-code"
            style={{
              color: colors.primary,
              fontSize: 28,
              fontWeight: "700",
              letterSpacing: 6,
            }}
          >
            {group.invite_code}
          </Text>

          <View style={{ marginTop: 24 }}>
            <QRCode
              value={inviteUrl}
              size={200}
              color={colors.textPrimary}
              backgroundColor={colors.surface}
            />
          </View>

          <TouchableOpacity
            testID="copy-button"
            onPress={() => {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Clipboard = require("react-native").Clipboard;
              // TODO: migrate to @react-native-clipboard/clipboard (requires native module rebuild)
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
              Clipboard.setString(inviteUrl);
            }}
            style={{
              marginTop: 20,
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 8,
              paddingVertical: 10,
              paddingHorizontal: 24,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Copy invite link
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
            marginTop: 24,
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
