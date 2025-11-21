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
  Platform,
  Keyboard,
  Animated,
  Easing,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ensureAccessToken, getAccessToken } from "@utils/auth/tokenManager";
import BottomNavigation, { BOTTOM_NAV_MIN_HEIGHT } from "@app/layout/BottomNav";
import { useBottomNav } from "@hooks/useBottomNav";
import { useWebSocket } from "@hooks/useWebSocket";
import { useChatHistory } from "@hooks/useChatHistory";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { getMyProfile } from "@utils/api/users";
import { formatTimeLocalHHmm } from "@utils/datetime";
import { getCrewMembers as getCrewMembersPaged, getCrewMember as getCrewMemberById } from "@utils/api/crews";
import { getApiBaseUrl, toWebSocketBaseUrl } from "@utils/config/api";

console.log("WebSocket 확인:");
console.log("- global.WebSocket:", !!(global as any).WebSocket);
// @ts-ignore
console.log("- WebSocket:", !!WebSocket);

const { width } = Dimensions.get("window");

export default function ChatScreen({ route }: any = { route: { params: {} } }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [crewId, setCrewId] = useState<number | null>(
    route?.params?.crewId ?? null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentNickname, setCurrentNickname] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const atBottomRef = useRef(true);
  const { activeTab, onTabPress } = useBottomNav("crew");
  const [token, setToken] = useState<string | null>(null);
  const [kbVisible, setKbVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(72);
  const inputBottomAnim = useRef(new Animated.Value(0)).current;
  const spacerHeightAnim = useRef(new Animated.Value(0)).current;
  const ESTIMATED_ANDROID_KB = 280; // dp, 즉시 반응용 임시 높이
  const prevTargetsRef = useRef({ bottom: 0, spacer: 0 });
  const justFocusedRef = useRef(false);
  const predictedRef = useRef<{ active: boolean; at: number }>({ active: false, at: 0 });
  const USE_SYSTEM_PAN = false; // 양 플랫폼 모두 커스텀 애니메이션 사용
  const [avatarByNickname, setAvatarByNickname] = useState<Record<string, string | null>>({});
  const avatarFetchSetRef = useRef<Set<string>>(new Set());

  const normalizeName = (s: string) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, "");

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
    ? `${toWebSocketBaseUrl(getApiBaseUrl())}/ws/crew/${crewId}/chat`
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

  // 키보드 표시/숨김 상태 추적 → 입력창 하단 여백 동적 조정
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.select({ ios: "keyboardWillShow", android: "keyboardDidShow" }) || "keyboardDidShow",
      (e: any) => {
        setKbVisible(true);
        const h = Number(e?.endCoordinates?.height || e?.end?.height || 0);
        if (Number.isFinite(h)) setKeyboardHeight(h);
      }
    );
    const hide = Keyboard.addListener(
      Platform.select({ ios: "keyboardWillHide", android: "keyboardDidHide" }) || "keyboardDidHide",
      () => {
        setKbVisible(false);
        setKeyboardHeight(0);
      }
    );
    return () => {
      try { show.remove(); hide.remove(); } catch {}
    };
  }, []);

  // 키보드가 표시될 때 하단에 있으면 메시지를 부드럽게 하단으로 정렬
  useEffect(() => {
    if (kbVisible && atBottomRef.current) {
      const t = setTimeout(() => {
        try { scrollViewRef.current?.scrollToEnd({ animated: true }); } catch {}
      }, 50);
      return () => clearTimeout(t);
    }
  }, [kbVisible, keyboardHeight]);

  // 키보드 이벤트에는 스크롤 자동 이동을 걸지 않고, 포커스/신규 메시지에서만 처리

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) return;
      try {
        const me = await getMyProfile();
        if (!alive) return;
        setCurrentUserId(me?.id != null ? String(me.id) : null);
        setCurrentNickname(me?.nickname ? String(me.nickname) : null);
        const av = (me as any)?.profile_image_url || (me as any)?.profileImageUrl || null;
        setMyAvatarUrl(av ? String(av).split('?')[0] : null);
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

  // 크루 멤버 아바타 로드 (닉네임 기반 매핑)
  useEffect(() => {
    (async () => {
      try {
        if (!crewId) return;
        const { members } = await getCrewMembersPaged(String(crewId), 0, 200);
        const byName: Record<string, string | null> = {};
        for (const m of members) {
          const url = m.profileImage ? String(m.profileImage) : null;
          const nameRaw = m.nickname ? String(m.nickname) : "";
          const keyLower = nameRaw.trim().toLowerCase();
          const keyNorm = normalizeName(nameRaw);
          if (nameRaw) {
            byName[nameRaw] = url;
            byName[keyLower] = url;
            byName[keyNorm] = url;
          }
        }
        setAvatarByNickname(byName);
        if (__DEV__) {
          try {
            const sampleKeys = Object.keys(byName).slice(0, 5);
            console.log('[CHAT][avatarLoad] crewId=', crewId, 'loaded members=', members.length, 'sampleKeys=', sampleKeys);
          } catch {}
        }
      } catch {}
    })();
  }, [crewId]);

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
      try {
        // Prefer full reset to avoid stale dedupe state on next mount
        (resetAll as any)?.();
      } catch {
        clearMessages();
      }
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

  // Helpers for grouping and ownership
  const computeOwn = (m: any) => {
    return Boolean(
      m?.isOwn === true ||
        (currentUserId != null && m?.senderId != null && String(m.senderId) === String(currentUserId)) ||
        (currentNickname && typeof m?.senderName === 'string' && m.senderName === currentNickname)
    );
  };
  const isSameMinute = (a?: string, b?: string) => {
    if (!a || !b) return false;
    try {
      const da = new Date(a);
      const db = new Date(b);
      return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate() && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
    } catch { return false; }
  };

  // 탭바/안전영역 기반 하단 오프셋 계산
  // 입력창 절대 배치 및 스크롤 패딩 계산
  const bottomNavHeight = BOTTOM_NAV_MIN_HEIGHT + (insets.bottom || 0);
  const LIFT_WHEN_CLOSED = 12; // 기본 상태에서 더 위로 띄우기
  const LIFT_WHEN_OPEN = 8; // 키보드와 살짝 간격을 둬 충돌 느낌 방지

  // 입력칸/여백을 부드럽게 애니메이션 (양 플랫폼 동일 커브/타이밍 적용)
  useEffect(() => {
    const targetBottom = keyboardHeight > 0
      ? keyboardHeight + LIFT_WHEN_OPEN
      : bottomNavHeight + LIFT_WHEN_CLOSED;
    // 🔧 수정: 스페이서는 입력창 bottom 위치 + 입력창 높이 + 여백
    const targetSpacer = targetBottom + inputHeight + 16;
    const duration = 280; // 부드럽고 꾸덕한 타이밍
    const ease = Easing.out(Easing.cubic);
    const prev = prevTargetsRef.current;
    const deltaB = Math.abs(targetBottom - prev.bottom);
    const deltaS = Math.abs(targetSpacer - prev.spacer);
    const now = Date.now();
    const predictedRecently = predictedRef.current.active && now - predictedRef.current.at < 800;
    // 항상 기존 애니메이션 중단
    try { inputBottomAnim.stopAnimation(); spacerHeightAnim.stopAnimation(); } catch {}
    if (predictedRecently) {
      // 예측 → 실측 보정: 차이가 크면 짧게 부드럽게 수렴, 작으면 즉시 고정
      const settleDur = 120;
      if (deltaB > 8) {
        Animated.timing(inputBottomAnim, { toValue: targetBottom, duration: settleDur, easing: ease, useNativeDriver: false }).start();
      } else {
        inputBottomAnim.setValue(targetBottom);
      }
      if (deltaS > 8) {
        Animated.timing(spacerHeightAnim, { toValue: targetSpacer, duration: settleDur, easing: ease, useNativeDriver: false }).start();
      } else {
        spacerHeightAnim.setValue(targetSpacer);
      }
      predictedRef.current.active = false;
    } else {
      if (deltaB < 10) {
        inputBottomAnim.setValue(targetBottom);
      } else {
        Animated.timing(inputBottomAnim, { toValue: targetBottom, duration, easing: ease, useNativeDriver: false }).start();
      }
      if (deltaS < 10) {
        spacerHeightAnim.setValue(targetSpacer);
      } else {
        Animated.timing(spacerHeightAnim, { toValue: targetSpacer, duration, easing: ease, useNativeDriver: false }).start();
      }
    }
    prevTargetsRef.current = { bottom: targetBottom, spacer: targetSpacer };
  }, [keyboardHeight, inputHeight, bottomNavHeight]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View
        style={[
          styles.statusBarIPhone,
          {
            paddingTop: Math.max(insets.top, 21),
            height: Math.max(insets.top, 21) + 18,
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
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color="#1e293b" />
          </TouchableOpacity>
        </View>
        <View style={styles.chatHeaderCenter} pointerEvents="none">
          <Text style={styles.chatTitle} numberOfLines={1}>
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

      <View style={styles.chatContainer}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.select({ ios: "interactive", android: "on-drag" })}
          onScroll={(e) => {
            const { contentOffset } = e.nativeEvent;
            try {
              const { layoutMeasurement, contentSize } = e.nativeEvent;
              const paddingToBottom = 72; // 여유값
              const isAtBottom = contentSize.height - layoutMeasurement.height - contentOffset.y <= paddingToBottom;
              atBottomRef.current = isAtBottom;
            } catch {}
            if (
              contentOffset.y <= 50 &&
              hasMore &&
              !isHistoryLoading &&
              messages.length > 0
            ) {
              loadMoreMessages();
            }
          }}
          scrollEventThrottle={16}
          // onContentSizeChange는 키보드 미표시 + 하단 유지일 때만 보정
          onContentSizeChange={() => {
            if (kbVisible || !atBottomRef.current) return;
            try { scrollViewRef.current?.scrollToEnd({ animated: true }); } catch {}
          }}
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
              const next = messages[index + 1];
              const nextOwn = next ? computeOwn(next as any) : false;
              const sameSender = next ? ((computedOwn && nextOwn) || (!computedOwn && !nextOwn && (next as any)?.senderName === (msg as any)?.senderName)) : false;
              const showTime = !next || !(sameSender && isSameMinute(msg.timestamp, next.timestamp));
              const prev = messages[index - 1];
              const prevOwn = prev ? computeOwn(prev as any) : false;
              const prevSameSender = prev ? ((computedOwn && prevOwn) || (!computedOwn && !prevOwn && (prev as any)?.senderName === (msg as any)?.senderName)) : false;
              const showHeader = !prev || !(prevSameSender && isSameMinute(prev?.timestamp, msg.timestamp));
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
                    <View style={{ alignItems: 'flex-end', marginBottom: 12 }}>
                      <View style={styles.rowRight}>
                        {showTime ? (
                          <Text style={[styles.timeInline, { marginRight: 4 }]}>{formatTime(msg.timestamp)}</Text>
                        ) : null}
                        <View style={styles.responseBackground}>
                          <Text style={styles.responseText}>{msg.message}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.otherMessageContainer}>
                      {showHeader && (
                        <View style={styles.rowAvatarNick}>
                          {(() => {
                          const nameRaw = String(((msg as any)?.senderName || ""));
                          const keyLower = nameRaw.trim().toLowerCase();
                          const keyNorm = normalizeName(nameRaw);
                          let raw =
                            avatarByNickname[nameRaw] ??
                            avatarByNickname[keyLower] ??
                            avatarByNickname[keyNorm] ??
                            null;
                          // 지연 로드: 닉네임 기반으로 첫 페이지에서 검색
                          const fetchKey = keyNorm || keyLower || nameRaw;
                          if (!raw && crewId && fetchKey && !avatarFetchSetRef.current.has(fetchKey)) {
                            avatarFetchSetRef.current.add(fetchKey);
                            if (__DEV__) console.log('[CHAT][avatarFetch] start for', { crewId, fetchKey, nameRaw });
                            getCrewMembersPaged(String(crewId), 0, 200)
                              .then(({ members }) => {
                                const found = members.find((m) => normalizeName(m.nickname) === fetchKey);
                                const profile = found?.profileImage ?? null;
                                if (found?.nickname) {
                                  setAvatarByNickname((prev) => ({
                                    ...prev,
                                    [found.nickname]: profile,
                                    [found.nickname.trim().toLowerCase()]: profile,
                                    [normalizeName(found.nickname)]: profile,
                                  }));
                                  if (__DEV__) console.log('[CHAT][avatarFetch] found', { nickname: found.nickname, profile });
                                } else {
                                  if (__DEV__) console.log('[CHAT][avatarFetch] not found for', fetchKey);
                                }
                              })
                              .catch(() => {})
                              .finally(() => {});
                          }
                          const url = raw ? String(raw) : null;
                          if (__DEV__) {
                            try {
                              console.log('[CHAT][avatarResolve]', { nameRaw, keyLower, keyNorm, hit: !!url, url });
                            } catch {}
                          }
                          return url ? (
                            <Image
                              source={{ uri: url, cache: 'force-cache' as any }}
                              style={styles.avatar}
                              resizeMode="cover"
                              onError={(e) => { if (__DEV__) console.log('[CHAT][avatarError]', nameRaw, e?.nativeEvent?.error); }}
                              onLoad={() => { if (__DEV__) console.log('[CHAT][avatarLoadOK]', nameRaw); }}
                            />
                          ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]} />
                          );
                        })()}
                          <Text style={styles.nicknameText}>{msg.senderName}</Text>
                        </View>
                      )}
                      <View style={[styles.rowLeft, { marginLeft: 44, maxWidth: '78%' }]}>
                        <View
                          style={[
                            styles.messageBackgroundBorder,
                            !msg.isRead && styles.unreadMessageBorder,
                          ]}
                        >
                          <Text style={styles.messageText}>{msg.message}</Text>
                        </View>
                        {showTime ? (
                          <Text style={styles.timeInline}>{formatTime(msg.timestamp)}</Text>
                        ) : null}
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
          {/* 하단 공간 확보: Android는 시스템 pan에 위임하여 스페이서 제거 */}
          <Animated.View style={{ height: spacerHeightAnim }} />
        </ScrollView>

        <Animated.View
          style={[
            styles.inputContainer,
            {
              // 절대 배치 + 애니메이션 bottom (양 플랫폼 동일)
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (inputBottomAnim as any),
              zIndex: 200,
              elevation: 8,
              paddingBottom: Platform.OS === "ios" ? 8 : 12,
            },
          ]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h && Math.abs(h - inputHeight) > 1) setInputHeight(h);
          }}
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
              onFocus={() => {
                // 포커스 직후에는 시스템/실측 이벤트에 의한 단일 애니만 사용해 반동 최소화
                justFocusedRef.current = true;
                setTimeout(() => { justFocusedRef.current = false; }, 260);
              }}
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
        </Animated.View>
      </View>

      {!(Platform.OS === 'android' && kbVisible) && (
        <BottomNavigation activeTab={activeTab} onTabPress={onTabPress} />
      )}
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
  nicknameText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  nicknameInline: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
    alignSelf: 'flex-start',
  },
  messageBackgroundBorder: {
    backgroundColor: "#4B5563",
    borderRadius: 14,
    borderWidth: 0,
    padding: 10,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  messageText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
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
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 12,
    maxWidth: "100%",
    shadowColor: "#1F2937",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  responseText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  responseTime: {
    color: "#e0e7ff",
    fontSize: 11,
    fontWeight: "400",
    textAlign: "right",
    marginTop: 6,
  },
  timeInline: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "500",
    marginLeft: 5,
    marginBottom: 1,
    alignSelf: 'flex-end',
  },
  timeOutside: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "400",
    marginTop: 3,
    marginHorizontal: 4,
  },
  otherMessageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  otherMessageContainer: {
    marginBottom: 12,
  },
  rowAvatarNick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selfMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    backgroundColor: "#e5e7eb",
  },
  inputContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 6,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#667eea",
    borderRadius: 16,
    width: 32,
    height: 32,
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
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatHeaderCenter: {
    position: 'absolute',
    left: 56,
    right: 56,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  backBtn: {
    padding: 4,
    marginRight: 2,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  chatHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    maxWidth: '70%',
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
