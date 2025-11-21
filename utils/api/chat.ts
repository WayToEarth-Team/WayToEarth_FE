import { client } from '@utils/api/client';

// 백엔드 API 응답 타입 (실제 API 스펙에 맞춤)
export interface ChatMessage {
  messageId: number;
  message: string;
  messageType: 'TEXT' | 'ANNOUNCEMENT' | 'SYSTEM';
  senderName: string;
  senderId: number;
  sentAt: string; // 백엔드에서 sentAt으로 제공
  readByUsers?: number; // 읽은 사용자 수
  isRead?: boolean; // 현재 사용자가 읽었는지 여부
}

export interface ChatHistoryParams {
  crewId: number;
  page?: number;
  size?: number;
}

export interface RecentMessagesParams {
  crewId: number;
  limit?: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationSettings {
  pushNotificationEnabled: boolean;
  soundEnabled: boolean;
}

export interface CrewMember {
  memberId: number;
  userId: number;
  nickname: string;
  profileImageUrl?: string;
  role: 'LEADER' | 'MEMBER';
  joinedAt: string;
}

export interface CrewInfo {
  crewId: number;
  name: string;
  description: string;
  memberCount: number;
  members: CrewMember[];
}

export const chatAPI = {
  // 채팅 메시지 목록 조회 (페이지네이션)
  getMessages: async (params: ChatHistoryParams): Promise<ChatMessage[]> => {
    const { crewId, page = 0, size = 50 } = params;

    const queryParams = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
      sort: 'sentAt' // 전송시간 기준 정렬
    });

    const response = await client.get(`/v1/crews/${crewId}/chat/messages?${queryParams}`);
    return response.data;
  },

  // 최신 메시지들 조회
  getRecentMessages: async (params: RecentMessagesParams): Promise<ChatMessage[]> => {
    const { crewId, limit = 20 } = params;

    const response = await client.get(`/v1/crews/${crewId}/chat/messages/recent?limit=${limit}`);
    return response.data;
  },

  // 읽지 않은 메시지 수 조회
  getUnreadCount: async (crewId: number): Promise<UnreadCountResponse> => {
    const response = await client.get(`/v1/crews/${crewId}/chat/unread-count`);
    return response.data;
  },

  // 단일 메시지 읽음 처리
  markMessageAsRead: async (crewId: number, messageId: number): Promise<void> => {
    await client.post(`/v1/crews/${crewId}/chat/messages/${messageId}/read`);
  },

  // 다중 메시지 읽음 처리
  markMultipleMessagesAsRead: async (crewId: number, messageIds: number[]): Promise<void> => {
    await client.post(`/v1/crews/${crewId}/chat/messages/read/batch`, {
      messageIds
    });
  },

  // 특정 시점 이후 모든 메시지 읽음 처리
  markAllMessagesAsReadAfter: async (crewId: number, afterMessageId: number): Promise<void> => {
    await client.post(`/v1/crews/${crewId}/chat/messages/read/all-after/${afterMessageId}`);
  },

  // 메시지 삭제 (작성자/크루장만)
  deleteMessage: async (crewId: number, messageId: number): Promise<void> => {
    await client.delete(`/v1/crews/${crewId}/chat/messages/${messageId}`);
  },

  // 알림 설정 조회
  getNotificationSettings: async (crewId: number): Promise<NotificationSettings> => {
    const response = await client.get(`/v1/crews/${crewId}/chat/notification-settings`);
    return response.data;
  },

  // 알림 설정 업데이트
  updateNotificationSettings: async (crewId: number, settings: NotificationSettings): Promise<void> => {
    await client.put(`/v1/crews/${crewId}/chat/notification-settings`, settings);
  },

  // 크루 정보 조회 (멤버 수 포함)
  getCrewInfo: async (crewId: number): Promise<CrewInfo> => {
    const response = await client.get(`/v1/crews/${crewId}`);
    return response.data;
  },

  // 크루 멤버 목록 조회
  getCrewMembers: async (crewId: number): Promise<CrewMember[]> => {
    const response = await client.get(`/v1/crews/${crewId}/members`);
    return response.data;
  },
};