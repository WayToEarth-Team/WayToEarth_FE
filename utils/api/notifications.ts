// utils/api/notifications.ts
import { client } from "@utils/api/client";

// unwrap helper
function unwrap<T = any>(resData: any): T {
  return (resData && resData.data != null ? resData.data : resData) as T;
}

// 알림 설정 타입
export type NotificationSettings = {
  scheduledRunningReminder: boolean;  // 정기 러닝 알림
  crewNotification: boolean;          // 크루 알림
  feedNotification: boolean;          // 피드 알림
  emblemNotification: boolean;        // 엠블럼 알림
  allNotificationsEnabled: boolean;   // 전체 알림
};

// 알림 설정 조회
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await client.get("/v1/notifications/settings");
  const settings = unwrap<NotificationSettings>(res.data);
  if (__DEV__) console.log('[NOTIFICATIONS] Settings:', JSON.stringify(settings, null, 2));
  return settings;
}

// 알림 설정 업데이트
export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  console.log('[NOTIFICATIONS] Updating settings...', settings);
  const res = await client.patch("/v1/notifications/settings", settings);
  const updated = unwrap<NotificationSettings>(res.data);
  console.log('[NOTIFICATIONS] Settings updated:', JSON.stringify(updated, null, 2));
  return updated;
}
