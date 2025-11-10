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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { avgPaceLabel } from "../utils/run";
import { listFeeds, toggleFeedLike, deleteFeed, FeedItem } from "../utils/api/feeds";
import { getMyProfile } from "../utils/api/users";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const { width, height } = Dimensions.get("window");

// 상대 시간 포맷 함수 (예: "5분 전", "2시간 전")
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

export default function FeedScreen({ navigation, route }: any) {
  const tabBarHeight = useBottomTabBarHeight?.() ?? 70;
  const insets = useSafeAreaInsets();
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

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

  const getProfileColor = (index: number) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E2",
    ];
    return colors[index % colors.length];
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
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                { backgroundColor: getProfileColor(index) },
              ]}
            >
              <Text style={styles.avatarFallbackText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.timeAgo}>
              {item.createdAt ? formatRelativeTime(item.createdAt) : ""}
            </Text>
          </View>
        </View>

        {/* Image - Full Width */}
        {item.imageUrl && (
          <View style={[styles.imageWrap, { width, height: height * 0.7 }]}>
            <Image source={{ uri: item.imageUrl }} style={styles.feedImage} />

            {/* Minimal Metrics Overlay */}
            {!!distanceKm && (
              <View style={styles.metricsBar}>
                <View style={styles.metricsRowBetween}>
                  <View>
                    <Text style={styles.metricDistance}>
                      {Number(distanceKm).toFixed(2)} km
                    </Text>
                    <View style={styles.metricInlineRow}>
                      {fmtHMS(durationSec) && (
                        <View style={styles.metricItem}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color="#6B7280"
                          />
                          <Text style={styles.metricLabel}>
                            {fmtHMS(durationSec)}
                          </Text>
                        </View>
                      )}
                      {paceLabel && (
                        <View style={[styles.metricItem, { marginLeft: 12 }]}>
                          <Ionicons
                            name="speedometer-outline"
                            size={14}
                            color="#6B7280"
                          />
                          <Text style={styles.metricLabel}>{paceLabel}/km</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Like Button */}
          <View style={styles.rowBetween}>
            <Pressable
              onPress={() => like(item.id, item.liked)}
              style={({ pressed }) => [
                styles.likeButton,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={item.liked ? "heart" : "heart-outline"}
                size={22}
                color={item.liked ? "#FF6B6B" : "#9CA3AF"}
              />
              <Text style={styles.likeCount}>{item.likeCount || 0}</Text>
            </Pressable>

            {myNickname && displayName === myNickname ? (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "삭제",
                    "이 피드를 삭제하시겠습니까?",
                    [
                      { text: "취소", style: "cancel" },
                      {
                        text: "삭제",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await deleteFeed(item.id);
                            setFeeds((prev) => prev.filter((f) => f.id !== item.id));
                          } catch (e) {
                            Alert.alert("오류", "삭제에 실패했습니다.");
                          }
                        },
                      },
                    ]
                  );
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [pressed && styles.pressed]}
                accessibilityLabel="피드 삭제"
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </Pressable>
            ) : (
              <View style={{ width: 20 }} />
            )}
          </View>

          {/* Caption */}
          {!!(item.content && item.content.trim().length > 0) && (
            <Text style={styles.caption}>{item.content}</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000000" />
          <Text style={styles.loadingText}>피드를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={[styles.centered, { paddingHorizontal: 24 }]}>
          <Ionicons name="cloud-offline-outline" size={48} color="#D1D5DB" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchFeeds}>
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Minimal Top Bar (safe-area aware) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topBarRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.navBackBtn,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#10B981" />
          </Pressable>
          <Text style={styles.topBarTitle}>피드</Text>
        </View>
      </View>

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
            colors={["#000000"]}
            tintColor="#000000"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#4B5563",
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    color: "#374151",
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#000000",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  navBackBtn: {
    marginRight: 12,
    padding: 4,
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  timeAgo: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  imageWrap: {
    position: "relative",
    backgroundColor: "#F3F4F6",
  },
  feedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  metricsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  metricsRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricDistance: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  metricInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
    marginLeft: 4,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeCount: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  // removed viewsCount style
  caption: {
    fontSize: 14,
    color: "#374151",
    marginTop: 12,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});
