import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { colors } from "@lib/constants";
import type { UserGroup } from "@lib/groups-service";

type GroupCardProps = {
  group: UserGroup;
  onPress: (groupId: string) => void;
};

export function GroupCard({ group, onPress }: GroupCardProps) {
  const initial = group.name[0]?.toUpperCase() ?? "?";
  const memberLabel =
    group.member_count === 1
      ? `${group.member_count} member`
      : `${group.member_count} members`;
  const showRoleBadge = group.role !== "member";

  return (
    <TouchableOpacity
      testID={`group-card-${group.id}`}
      onPress={() => onPress(group.id)}
      activeOpacity={0.7}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {/* Avatar */}
      {group.avatar_url ? (
        <Image
          source={{ uri: group.avatar_url }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
          testID="group-avatar-image"
        />
      ) : (
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.primary + "20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 20,
              fontWeight: "bold",
            }}
          >
            {initial}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {group.name}
          </Text>
          {showRoleBadge && (
            <View
              testID="role-badge"
              style={{
                backgroundColor: colors.primary + "20",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 8,
                marginLeft: 8,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {group.role}
              </Text>
            </View>
          )}
        </View>

        {group.description ? (
          <Text
            testID="group-description"
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {group.description}
          </Text>
        ) : null}

        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {memberLabel}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
