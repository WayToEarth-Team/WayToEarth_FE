import { client } from "@utils/api/client";

export type CrewChatMessage = {
  messageId: number;
  crewId: number;
  senderId: number;
  senderName: string;
  message: string;
  messageType: "TEXT" | "SYSTEM" | "ANNOUNCEMENT";
  sentAt: string;
  readCount?: number;
  read?: boolean;
};

export async function getRecentCrewMessages(crewId: string, limit = 20) {
  const { data } = await client.get(
    `/v1/crews/${crewId}/chat/messages/recent`,
    { params: { limit } }
  );
  // 서버 래퍼 언래핑은 client interceptor가 수행
  return (data ?? []) as CrewChatMessage[];
}

// 페이지네이션 메시지 조회
export async function getCrewMessages(
  crewId: string,
  page = 0,
  size = 50,
  sort: string = "messageId,desc"
) {
  const { data } = await client.get(`/v1/crews/${crewId}/chat/messages`, {
    params: { page, size, sort },
  });
  return data as any; // Page<CrewChatMessage>
}

// 읽지 않은 메시지 수
export async function getUnreadCount(crewId: string) {
  const { data } = await client.get(`/v1/crews/${crewId}/chat/unread-count`);
  return Number(data ?? 0);
}

// 단일 메시지 읽음 처리
export async function markMessageAsRead(crewId: string, messageId: number) {
  await client.post(`/v1/crews/${crewId}/chat/messages/${messageId}/read`);
}

// 다중 메시지 읽음 처리
export async function markMultipleMessagesAsRead(
  crewId: string,
  messageIds: number[]
) {
  await client.post(`/v1/crews/${crewId}/chat/messages/read/batch`, {
    messageIds,
  });
}

// 특정 메시지 ID 이후 전체 읽음 처리
export async function markAllMessagesAsReadAfter(
  crewId: string,
  afterMessageId: number
) {
  await client.post(
    `/v1/crews/${crewId}/chat/messages/read/all-after/${afterMessageId}`
  );
}

// 메시지 삭제
export async function deleteCrewMessage(crewId: string, messageId: number) {
  await client.delete(`/v1/crews/${crewId}/chat/messages/${messageId}`);
}

// 알림 설정
export type ChatNotificationSettings = {
  pushNotificationEnabled: boolean;
  soundEnabled: boolean;
};

export async function getChatNotificationSettings(crewId: string) {
  const { data } = await client.get(
    `/v1/crews/${crewId}/chat/notification-settings`
  );
  return data as ChatNotificationSettings;
}

export async function updateChatNotificationSettings(
  crewId: string,
  settings: ChatNotificationSettings
) {
  await client.put(`/v1/crews/${crewId}/chat/notification-settings`, settings);
}
