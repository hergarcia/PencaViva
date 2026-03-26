import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@components/common/EmptyState";
import { colors } from "@lib/constants";
import { GroupCard } from "@components/groups/GroupCard";
import { SkeletonGroupCard } from "@components/skeletons/SkeletonGroupCard";
import { useUserGroups } from "@hooks/use-user-groups";
import type { UserGroup } from "@lib/groups-service";

export default function GroupsScreen() {
  const router = useRouter();
  const {
    groups,
    isLoading,
    isRefreshing,
    error: fetchError,
    refetch,
  } = useUserGroups();

  const [menuVisible, setMenuVisible] = useState(false);
  const menuAnchorRef = useRef<View>(null);

  const handleGroupPress = useCallback(
    (groupId: string) => {
      router.push(`/groups/${groupId}`);
    },
    [router],
  );

  const handleCreateGroup = useCallback(() => {
    setMenuVisible(false);
    router.push("/groups/create");
  }, [router]);

  const handleJoinGroup = useCallback(() => {
    setMenuVisible(false);
    router.push("/groups/join");
  }, [router]);

  // ── Loading state ───────────────────────────────────────────────

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="groups-screen"
      >
        <View style={{ padding: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            My Groups
          </Text>
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonGroupCard key={i} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────

  if (fetchError) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="groups-screen"
      >
        <View style={{ padding: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            My Groups
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{ color: colors.textPrimary, textAlign: "center" }}
            testID="error-message"
          >
            {fetchError}
          </Text>
          <TouchableOpacity
            onPress={refetch}
            style={{ marginTop: 16 }}
            testID="retry-button"
          >
            <Text style={{ color: colors.primary }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────

  if (groups.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.background }}
        testID="groups-screen"
      >
        <View style={{ padding: 24 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            My Groups
          </Text>
        </View>
        <EmptyState
          icon="people-outline"
          iconSize={64}
          title="No groups yet"
          description="Create a group to start predicting with friends, or join one with an invite code."
          actions={[
            {
              label: "Create Group",
              onPress: () => router.push("/groups/create"),
              variant: "primary",
              testID: "create-group-button",
            },
            {
              label: "Join Group",
              onPress: () => router.push("/groups/join"),
              variant: "outline",
              testID: "join-group-button",
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  // ── Groups list ─────────────────────────────────────────────────

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="groups-screen"
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 24,
          paddingBottom: 12,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 28,
            fontWeight: "bold",
          }}
        >
          My Groups
        </Text>
        <TouchableOpacity
          testID="header-add-button"
          onPress={() => setMenuVisible(true)}
          style={{
            backgroundColor: colors.primary + "20",
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
          ref={menuAnchorRef}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Action menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setMenuVisible(false)}>
          <View
            style={{
              position: "absolute",
              top: 100,
              right: 20,
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              minWidth: 180,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <TouchableOpacity
              testID="menu-create-group"
              onPress={handleCreateGroup}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.surfaceBorder,
              }}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>
                Create Group
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="menu-join-group"
              onPress={handleJoinGroup}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 14,
              }}
            >
              <Ionicons name="enter-outline" size={20} color={colors.primary} />
              <Text style={{ color: colors.textPrimary, fontSize: 15 }}>
                Join Group
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <FlatList<UserGroup>
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard group={item} onPress={handleGroupPress} />
        )}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        testID="groups-list"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}
