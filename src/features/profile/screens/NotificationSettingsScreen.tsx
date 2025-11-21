// screens/NotificationSettingsScreen.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SafeLayout from "@app/layout/SafeLayout";
import AppTopBar from "@app/layout/AppTopBar";
import {
  NegativeAlert,
  PositiveAlert,
} from "@shared/ui/AlertDialog";
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from "@utils/api/notifications";

const MORNING_KEY = "@notification_morning";
const EVENING_KEY = "@notification_evening";

export default function NotificationSettingsScreen({
  navigation,
}: {
  navigation: any;
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 서버 설정
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  // 로컬 설정 (오전/오후 구분)
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [eveningEnabled, setEveningEnabled] = useState(true);

  const [dialog, setDialog] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    kind?: "positive" | "negative";
  }>({ open: false });

  // 설정 로드
  const fetchSettings = useCallback(async () => {
    try {
      const [serverSettings, morningRaw, eveningRaw] = await Promise.all([
        getNotificationSettings(),
        AsyncStorage.getItem(MORNING_KEY),
        AsyncStorage.getItem(EVENING_KEY),
      ]);

      setSettings(serverSettings);

      // 로컬 설정 로드 (기본값: 서버 설정에 따름)
      if (morningRaw !== null) {
        setMorningEnabled(morningRaw === "true");
      } else {
        setMorningEnabled(serverSettings.scheduledRunningReminder);
      }

      if (eveningRaw !== null) {
        setEveningEnabled(eveningRaw === "true");
      } else {
        setEveningEnabled(serverSettings.scheduledRunningReminder);
      }
    } catch (err: any) {
      console.error("알림 설정 로드 실패:", err);
      setDialog({
        open: true,
        kind: "negative",
        title: "오류",
        message: err?.response?.data?.message || "설정을 불러오지 못했습니다.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 서버 설정 업데이트
  const handleUpdateSetting = useCallback(
    async (key: keyof NotificationSettings, value: boolean) => {
      if (!settings || saving) return;

      setSaving(true);
      try {
        const updated = await updateNotificationSettings({ [key]: value });
        setSettings(updated);

        // 전체 알림이 꺼지면 모든 개별 설정도 시각적으로 비활성화
        if (key === "allNotificationsEnabled" && !value) {
          // UI만 업데이트, 서버의 개별 설정은 유지
        }
      } catch (err: any) {
        console.error("알림 설정 업데이트 실패:", err);
        setDialog({
          open: true,
          kind: "negative",
          title: "오류",
          message: err?.response?.data?.message || "설정 변경에 실패했습니다.",
        });
      } finally {
        setSaving(false);
      }
    },
    [settings, saving]
  );

  // 오전/오후 개별 설정 업데이트
  const handleMorningToggle = useCallback(
    async (value: boolean) => {
      setMorningEnabled(value);
      await AsyncStorage.setItem(MORNING_KEY, String(value));

      // 오전/오후 중 하나라도 켜져있으면 서버에 true 전송
      const shouldEnable = value || eveningEnabled;
      if (settings?.scheduledRunningReminder !== shouldEnable) {
        handleUpdateSetting("scheduledRunningReminder", shouldEnable);
      }
    },
    [eveningEnabled, settings, handleUpdateSetting]
  );

  const handleEveningToggle = useCallback(
    async (value: boolean) => {
      setEveningEnabled(value);
      await AsyncStorage.setItem(EVENING_KEY, String(value));

      // 오전/오후 중 하나라도 켜져있으면 서버에 true 전송
      const shouldEnable = morningEnabled || value;
      if (settings?.scheduledRunningReminder !== shouldEnable) {
        handleUpdateSetting("scheduledRunningReminder", shouldEnable);
      }
    },
    [morningEnabled, settings, handleUpdateSetting]
  );

  if (loading) {
    return (
      <SafeLayout withBottomInset={false} withTopInset={false}>
        <AppTopBar
          title="알림 설정"
          navigation={navigation}
          showBackButton
          backgroundColor="#F5F5F5"
          borderBottomColor="#F5F5F5"
        />
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      </SafeLayout>
    );
  }

  const masterEnabled = settings?.allNotificationsEnabled ?? true;

  return (
    <SafeLayout withBottomInset={false} withTopInset={false}>
      <View style={styles.container}>
        {/* Alerts */}
        {dialog.open && dialog.kind === "positive" && (
          <PositiveAlert
            visible
            title={dialog.title}
            message={dialog.message}
            onClose={() => setDialog({ open: false })}
          />
        )}
        {dialog.open && dialog.kind === "negative" && (
          <NegativeAlert
            visible
            title={dialog.title}
            message={dialog.message}
            onClose={() => setDialog({ open: false })}
          />
        )}

        <AppTopBar
          title="알림 설정"
          navigation={navigation}
          showBackButton
          backgroundColor="#F5F5F5"
          borderBottomColor="#F5F5F5"
        />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 40,
          }}
        >
          {/* 마스터 알림 설정 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>전체 알림</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>알림 받기</Text>
                  <Text style={styles.settingDescription}>
                    모든 푸시 알림을 켜거나 끕니다
                  </Text>
                </View>
                <Switch
                  value={masterEnabled}
                  onValueChange={(v) =>
                    handleUpdateSetting("allNotificationsEnabled", v)
                  }
                  trackColor={{ false: "#E0E0E0", true: "#4CD964" }}
                  thumbColor="#FFFFFF"
                  disabled={saving}
                />
              </View>
            </View>
          </View>

          {/* 정기 러닝 알림 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>정기 러닝 알림</Text>
            </View>
            <View style={[styles.card, !masterEnabled && styles.cardDisabled]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[
                    styles.settingTitle,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    오전 러닝 리마인더
                  </Text>
                  <Text style={[
                    styles.settingDescription,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    아침에 러닝을 시작하도록 알림을 받습니다
                  </Text>
                </View>
                <Switch
                  value={masterEnabled && morningEnabled}
                  onValueChange={handleMorningToggle}
                  trackColor={{ false: "#E0E0E0", true: "#4CD964" }}
                  thumbColor="#FFFFFF"
                  disabled={!masterEnabled || saving}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[
                    styles.settingTitle,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    저녁 러닝 리마인더
                  </Text>
                  <Text style={[
                    styles.settingDescription,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    저녁에 러닝을 시작하도록 알림을 받습니다
                  </Text>
                </View>
                <Switch
                  value={masterEnabled && eveningEnabled}
                  onValueChange={handleEveningToggle}
                  trackColor={{ false: "#E0E0E0", true: "#4CD964" }}
                  thumbColor="#FFFFFF"
                  disabled={!masterEnabled || saving}
                />
              </View>
            </View>
          </View>

          {/* 엠블럼 알림 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>엠블럼 알림</Text>
            </View>
            <View style={[styles.card, !masterEnabled && styles.cardDisabled]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[
                    styles.settingTitle,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    엠블럼 획득 팝업
                  </Text>
                  <Text style={[
                    styles.settingDescription,
                    !masterEnabled && styles.textDisabled
                  ]}>
                    새 엠블럼 획득 시 축하 팝업을 표시합니다
                  </Text>
                </View>
                <Switch
                  value={masterEnabled && (settings?.emblemNotification ?? true)}
                  onValueChange={(v) =>
                    handleUpdateSetting("emblemNotification", v)
                  }
                  trackColor={{ false: "#E0E0E0", true: "#4CD964" }}
                  thumbColor="#FFFFFF"
                  disabled={!masterEnabled || saving}
                />
              </View>
            </View>
          </View>

          {/* 안내 문구 */}
          <View style={styles.infoSection}>
            <Text style={styles.infoText}>
              알림 설정은 앱 내 푸시 알림에만 적용됩니다.{"\n"}
              기기의 알림 설정에서 앱 알림이 허용되어 있어야 합니다.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.6,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: "#888",
    lineHeight: 18,
  },
  textDisabled: {
    color: "#BBB",
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginLeft: 16,
  },
  infoSection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 13,
    color: "#999",
    lineHeight: 20,
    textAlign: "center",
  },
});
