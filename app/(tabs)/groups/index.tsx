import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@hooks/use-auth";
import { fetchUserGroups } from "@lib/groups-service";
import { colors } from "@lib/constants";
import { GroupCard } from "@components/groups/GroupCard";
import type { UserGroup } from "@lib/groups-service";

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuAnchorRef = useRef<View>(null);

  const loadGroups = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await fetchUserGroups(user.id);
      setGroups(data);
    } catch {
      setFetchError("Failed to load groups.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleGroupPress = useCallback(
    (groupId: string) => {
      router.push(`/(tabs)/groups/${groupId}`);
    },
    [router],
  );

  const handleCreateGroup = useCallback(() => {
    setMenuVisible(false);
    router.push("/(tabs)/groups/create");
  }, [router]);

  const handleJoinGroup = useCallback(() => {
    setMenuVisible(false);
    router.push("/(tabs)/groups/join");
  }, [router]);

  // ── Guards ──────────────────────────────────────────────────────

  if (!user) return null;

  // ── Loading state ───────────────────────────────────────────────

  if (isLoading) {
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
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator
            size="large"
            color={colors.primary}
            testID="loading-indicator"
          />
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
            onPress={loadGroups}
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
        <View
          testID="empty-state"
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Ionicons
            name="people-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "bold",
              marginTop: 16,
            }}
          >
            No groups yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 8,
              lineHeight: 20,
            }}
          >
            Create a group to start predicting with friends, or join one with an
            invite code.
          </Text>

          <TouchableOpacity
            testID="create-group-button"
            onPress={handleCreateGroup}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 24,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              Create Group
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="join-group-button"
            onPress={handleJoinGroup}
            style={{
              borderColor: colors.surfaceBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 32,
              marginTop: 12,
              width: "100%",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontWeight: "bold",
                fontSize: 16,
              }}
            >
              Join Group
            </Text>
          </TouchableOpacity>
        </View>
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

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <GroupCard group={item} onPress={handleGroupPress} />
        )}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
        testID="groups-list"
      />
    </SafeAreaView>
  );
}
