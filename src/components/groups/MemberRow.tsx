import React from "react";
import { View, Text } from "react-native";
import { colors } from "@lib/constants";
import type { GroupMember, GroupRole } from "@lib/groups-service";

const ROLE_LABEL: Record<GroupRole, string> = {
  admin: "Admin",
  moderator: "Mod",
  member: "Member",
};

const ROLE_COLOR: Record<GroupRole, string> = {
  admin: colors.accent,
  moderator: colors.secondary,
  member: colors.textSecondary,
};

interface MemberRowProps {
  member: GroupMember;
  isCurrentUser: boolean;
}

export function MemberRow({ member, isCurrentUser }: MemberRowProps) {
  const letter = member.display_name.charAt(0).toUpperCase();

  return (
    <View
      testID={`member-row-${member.user_id}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceBorder,
      }}
    >
      {/* Letter avatar */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary + "33",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Text
          style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
        >
          {letter}
        </Text>
      </View>

      {/* Name + username */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 15,
            }}
            numberOfLines={1}
          >
            {member.display_name}
          </Text>
          {isCurrentUser && (
            <Text
              testID={`you-badge-${member.user_id}`}
              style={{ color: colors.primary, fontSize: 11 }}
            >
              You
            </Text>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          @{member.username}
        </Text>
      </View>

      {/* Role badge */}
      <Text
        testID={`role-badge-${member.user_id}`}
        style={{
          color: ROLE_COLOR[member.role],
          fontSize: 12,
          fontWeight: "600",
          marginLeft: 8,
        }}
      >
        {ROLE_LABEL[member.role]}
      </Text>
    </View>
  );
}
