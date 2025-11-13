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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { formatTimeLocalHHmm } from "../utils/datetime";

console.log("WebSocket 확인:");
console.log("- global.WebSocket:", !!(global as any).WebSocket);
// @ts-ignore
console.log("- WebSocket:", !!WebSocket);

const { width } = Dimensions.get("window");

export default function ChatScreen({ route }: any = { route: { params: {} } }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [crewId, setCrewId] = useState<number | null>(
    route?.params?.crewId ?? null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) return;
      try {
        const me = await getMyProfile();
        if (!alive) return;
        setCurrentUserId(me?.id != null ? String(me.id) : null);
        setCurrentNickname(me?.nickname ? String(me.nickname) : null);
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
    currentUserId,
    onMessage: (newMessage) => {
      addNewMessage(newMessage);
      setTimeout(
        () => scrollViewRef.current?.scrollToEnd({ animated: true }),
        100
      );
    },
  });

  useEffect(() => {
    if (token && currentUserId && !isHistoryLoading && messages.length === 0) {
      loadInitialHistory();
      loadCrewInfo();
      loadUnreadCount();
    }
  }, [token, currentUserId]);

  // Debug: log a few timestamps to verify normalization path
  useEffect(() => {
    if (!__DEV__) return;
    try {
      const sample = messages.slice(-3);
      if (sample.length > 0) {
        console.log('[Chat] time-sample raw/format:', sample.map((m) => ({
          raw: m.timestamp,
          fmt: m.timestamp ? formatTimeLocalHHmm(m.timestamp) : ''
        })));
      }
    } catch {}
  }, [messages.length]);

  useFocusEffect(
    React.useCallback(() => {
      if (isConnected) {
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

  useEffect(() => {
    if (!token) return;
    if (currentUserId == null) return;
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

  const formatTime = (timestamp?: string) => (timestamp ? formatTimeLocalHHmm(timestamp) : "");

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
            {crewInfo ? `${crewInfo.name}` : "크루 채팅"}
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
              <Ionicons name="checkmark-done" size={18} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isConnected && !connectionError && (
        <View style={styles.connectionStatus}>
          <ActivityIndicator size="small" color="#667eea" />
          <Text style={styles.connectionText}>연결 중...</Text>
        </View>
      )}

      {!isConnected && !!connectionError && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{connectionError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              connect();
            }}
          >
            <Ionicons name="refresh" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {isHistoryLoading && (
        <View style={styles.historyLoadingContainer}>
          <ActivityIndicator size="small" color="#667eea" />
          <Text style={styles.historyLoadingText}>메시지 불러오는 중...</Text>
        </View>
      )}

      {historyError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{historyError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() =>
              messages.length === 0 ? loadInitialHistory() : loadMoreMessages()
            }
          >
            <Ionicons name="refresh" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={(insets.bottom || 0) + BOTTOM_NAV_MIN_HEIGHT}
      >
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
                  <ActivityIndicator size="small" color="#667eea" />
                ) : (
                  <>
                    <Ionicons name="chevron-up" size={16} color="#64748b" />
                    <Text style={styles.loadMoreText}>이전 메시지</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {messages.length === 0 ? (
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyChatText}>채팅을 시작해보세요!</Text>
            </View>
          ) : (
            messages.map((msg, index) => {
              const computedOwn = Boolean(
                msg.isOwn === true ||
                (currentUserId != null && (msg as any)?.senderId != null && String((msg as any).senderId) === String(currentUserId)) ||
                (currentNickname && typeof (msg as any)?.senderName === 'string' && (msg as any).senderName === currentNickname)
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
                        <Text style={styles.responseTime}>
                          {formatTime(msg.timestamp)}
                        </Text>
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
                            <View style={styles.unreadIndicator} />
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
            {
              marginBottom: (insets.bottom || 0) + BOTTOM_NAV_MIN_HEIGHT + 8,
              paddingBottom: Platform.OS === "ios" ? 8 : 12,
            },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="메시지를 입력하세요"
              placeholderTextColor="#94a3b8"
              value={message}
              onChangeText={setMessage}
              multiline={false}
              editable={isConnected}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            {message.trim().length > 0 && (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
                activeOpacity={0.7}
              >
                <Ionicons name="send" size={20} color="#ffffff" />
              </TouchableOpacity>
            )}
            {message.trim().length === 0 && (
              <View style={styles.emptyButtonSpace} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <BottomNavigation activeTab={activeTab} onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  chatContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageContainer: {
    marginBottom: 16,
    alignSelf: "flex-start",
    maxWidth: "80%",
  },
  messageLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBackgroundBorder: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 0,
    padding: 14,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    color: "#1e293b",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  messageTime: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "400",
    marginTop: 6,
  },
  responseContainer: {
    alignItems: "flex-end",
    marginBottom: 16,
    alignSelf: "flex-end",
    maxWidth: "80%",
  },
  responseBackground: {
    backgroundColor: "#667eea",
    borderRadius: 18,
    padding: 14,
    maxWidth: "100%",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  responseText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  responseTime: {
    color: "#e0e7ff",
    fontSize: 11,
    fontWeight: "400",
    textAlign: "right",
    marginTop: 6,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 15,
    fontWeight: "400",
    paddingVertical: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#667eea",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  emptyButtonSpace: {
    width: 8,
  },
  connectionStatus: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  connectionText: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "500",
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyChatText: {
    color: "#94a3b8",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 16,
  },
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  systemMessageText: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    textAlign: "center",
  },
  historyLoadingContainer: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyLoadingText: {
    color: "#5b21b6",
    fontSize: 13,
    fontWeight: "500",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  retryButton: {
    backgroundColor: "#ef4444",
    padding: 8,
    borderRadius: 20,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 8,
  },
  loadMoreButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadMoreText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "500",
  },
  chatHeader: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  unreadBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 24,
    alignItems: "center",
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  markAllReadButton: {
    backgroundColor: "#667eea",
    padding: 8,
    borderRadius: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  unreadMessageBorder: {
    borderWidth: 2,
    borderColor: "#667eea",
  },
  unreadIndicator: {
    backgroundColor: "#667eea",
    borderRadius: 4,
    width: 8,
    height: 8,
  },
  statusBarIPhone: {
    backgroundColor: "#ffffff",
  },
  frame: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dynamicIslandSpacer: {
    flex: 1,
  },
  levels: {
    flexDirection: "row",
    gap: 4,
  },
  cellularConnection: {},
  wifi: {},
  battery: {},
});
