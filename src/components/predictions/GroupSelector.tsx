import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@lib/constants";
import type { UserGroup } from "@lib/groups-service";

type GroupSelectorProps = {
  groups: UserGroup[];
  activeGroup: UserGroup | null;
  onSelect: (groupId: string) => void;
};

export function GroupSelector({
  groups,
  activeGroup,
  onSelect,
}: GroupSelectorProps) {
  const [visible, setVisible] = useState(false);

  const handleSelect = (groupId: string) => {
    onSelect(groupId);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        testID="group-selector-button"
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          gap: 4,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 14,
            fontWeight: "500",
          }}
          numberOfLines={1}
        >
          {activeGroup?.name ?? "Select group"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setVisible(false)}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              maxHeight: 400,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              Select Group
            </Text>
            <FlatList
              data={groups}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor:
                      item.id === activeGroup?.id
                        ? colors.primary + "15"
                        : "transparent",
                  }}
                >
                  <Text
                    style={{
                      color:
                        item.id === activeGroup?.id
                          ? colors.primary
                          : colors.textPrimary,
                      fontSize: 15,
                      fontWeight: item.id === activeGroup?.id ? "600" : "400",
                    }}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
