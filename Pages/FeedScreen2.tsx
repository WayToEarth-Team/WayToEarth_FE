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
import {
  PositiveAlert,
  NegativeAlert,
  MessageAlert,
  DestructiveConfirm,
} from "../components/ui/AlertDialog";

const { width, height } = Dimensions.get("window");
// 로컬 지구 아이콘(없으면 Ionicons 폴백)
let EARTH_IMG: any = null;
try {
  // 프로젝트의 assets 폴더에 Earth.png가 있어야 합니다.
  // 없으면 아래 폴백(Ionicons)이 사용됩니다.
  // @ts-ignore
  EARTH_IMG = require("../assets/images/Earth.png");
} catch (e) {
  EARTH_IMG = null;
}

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
          size={26}
          color={liked ? "#FF3B5C" : "#374151"}
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
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    id?: number;
  }>({ open: false });
  const [dialog, setDialog] = useState<{
    open: boolean;
    kind: "positive" | "negative" | "message";
    title?: string;
    message?: string;
  }>({ open: false, kind: "message" });

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

    // Get route/map data
    const routeImageUrl =
      (item as any)?.routeImageUrl ||
      (item as any)?.route_image_url ||
      (item as any)?.mapImageUrl ||
      (item as any)?.map_image_url ||
      null;

    const fmtHMS = (sec?: number) => {
      if (!isFinite(Number(sec)) || Number(sec) <= 0) return undefined;
      const s = Math.floor(Number(sec));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const r = s % 60;
      if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(
          2,
          "0"
        )}`;
      }
      return `${m}m ${String(r).padStart(2, "0")}s`;
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
              <Ionicons name="ellipsis-horizontal" size={22} color="#9CA3AF" />
            </Pressable>
          )}
        </View>

        {/* Route Map with Stats Overlay */}
        {(item.imageUrl || routeImageUrl) && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: routeImageUrl || item.imageUrl }}
              style={styles.feedImage}
            />

            {/* Dark gradient overlay for better text readability */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.7)"]}
              style={styles.gradientOverlay}
            />

            {/* Globe Icon - Top Right */}
            <View style={styles.globeIcon}>
              {EARTH_IMG ? (
                <Image source={EARTH_IMG} style={styles.earthImg} />
              ) : (
                <Ionicons name="globe-outline" size={24} color="#FFFFFF" />
              )}
            </View>

            {/* Stats Overlay - Nike Run Club Style */}
            {!!distanceKm && (
              <View style={styles.statsOverlay}>
                {/* Time */}
                {fmtHMS(durationSec) && (
                  <View style={styles.statItemHorizontal}>
                    <Ionicons name="time-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.statValueHorizontal} numberOfLines={1}>
                      {fmtHMS(durationSec)}
                    </Text>
                  </View>
                )}

                {/* Distance */}
                <View style={styles.statItemHorizontal}>
                  <Ionicons name="map-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.statValueHorizontal} numberOfLines={1}>
                    {Number(distanceKm).toFixed(2)} km
                  </Text>
                </View>

                {/* Pace */}
                {paceLabel && (
                  <View style={styles.statItemHorizontal}>
                    <Ionicons name="speedometer-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.statValueHorizontal} numberOfLines={1}>
                      {paceLabel}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Actions & Caption */}
        <View style={styles.bottomSection}>
          <View style={styles.actionRow}>
            <AnimatedLikeButton
              liked={item.liked}
              likeCount={item.likeCount || 0}
              onPress={() => like(item.id, item.liked)}
            />
          </View>

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
        <StatusBar barStyle="light-content" backgroundColor="#1F2937" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor="#1F2937" />
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
      <StatusBar barStyle="light-content" backgroundColor="#1F2937" />

      {/* Dark Top Bar */}
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
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topBarTitle}>피드</Text>
        </View>
      </View>

      {/* Feed List */}
      <FlatList
        data={feeds}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: tabBarHeight + 16 }}
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
      {dialog.open && dialog.kind === "positive" && (
        <PositiveAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
      )}
      {dialog.open && dialog.kind === "negative" && (
        <NegativeAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
      )}
      {dialog.open && dialog.kind === "message" && (
        <MessageAlert
          visible
          title={dialog.title}
          message={dialog.message}
          onClose={() => setDialog({ open: false, kind: "message" })}
        />
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
              setDialog({
                open: true,
                kind: "positive",
                title: "삭제 완료",
                message: "피드가 삭제되었습니다.",
              });
            } catch (e: any) {
              const msg =
                e?.response?.data?.message ||
                e?.message ||
                "삭제에 실패했습니다.";
              setDialog({
                open: true,
                kind: "negative",
                title: "오류",
                message: msg,
              });
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
    backgroundColor: "#F3F4F6",
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
    backgroundColor: "#1F2937",
    paddingHorizontal: 16,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  avatarFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarFallbackText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  timeAgo: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  deleteBtn: {
    padding: 6,
  },
  imageContainer: {
    width: "100%",
    height: height * 0.45,
    backgroundColor: "#1F2937",
    position: "relative",
  },
  feedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
  globeIcon: {
    position: "absolute",
    top: 16,
    right: 16,
    // 배경/그림자 제거, 콘텐츠 크기만
    justifyContent: "center",
    alignItems: "center",
  },
  earthImg: { width: 24, height: 24, resizeMode: "contain" },
  statsOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  statItemHorizontal: {
    // 내용물 크기만큼만 차지해서 줄바꿈 방지
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  statValueHorizontal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "left",
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  likeCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B7280",
  },
  likeCountActive: {
    color: "#FF3B5C",
  },
  caption: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
    marginTop: 12,
  },
  captionName: {
    fontWeight: "700",
    color: "#111827",
  },
  pressed: {
    opacity: 0.6,
  },
});
