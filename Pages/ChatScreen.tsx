import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { ensureAccessToken, getAccessToken } from "../utils/auth/tokenManager";
import BottomNavigation, {
  BOTTOM_NAV_MIN_HEIGHT,
} from "../components/Layout/BottomNav";
import { useBottomNav } from "../hooks/useBottomNav";
import { useWebSocket } from "../hooks/useWebSocket";
import { useChatHistory } from "../hooks/useChatHistory";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { getMyProfile } from "../utils/api/users";

// WebSocket polyfill 확인
console.log("WebSocket 확인:");
console.log("- global.WebSocket:", !!(global as any).WebSocket);
// @ts-ignore
console.log("- WebSocket:", !!WebSocket);

const { width } = Dimensions.get("window");

export default function ChatScreen({ route }: any) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [crewId, setCrewId] = useState<number | null>(
    route?.params?.crewId ?? null
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const { activeTab, onTabPress } = useBottomNav("crew");
  const [token, setToken] = useState<string | null>(null);

  const {
    messages,
    isLoading: isHistoryLoading,
    hasMore,
    error: historyError,
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
  } = useChatHistory({
    crewId: crewId ?? 0,
    currentUserId: currentUserId ?? undefined,
  });

  const websocketUrl = crewId
    ? `wss://api.waytoearth.cloud/ws/crew/${crewId}/chat`
    : null;

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const inMem = getAccessToken();
        if (inMem) {
          if (!isMounted) return;
          setToken(inMem);
          return;
        }
        const ensured = await ensureAccessToken();
        if (!isMounted) return;
        if (ensured) setToken(ensured);
      } catch {}
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Identify current user so own messages can align right/blue
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) return;
      try {
        const me = await getMyProfile();
        if (!alive) return;
        setCurrentUserId(Number(me?.id));
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const {
    isConnected,
    connectionError,
    sendMessage: sendWsMessage,
    disconnect,
    connect,
  } = useWebSocket({
    url: token && websocketUrl ? websocketUrl : null,
    token,
    onMessage: (newMessage) => {
      addNewMessage(newMessage);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100
      );
    },
  });

  useEffect(() => {
    if (token && !isHistoryLoading && messages.length === 0) {
      loadInitialHistory();
      loadCrewInfo();
      loadUnreadCount();
    }
  }, [token]);

  // 화면을 보고 있으면 자동으로 읽음 처리(미리보기 클릭 없이)
  useFocusEffect(
    React.useCallback(() => {
      if (isConnected) {
        // 약간 딜레이 후 전체 읽음 처리(도착 직후 렌더 반영 시간)
        const t = setTimeout(() => {
          try {
            markAllMessagesAsRead();
          } catch {}
        }, 150);
        return () => clearTimeout(t);
      }
      return () => {};
    }, [isConnected, messages.length])
  );

  // After we know who the current user is, reload once to
  // ensure history marks my messages as `isOwn` for right-side UI.
  useEffect(() => {
    if (!token) return;
    if (currentUserId == null) return;
    // Only reload if we already loaded without ownership info
    if (messages.length > 0 && !messages.some((m) => m.isOwn === true)) {
      clearMessages();
      loadInitialHistory();
    }
  }, [currentUserId]);

  useEffect(() => {
    return () => {
      disconnect();
      clearMessages();
    };
  }, [disconnect, clearMessages]);

  const handleSend = () => {
    const messageText = message.trim();
    if (!messageText) return;
    if (!isConnected) return;
    const ok = sendWsMessage(messageText, "TEXT");
    if (ok) setMessage("");
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View
        style={[
          styles.statusBarIPhone,
          {
            paddingTop: Math.max(insets.top, 21),
            height: Math.max(insets.top, 21) + 30,
          },
        ]}
      >
        <View style={styles.frame}>
          <View style={styles.dynamicIslandSpacer} />
          <View style={styles.levels}>
            <View style={styles.cellularConnection} />
            <View style={styles.wifi} />
            <View style={styles.battery} />
          </View>
        </View>
      </View>

      <View style={styles.chatHeader}>
        <View style={styles.chatHeaderLeft}>
          <Text style={styles.chatTitle}>
            {crewInfo ? `${crewInfo.name} 채팅` : "크루 채팅"}
          </Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.chatHeaderRight}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllReadButton}
              onPress={markAllMessagesAsRead}
            >
              <Text style={styles.markAllReadText}>모두 읽음</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isConnected && !connectionError && (
        <View style={styles.connectionStatus}>
          <ActivityIndicator size="small" color="#3579d7" />
          <Text style={styles.connectionText}>채팅 서버에 연결 중...</Text>
        </View>
      )}

      {!isConnected && !!connectionError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{connectionError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              connect();
            }}
          >
            <Text style={styles.retryButtonText}>다시 연결</Text>
          </TouchableOpacity>
        </View>
      )}

      {isHistoryLoading && (
        <View style={styles.historyLoadingContainer}>
          <ActivityIndicator size="small" color="#3579d7" />
          <Text style={styles.historyLoadingText}>메시지 불러오는 중...</Text>
        </View>
      )}

      {historyError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{historyError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              messages.length === 0 ? loadInitialHistory() : loadMoreMessages()
            }
          >
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.chatContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const { contentOffset } = e.nativeEvent;
            if (
              contentOffset.y <= 50 &&
              hasMore &&
              !isHistoryLoading &&
              messages.length > 0
            ) {
              loadMoreMessages();
            }
          }}
          scrollEventThrottle={400}
        >
          {hasMore && messages.length > 0 && (
            <View style={styles.loadMoreContainer}>
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={loadMoreMessages}
                disabled={isHistoryLoading}
              >
                {isHistoryLoading ? (
                  <ActivityIndicator size="small" color="#3579d7" />
                ) : (
                  <Text style={styles.loadMoreText}>이전 메시지 더보기</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>채팅을 시작해보세요!</Text>
            </View>
          ) : (
            messages.map((msg, index) => {
              const computedOwn = Boolean(
                msg.isOwn ||
                  (currentUserId != null &&
                    (msg as any)?.senderId != null &&
                    String((msg as any).senderId) === String(currentUserId))
              );
              const onLong = () => {
                if (computedOwn && msg.id)
                  Alert.alert("메시지 삭제", "이 메시지를 삭제하시겠습니까?", [
                    { text: "취소", style: "cancel" },
                    {
                      text: "삭제",
                      style: "destructive",
                      onPress: () => deleteMessage(parseInt(msg.id!)),
                    },
                  ]);
              };
              // 미리보기 클릭으로 읽음 처리하지 않음(화면 포커스 시 자동 처리)
              const onPress = undefined as any;
              return (
                <View key={msg.id || index}>
                  {msg.messageType === "SYSTEM" ? (
                    <View style={styles.systemMessageContainer}>
                      <Text style={styles.systemMessageText}>
                        {msg.message}
                      </Text>
                    </View>
                  ) : computedOwn ? (
                    <TouchableOpacity
                      style={styles.responseContainer}
                      onLongPress={onLong}
                      delayLongPress={500}
                    >
                      <View style={styles.responseBackground}>
                        <Text style={styles.responseText}>{msg.message}</Text>
                        <View style={styles.messageFooter}>
                          <Text style={styles.responseTime}>
                            {formatTime(msg.timestamp)}
                          </Text>
                          {/* 읽음 표시 제거 */}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.messageContainer}>
                      <Text style={styles.messageLabel}>{msg.senderName}</Text>
                      <View
                        style={[
                          styles.messageBackgroundBorder,
                          !msg.isRead && styles.unreadMessageBorder,
                        ]}
                      >
                        <Text style={styles.messageText}>{msg.message}</Text>
                        <View style={styles.messageFooter}>
                          <Text style={styles.messageTime}>
                            {formatTime(msg.timestamp)}
                          </Text>
                          {!msg.isRead && (
                            <View style={styles.unreadIndicator}>
                              <Text style={styles.unreadIndicatorText}>N</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          style={[
            styles.inputContainer,
            { marginBottom: (insets.bottom || 0) + BOTTOM_NAV_MIN_HEIGHT + 8 },
          ]}
        >
          <View style={styles.textarea}>
            <TextInput
              style={styles.textInput}
              placeholder={
                isConnected ? "메시지를 입력하세요..." : "연결 중..."
              }
              placeholderTextColor="#757575"
              value={message}
              onChangeText={setMessage}
              multiline={false}
              editable={isConnected}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.sendIcon}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  chatContainer: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  messageContainer: {
    marginBottom: 16,
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  messageLabel: {
    color: "#718096",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginLeft: 16,
  },
  messageBackgroundBorder: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    maxWidth: "100%",
  },
  messageText: {
    color: "#2d3748",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 20,
  },
  messageTime: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "400",
    marginTop: 8,
  },
  responseContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  responseBackground: {
    backgroundColor: "#3579d7",
    borderRadius: 16,
    padding: 12,
    maxWidth: "100%",
    alignItems: "flex-end",
  },
  responseText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "right",
    lineHeight: 20,
  },
  responseTime: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "400",
    textAlign: "right",
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingBottom: 12,
  },
  textarea: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flex: 1,
    height: 60,
    justifyContent: "center",
  },
  textInput: {
    color: "#757575",
    fontSize: 14,
    fontWeight: "400",
    paddingHorizontal: 16,
    paddingVertical: 18,
    height: "100%",
  },
  sendButton: {
    backgroundColor: "#3579d7",
    borderRadius: 22,
    width: 56,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { fontSize: 24, color: "#ffffff", fontWeight: "600" },
  connectionStatus: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  connectionText: { color: "#f57c00", fontSize: 14, fontWeight: "500" },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyChatText: { color: "#9ca3af", fontSize: 16, fontWeight: "500" },
  systemMessageContainer: { alignItems: "center", marginVertical: 8 },
  systemMessageText: {
    backgroundColor: "#e3f2fd",
    color: "#1976d2",
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    textAlign: "center",
  },
  historyLoadingContainer: {
    backgroundColor: "#f0f8ff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  historyLoadingText: { color: "#3579d7", fontSize: 14, fontWeight: "500" },
  errorContainer: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: { color: "#dc2626", fontSize: 14, fontWeight: "500", flex: 1 },
  retryButton: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  loadMoreContainer: { alignItems: "center", paddingVertical: 12 },
  loadMoreButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  loadMoreText: { color: "#6b7280", fontSize: 13, fontWeight: "500" },
  chatHeader: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chatHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatHeaderRight: { flexDirection: "row", alignItems: "center" },
  chatTitle: { fontSize: 18, fontWeight: "600", color: "#1f2937" },
  unreadBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  unreadBadgeText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  markAllReadButton: {
    backgroundColor: "#3579d7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markAllReadText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  // readCountText: 제거됨 (읽음 표시 비활성화)
  unreadMessageBorder: { borderColor: "#3579d7", borderWidth: 2 },
  unreadIndicator: {
    backgroundColor: "#ef4444",
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadIndicatorText: { color: "#ffffff", fontSize: 10, fontWeight: "600" },
});
