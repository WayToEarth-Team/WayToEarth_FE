import { useEffect, useRef, useState, useCallback } from 'react';
import { normalizeTimestampToDate } from '../utils/datetime';
import 'react-native-url-polyfill/auto';

export interface ChatMessage {
  id?: string;
  message: string;
  messageType: 'TEXT' | 'ANNOUNCEMENT' | 'SYSTEM';
  senderName?: string;
  senderId?: string | number;
  timestamp?: string;
  isOwn?: boolean;
  readByUsers?: number;
  isRead?: boolean;
}

interface UseWebSocketProps {
  url: string | null;
  token: string | null;
  currentUserId?: number | null;
  onMessage?: (message: ChatMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export const useWebSocket = ({
  url,
  token,
  currentUserId,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseWebSocketProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;
  const isConnectingRef = useRef(false);
  // 최신 핸들러/상태 참조 저장 (재렌더로 인한 재연결 루프 방지)
  const onMessageRef = useRef<typeof onMessage>(onMessage);
  const onConnectRef = useRef<typeof onConnect>(onConnect);
  const onDisconnectRef = useRef<typeof onDisconnect>(onDisconnect);
  const onErrorRef = useRef<typeof onError>(onError);
  const currentUserIdRef = useRef<number | null | undefined>(currentUserId);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);
  useEffect(() => { onDisconnectRef.current = onDisconnect; }, [onDisconnect]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      try { socketRef.current.close(1000, 'User disconnected'); } catch {}
      socketRef.current = null;
    }
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    setConnectionError(null);
  }, []);

  const connect = useCallback(() => {
    if (isConnectingRef.current || socketRef.current?.readyState === WebSocket.OPEN) return;
    if (!url || !token) {
      setConnectionError('URL 또는 토큰이 없습니다');
      return;
    }
    try {
      isConnectingRef.current = true;
      let socket: WebSocket;
      // URL에 토큰 쿼리 추가(서버 호환성↑)
      const qp = url.includes('?') ? `&token=${encodeURIComponent(token)}` : `?token=${encodeURIComponent(token)}`;
      const urlWithToken = `${url}${qp}`;
      try {
        // 헤더 방식 시도
        // @ts-ignore
        socket = new WebSocket(urlWithToken, [], { headers: { Authorization: `Bearer ${token}` } });
      } catch {
        // 프로토콜 방식 백업
        const protocolToken = token.replace(/\./g, '_');
        socket = new WebSocket(urlWithToken, [`Bearer.${protocolToken}`]);
      }

      socket.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        // keep-alive ping
        if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
        keepAliveRef.current = setInterval(() => {
          try {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: 'PING' }));
            }
          } catch {}
        }, 25000);
        onConnectRef.current?.();
      };

      socket.onmessage = (event) => {
        try {
          const raw = (event as any).data ?? (event as any).message ?? '';
          const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (data?.type === 'PONG' || data === 'PONG') return;
          const tsDate = normalizeTimestampToDate(data.timestamp || data.sentAt || new Date());
          const ts = tsDate.toISOString();
          const message: ChatMessage = {
            id: data.messageId?.toString() || `${data.messageType || 'TEXT'}:${data.senderName || ''}:${ts}`,
            message: data.message,
            messageType: data.messageType || 'TEXT',
            senderName: data.senderName || '알 수 없음',
            senderId: data.senderId,
            timestamp: ts,
            isOwn: currentUserIdRef.current != null ? String(data.senderId) === String(currentUserIdRef.current) : false,
            readByUsers: data.readCount,
            isRead: data.read,
          };
          // 서버가 SYSTEM 타입으로 보내는 클라이언트용 에러 메시지는 노출 억제
          if (
            (message.messageType === 'SYSTEM' || data.type === 'SYSTEM') &&
            typeof message.message === 'string' &&
            (
              /메시지\s*내용이\s*비어있습니다/.test(message.message) ||
              /전송\s*속도.*빠릅니|too\s*fast/i.test(message.message) ||
              /rate.?limit/i.test(message.message)
            )
          ) {
            return;
          }
          onMessageRef.current?.(message);
        } catch (err) {
          onErrorRef.current?.(err);
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        socketRef.current = null;
        isConnectingRef.current = false;
        if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
        onDisconnectRef.current?.();

        const shouldReconnect = event.code !== 1000 && event.code !== 1002 && event.code !== 1008;
        if (shouldReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, timeout);
        } else {
          if (event.code === 1000) setConnectionError('연결이 종료되었습니다');
          else if (event.code === 1002 || event.code === 1008) setConnectionError('인증에 실패했습니다. 다시 로그인해주세요.');
          else if (event.code === 1006) setConnectionError('연결이 예기치 않게 끊어졌습니다.');
          else setConnectionError(`연결이 끊어졌습니다 (코드: ${event.code})`);
        }
      };

      // 연결 타임아웃(열리지 않으면 6초 후 종료)
      const openTimeout = setTimeout(() => {
        if (socketRef.current && socketRef.current.readyState !== WebSocket.OPEN) {
          try { socketRef.current.close(4000, 'Connection timeout'); } catch {}
          setConnectionError('채팅 서버 연결 시간 초과');
          isConnectingRef.current = false;
        }
      }, 6000);

      socket.onerror = (error) => {
        setConnectionError('연결 오류가 발생했습니다');
        isConnectingRef.current = false;
        onErrorRef.current?.(error);
      };

      socketRef.current = socket;
      // onopen/onclose에서 타임아웃 해제
      const clearTO = () => { try { clearTimeout(openTimeout); } catch {} };
      const prevOnOpen = socket.onopen;
      socket.onopen = (...args: any) => { clearTO(); prevOnOpen?.apply(socket, args as any); };
      const prevOnClose = socket.onclose;
      socket.onclose = (event) => { clearTO(); prevOnClose?.(event as any); };
    } catch (error) {
      setConnectionError('연결에 실패했습니다');
      isConnectingRef.current = false;
      onError?.(error);
    }
  }, [url, token]);

  const sendMessage = useCallback((message: string, messageType: 'TEXT' | 'ANNOUNCEMENT' = 'TEXT') => {
    // 빈 메시지는 전송하지 않고 조용히 무시 (에러 노출 방지)
    const trimmed = (message ?? '').trim();
    if (!trimmed) {
      return false;
    }
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('연결이 끊어졌습니다');
      return false;
    }
    try {
      const payload = { message: trimmed, messageType };
      socketRef.current.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      setConnectionError('메시지 전송에 실패했습니다');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!url || !token) return;
    const timer = setTimeout(connect, 500);
    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [url, token]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    sendMessage,
    reconnectAttempts: reconnectAttemptsRef.current,
  } as const;
};
