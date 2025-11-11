// screens/FeedScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  StatusBar,
  RefreshControl,
  FlatList,
  Pressable,
  StyleSheet,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { avgPaceLabel } from "../utils/run";
import {
  listFeeds,
  toggleFeedLike,
  deleteFeed,
  FeedItem,
} from "../utils/api/feeds";
import { getMyProfile } from "../utils/api/users";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { PositiveAlert, NegativeAlert, MessageAlert, DestructiveConfirm } from "../components/ui/AlertDialog";

const { width, height } = Dimensions.get("window");

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "방금 전";
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR");
};

// Animated Like Button Component
const AnimatedLikeButton = ({
  liked,
  likeCount,
  onPress,
}: {
  liked: boolean;
  likeCount: number;
  onPress: () => void;
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.likeButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={24}
          color={liked ? "#FF3B5C" : "#1F2937"}
        />
      </Animated.View>
      {likeCount > 0 && (
        <Text style={[styles.likeCount, liked && styles.likeCountActive]}>
          {likeCount}
        </Text>
      )}
    </Pressable>
  );
};

export default function FeedScreen({ navigation, route }: any) {
  const tabBarHeight = useBottomTabBarHeight?.() ?? 70;
  const insets = useSafeAreaInsets();
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id?: number }>({ open: false });
  const [dialog, setDialog] = useState<{ open: boolean; kind: 'positive'|'negative'|'message'; title?: string; message?: string }>({ open: false, kind: 'message' });

  const fetchFeeds = useCallback(async () => {
    try {
      setError(null);
      const [data, me] = await Promise.all([
        listFeeds(0, 20),
        getMyProfile().catch(() => null),
      ]);
      if (me) {
        const nk = (me as any)?.nickname ?? null;
        const url =
          (me as any)?.profile_image_url ??
          (me as any)?.profileImageUrl ??
          null;
        setMyNickname(nk);
        setMyAvatarUrl(url);
      }
      setFeeds(data);
    } catch (err) {
      console.error("피드 불러오기 실패:", err);
      setError("피드를 불러오는데 실패했습니다.");
      setFeeds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFeeds();
  }, [fetchFeeds]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  useFocusEffect(
    useCallback(() => {
      fetchFeeds();
    }, [fetchFeeds])
  );

  useEffect(() => {
    if (route?.params?.deletedId) {
      const deletedId = route.params.deletedId;
      setFeeds((prev) => prev.filter((f) => f.id !== deletedId));
    }
  }, [route?.params?.deletedId]);

  const like = async (feedId: number, currentLiked: boolean) => {
    try {
      const { likeCount, liked } = await toggleFeedLike(feedId);
      setFeeds((prev) =>
        prev.map((f) => (f.id === feedId ? { ...f, likeCount, liked } : f))
      );
    } catch (err) {
      console.error("좋아요 실패:", err);
      Alert.alert("오류", "좋아요 처리에 실패했습니다.");
    }
  };

  const getProfileGradient = (index: number) => {
    const gradients = [
      ["#FF6B9D", "#C44569"],
      ["#4FACFE", "#00F2FE"],
      ["#43E97B", "#38F9D7"],
      ["#FA709A", "#FEE140"],
      ["#A8EDEA", "#FED6E3"],
      ["#FF9A56", "#FF6A88"],
      ["#667EEA", "#764BA2"],
      ["#F093FB", "#F5576C"],
    ];
    return gradients[index % gradients.length];
  };

  const renderFeedItem = ({
    item,
    index,
  }: {
    item: FeedItem;
    index: number;
  }) => {
    const displayName =
      (item as any)?.nickname || (item as any)?.author?.nickname || "사용자";
    const avatarUrl =
      (item as any)?.profile_image_url ||
      (item as any)?.profileImageUrl ||
      (item as any)?.author?.profile_image_url ||
      (item as any)?.author?.profileImageUrl ||
      null;
    const selfAvatar =
      myNickname && displayName === myNickname && myAvatarUrl
        ? myAvatarUrl
        : null;
    const finalUrl = avatarUrl || selfAvatar;

    const distanceKm: number | undefined =
      typeof (item as any)?.distance === "number"
        ? (item as any).distance
        : undefined;
    const durationSec: number | undefined =
      (item as any)?.duration ??
      (item as any)?.durationSeconds ??
      (item as any)?.total_duration_sec ??
      (item as any)?.elapsedSec ??
      (item as any)?.elapsedSeconds;
    const paceLabel: string | undefined =
      (item as any)?.averagePace ||
      (distanceKm &&
      durationSec &&
      isFinite(distanceKm) &&
      isFinite(durationSec)
        ? avgPaceLabel(distanceKm, durationSec)
        : undefined);

    const fmtHMS = (sec?: number) => {
      if (!isFinite(Number(sec)) || Number(sec) <= 0) return undefined;
      const s = Math.floor(Number(sec));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const r = s % 60;
      return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    };

    return (
      <View style={styles.cardContainer}>
        {/* Header */}
        <View style={styles.cardHeader}>
          {finalUrl ? (
            <Image source={{ uri: finalUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={getProfileGradient(index)}
              style={[styles.avatar, styles.avatarFallback]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarFallbackText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.timeAgo}>
              {item.createdAt ? formatRelativeTime(item.createdAt) : ""}
            </Text>
          </View>
          {myNickname && displayName === myNickname && (
            <Pressable
              onPress={() => {
                setConfirmDelete({ open: true, id: item.id });
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Image */}
        {item.imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: item.imageUrl }} style={styles.feedImage} />

            {/* Glassmorphism Metrics Overlay */}
            {!!distanceKm && (
              <BlurView intensity={80} tint="light" style={styles.metricsBlur}>
                <View style={styles.metricsContent}>
                  <View style={styles.distanceRow}>
                    <Text style={styles.distanceNumber}>
                      {Number(distanceKm).toFixed(2)}
                    </Text>
                    <Text style={styles.distanceUnit}>km</Text>
                  </View>
                  <View style={styles.statsRow}>
                    {fmtHMS(durationSec) && (
                      <View style={styles.statItem}>
                        <Ionicons name="time" size={16} color="#6B7280" />
                        <Text style={styles.statText}>
                          {fmtHMS(durationSec)}
                        </Text>
                      </View>
                    )}
                    {paceLabel && (
                      <View style={styles.statItem}>
                        <Ionicons
                          name="speedometer"
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.statText}>{paceLabel}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </BlurView>
            )}
          </View>
        )}

        {/* Actions & Caption */}
        <View style={styles.bottomSection}>
          <AnimatedLikeButton
            liked={item.liked}
            likeCount={item.likeCount || 0}
            onPress={() => like(item.id, item.liked)}
          />

          {!!(item.content && item.content.trim().length > 0) && (
            <Text style={styles.caption}>
              <Text style={styles.captionName}>{displayName}</Text>{" "}
              {item.content}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />
        <View style={[styles.centered, { paddingHorizontal: 24 }]}>
          <Ionicons name="cloud-offline-outline" size={64} color="#E5E7EB" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.retryBtn,
              pressed && styles.pressed,
            ]}
            onPress={fetchFeeds}
          >
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Minimal Top Bar */}
      <BlurView
        intensity={100}
        tint="light"
        style={[styles.topBar, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.topBarRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.navBackBtn,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={28} color="#10B981" />
          </Pressable>
          <Text style={styles.topBarTitle}>피드</Text>
        </View>
      </BlurView>

      {/* Feed List */}
      <FlatList
        data={feeds}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#10B981"]}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      />
      {/* Alerts */}
      {dialog.open && dialog.kind === 'positive' && (
        <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: 'message' })} />
      )}
      {dialog.open && dialog.kind === 'negative' && (
        <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: 'message' })} />
      )}
      {dialog.open && dialog.kind === 'message' && (
        <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: 'message' })} />
      )}

      {/* Delete Confirm */}
      {confirmDelete.open && (
        <DestructiveConfirm
          visible
          title="피드 삭제"
          message="이 피드를 삭제하시겠습니까? 삭제 후에는 되돌릴 수 없습니다."
          confirmText="삭제"
          cancelText="취소"
          onClose={() => setConfirmDelete({ open: false })}
          onConfirm={async () => {
            const id = confirmDelete.id!;
            try {
              await deleteFeed(id);
              setFeeds((prev) => prev.filter((f) => f.id !== id));
              setDialog({ open: true, kind: 'positive', title: '삭제 완료', message: '피드가 삭제되었습니다.' });
            } catch (e: any) {
              const msg = e?.response?.data?.message || e?.message || '삭제에 실패했습니다.';
              setDialog({ open: true, kind: 'negative', title: '오류', message: msg });
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 24,
    marginBottom: 32,
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  navBackBtn: {
    marginRight: 8,
    padding: 4,
  },
  topBarTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 2,
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  timeAgo: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  imageContainer: {
    width: width,
    height: height * 0.65,
    backgroundColor: "#F9FAFB",
    position: "relative",
  },
  feedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  metricsBlur: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  metricsContent: {
    padding: 20,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  distanceNumber: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: -1,
  },
  distanceUnit: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },
  bottomSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  likeCount: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
  },
  likeCountActive: {
    color: "#FF3B5C",
  },
  caption: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
    marginTop: 4,
  },
  captionName: {
    fontWeight: "700",
    color: "#111827",
  },
  pressed: {
    opacity: 0.6,
  },
});
