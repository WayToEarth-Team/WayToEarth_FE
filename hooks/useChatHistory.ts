import { useCallback, useRef, useState } from 'react';
import { client } from '../utils/api/client';
import { normalizeTimestampToDate } from '../utils/datetime';

export type ChatMessage = {
  id?: string;
  message: string;
  messageType: 'TEXT' | 'ANNOUNCEMENT' | 'SYSTEM';
  senderName?: string;
  senderId?: string | number;
  timestamp?: string;
  isOwn?: boolean;
  readByUsers?: number;
  isRead?: boolean;
};

type Page<T> = { content: T[]; number: number; size: number; totalPages?: number; totalElements?: number };

export function useChatHistory({ crewId, currentUserId }: { crewId: string | number; currentUserId?: string | number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [crewInfo, setCrewInfo] = useState<{ name: string; memberCount: number } | null>(null);
  const pageSizeRef = useRef(20);
  const idSetRef = useRef<Set<string>>(new Set());

  const mapDto = useCallback((d: any): ChatMessage => {
    const tsDate = normalizeTimestampToDate(d.sentAt || d.timestamp || new Date());
    const ts = tsDate.toISOString();
    const type = (d.messageType as any) || 'TEXT';
    const sender = d.senderName || '';
    const fallbackKey = `${type}:${sender}:${ts}`;
    return {
      id: String(d.messageId ?? d.id ?? fallbackKey),
      message: String(d.message ?? ''),
      messageType: type,
      senderName: sender,
      senderId: d.senderId,
      timestamp: ts,
      isOwn: currentUserId != null ? String(d.senderId ?? '') === String(currentUserId) : false,
      readByUsers: typeof d.readCount === 'number' ? d.readCount : undefined,
      isRead: Boolean(d.read),
    };
  }, [currentUserId]);

  const loadInitialHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/v1/crews/${crewId}/chat/messages/recent`, { params: { limit: pageSizeRef.current } });
      const list: any[] = data ?? [];
      const mapped = list
        .map(mapDto)
        // Hide server-side system notices that are not user messages
        .filter((m) => {
          if (m.messageType === 'SYSTEM') {
            const msg = m.message || '';
            if (/메시지\s*내용이\s*비어있습니다/.test(msg)) return false;
            if (/전송\s*속도.*빠릅니|too\s*fast|rate.?limit/i.test(msg)) return false;
          }
          return true;
        })
        .filter((m) => {
          const key = m.id ?? '';
          if (!key) return true;
          if (idSetRef.current.has(key)) return false;
          idSetRef.current.add(key);
          return true;
        });
      setMessages(mapped);
      setPage(1);
      setHasMore((list?.length ?? 0) >= pageSizeRef.current);
      await Promise.all([loadUnreadCount(), loadCrewInfo()]);
    } catch (e: any) {
      setError(e?.message || '메시지를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [crewId, mapDto]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await client.get(`/v1/crews/${crewId}/chat/messages`, {
        params: { page, size: pageSizeRef.current, sort: 'messageId,desc' },
      });
      const pageData = (data ?? {}) as Page<any>;
      const list: any[] = (pageData.content as any[]) || [];
      if (list.length === 0) {
        setHasMore(false);
      } else {
        const mapped = list
          .map(mapDto)
          .filter((m) => {
            if (m.messageType === 'SYSTEM') {
              const msg = m.message || '';
              if (/메시지\s*내용이\s*비어있습니다/.test(msg)) return false;
              if (/전송\s*속도.*빠릅니|too\s*fast|rate.?limit/i.test(msg)) return false;
            }
            return true;
          })
          .filter((m) => {
          const key = m.id ?? '';
          if (!key) return true;
          if (idSetRef.current.has(key)) return false;
          idSetRef.current.add(key);
          return true;
        });
        setMessages((prev) => [...mapped.reverse(), ...prev]);
        setPage((p) => p + 1);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status && status >= 500) {
        setHasMore(false);
      } else {
        setError(e?.message || '이전 메시지를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [crewId, page, isLoading, hasMore, mapDto]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data } = await client.get(`/v1/crews/${crewId}/chat/unread-count`);
      setUnreadCount(Number(data ?? 0));
    } catch {}
  }, [crewId]);

  const loadCrewInfo = useCallback(async () => {
    try {
      const [detailRes, countRes] = await Promise.all([
        client.get(`/v1/crews/${crewId}`),
        client.get(`/v1/crews/${crewId}/members/count`).catch(() => ({ data: 0 })),
      ]);
      setCrewInfo({ name: String((detailRes.data as any)?.name ?? '크루'), memberCount: Number(countRes.data ?? 0) });
    } catch {}
  }, [crewId]);

  const markMessageAsRead = useCallback(async (messageId: number) => {
    try {
      await client.post(`/v1/crews/${crewId}/chat/messages/${messageId}/read`);
      setMessages((prev) => prev.map((m) => (m.id === String(messageId) ? { ...m, isRead: true } : m)));
      await loadUnreadCount();
    } catch {}
  }, [crewId, loadUnreadCount]);

  const markAllMessagesAsRead = useCallback(async () => {
    try {
      await client.post(`/v1/crews/${crewId}/chat/messages/read/all-after/${0}`);
      setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      await loadUnreadCount();
    } catch {}
  }, [crewId, loadUnreadCount]);

  const deleteMessage = useCallback(async (messageId: number) => {
    try {
      await client.delete(`/v1/crews/${crewId}/chat/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== String(messageId)));
    } catch (e) {
      setError('메시지 삭제에 실패했습니다');
    }
  }, [crewId]);

  const addNewMessage = useCallback((m: any) => {
    const mapped = mapDto(m);
    const key = mapped.id ?? '';
    setMessages((prev) => {
      if (key && idSetRef.current.has(key)) return prev;
      if (key) idSetRef.current.add(key);
      return [...prev, mapped];
    });
  }, [mapDto]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    isLoading,
    hasMore,
    error,
    unreadCount,
    crewInfo,
    loadInitialHistory,
    loadMoreMessages,
    loadUnreadCount,
    loadCrewInfo,
    markMessageAsRead,
    markAllMessagesAsRead,
    deleteMessage,
    addNewMessage,
    clearMessages,
  };
}
