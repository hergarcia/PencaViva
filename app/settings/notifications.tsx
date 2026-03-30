import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Switch,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@hooks/use-auth";
import { useToast } from "@components/Toast";
import { ScreenHeader } from "@components/common/ScreenHeader";
import {
  fetchNotificationSettings,
  saveNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@lib/notifications-service";
import { colors } from "@lib/constants";

// ── Types ────────────────────────────────────────────────────────────

type ToggleRow = {
  key: keyof Pick<
    NotificationSettings,
    "reminders" | "results" | "ranking" | "invitations"
  >;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
};

// ── Constants ────────────────────────────────────────────────────────

const TOGGLE_ROWS: ToggleRow[] = [
  {
    key: "reminders",
    icon: "alarm-outline",
    label: "Match Reminders",
    description: "Notified before a match kicks off",
  },
  {
    key: "results",
    icon: "football-outline",
    label: "Match Results",
    description: "Score updates when a match finishes",
  },
  {
    key: "ranking",
    icon: "trophy-outline",
    label: "Ranking Changes",
    description: "Alerts when your position changes",
  },
  {
    key: "invitations",
    icon: "people-outline",
    label: "Group Invitations",
    description: "When someone invites you to a group",
  },
];

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: string): boolean {
  return HH_MM_PATTERN.test(value);
}

// ── Component ────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    fetchNotificationSettings(user.id)
      .then((s) => setSettings(s))
      .catch(() => showToast("error", "Failed to load notification settings"))
      .finally(() => setIsLoading(false));
  }, [user?.id, showToast]);

  // ── Save (auto-save on each toggle) ──────────────────────────────

  const persist = useCallback(
    async (next: NotificationSettings) => {
      if (!user?.id) return;
      setIsSaving(true);
      try {
        await saveNotificationSettings(user.id, next);
      } catch {
        showToast("error", "Failed to save settings");
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, showToast],
  );

  const handleToggle = useCallback(
    (key: keyof NotificationSettings, value: boolean) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const handleTimeChange = useCallback(
    (field: "quietFrom" | "quietTo", value: string) => {
      setSettings((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleTimeBlur = useCallback(
    (field: "quietFrom" | "quietTo") => {
      if (!isValidTime(settings[field])) {
        // Reset to default on invalid input
        setSettings((prev) => ({
          ...prev,
          [field]: DEFAULT_NOTIFICATION_SETTINGS[field],
        }));
        showToast("error", "Enter time as HH:MM (e.g. 22:00)");
        return;
      }
      void persist(settings);
    },
    [settings, persist, showToast],
  );

  // ── Render ───────────────────────────────────────────────────────

  if (!user) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="notification-settings-screen"
    >
      <ScreenHeader title="Notification Settings" />

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 40 }}
          testID="loading-indicator"
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Saving indicator */}
          {isSaving && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 16,
              }}
            >
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Saving…
              </Text>
            </View>
          )}

          {/* Notification type toggles */}
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "bold",
              marginBottom: 8,
              fontSize: 13,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Notification Types
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: colors.surfaceBorder,
              marginBottom: 8,
            }}
          />

          {TOGGLE_ROWS.map((row, index) => (
            <View
              key={row.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                borderBottomWidth: index < TOGGLE_ROWS.length - 1 ? 1 : 0,
                borderBottomColor: colors.surfaceBorder,
              }}
              testID={`toggle-row-${row.key}`}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons
                  name={row.icon}
                  size={18}
                  color={
                    settings[row.key] ? colors.primary : colors.textSecondary
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: "600",
                  }}
                >
                  {row.label}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {row.description}
                </Text>
              </View>
              <Switch
                value={settings[row.key]}
                onValueChange={(v) => handleToggle(row.key, v)}
                trackColor={{
                  false: colors.surfaceBorder,
                  true: colors.primary,
                }}
                thumbColor={colors.textPrimary}
                testID={`switch-${row.key}`}
              />
            </View>
          ))}

          {/* Quiet hours */}
          <Text
            style={{
              color: colors.textSecondary,
              fontWeight: "bold",
              marginTop: 32,
              marginBottom: 8,
              fontSize: 13,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Quiet Hours
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: colors.surfaceBorder,
              marginBottom: 8,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 14,
              borderBottomWidth: settings.quietHoursEnabled ? 1 : 0,
              borderBottomColor: colors.surfaceBorder,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons
                name="moon-outline"
                size={18}
                color={
                  settings.quietHoursEnabled
                    ? colors.secondary
                    : colors.textSecondary
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Enable Quiet Hours
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Silence all notifications during a time window
              </Text>
            </View>
            <Switch
              value={settings.quietHoursEnabled}
              onValueChange={(v) => handleToggle("quietHoursEnabled", v)}
              trackColor={{
                false: colors.surfaceBorder,
                true: colors.secondary,
              }}
              thumbColor={colors.textPrimary}
              testID="switch-quiet-hours"
            />
          </View>

          {settings.quietHoursEnabled && (
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                paddingTop: 16,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  From (HH:MM)
                </Text>
                <TextInput
                  value={settings.quietFrom}
                  onChangeText={(v) => handleTimeChange("quietFrom", v)}
                  onBlur={() => handleTimeBlur("quietFrom")}
                  placeholder="22:00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    padding: 12,
                    borderRadius: 12,
                    fontSize: 16,
                    textAlign: "center",
                    borderWidth: 1,
                    borderColor: isValidTime(settings.quietFrom)
                      ? colors.surfaceBorder
                      : colors.danger,
                  }}
                  testID="input-quiet-from"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginBottom: 6,
                  }}
                >
                  Until (HH:MM)
                </Text>
                <TextInput
                  value={settings.quietTo}
                  onChangeText={(v) => handleTimeChange("quietTo", v)}
                  onBlur={() => handleTimeBlur("quietTo")}
                  placeholder="08:00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    padding: 12,
                    borderRadius: 12,
                    fontSize: 16,
                    textAlign: "center",
                    borderWidth: 1,
                    borderColor: isValidTime(settings.quietTo)
                      ? colors.surfaceBorder
                      : colors.danger,
                  }}
                  testID="input-quiet-to"
                />
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
