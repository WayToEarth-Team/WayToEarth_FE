// screens/FeedScreen.tsx (or .jsx)
// screens/FeedScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  FlatList,
} from "react-native";
import { NegativeAlert } from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
import { avgPaceLabel } from "../utils/run";
import { listFeeds, toggleFeedLike, FeedItem } from "../utils/api/feeds";
import { getMyProfile } from "../utils/api/users";
import { useFocusEffect } from "@react-navigation/native";

const { width } = Dimensions.get("window");

export default function FeedScreen({ navigation, route }: any) {
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ open:boolean; title?:string; message?:string }>( { open:false } );


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

  // 화면 복귀 시 최신 데이터 재조회(삭제/수정 반영)
  useFocusEffect(
    useCallback(() => {
      fetchFeeds();
    }, [fetchFeeds])
  );

  // 삭제 반영(선택): 파라미터로 넘어온 경우 즉시 반영
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
      setAlert({ open:true, title:'오류', message:'좋아요 처리에 실패했습니다.' });
    }
  };

  const getProfileColor = (index: number) => {
    const colors = [
      "#6366F1", // 보라
      "#10B981", // 초록
      "#F59E0B", // 주황
      "#EF4444", // 빨강
      "#8B5CF6", // 자주
      "#06B6D4", // 청록
      "#84CC16", // 라임
      "#F97316", // 오렌지
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

    // 러닝 지표 파생값
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
      <View style={styles.postContainer}>
        {alert.open && (
          <NegativeAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false })} />
        )}
        {/* Post Header */}
        <View style={styles.postHeader}>
          {finalUrl ? (
            <Image source={{ uri: finalUrl }} style={styles.headerAvatar} />
          ) : (
            <View
              style={[
                styles.headerAvatar,
                styles.headerAvatarFallback,
                { backgroundColor: getProfileColor(index) },
              ]}
            >
              <Text style={styles.profileInitial}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.headerUsername}>{displayName}</Text>
          <View style={{ flex: 1 }} />
          {/* 옵션 아이콘 제거: 좋아요 외 기능 비활성 */}
        </View>

        {/* Media */}
        {item.imageUrl ? (
          <View style={styles.postImageWrap}>
            <Image source={{ uri: item.imageUrl }} style={styles.postImage} />

            {/* 중앙 메트릭만 표기 (이름/내용/태그 제거) */}
            {!!distanceKm && (
              <View style={styles.metricCenterWrap} pointerEvents="none">
                <Text style={styles.metricDistanceText}>
                  {Number(distanceKm).toFixed(2)}
                  <Text style={styles.metricUnit}> km</Text>
                </Text>
                {(fmtHMS(durationSec) || paceLabel) && (
                  <View style={styles.metricRow}>
                    {fmtHMS(durationSec) && (
                      <View style={styles.metricPill}>
                        <Text style={styles.metricPillText}>
                          {fmtHMS(durationSec)}
                        </Text>
                      </View>
                    )}
                    {paceLabel && (
                      <View style={styles.metricPill}>
                        <Text style={styles.metricPillText}>
                          {paceLabel}/km
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        ) : null}

        {/* Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => like(item.id, item.liked)}
            accessibilityLabel={item.liked ? "좋아요 취소" : "좋아요"}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {item.liked ? (
              <Ionicons name="heart" size={26} color="#e60023" />
            ) : (
              <Ionicons name="heart-outline" size={26} color="#111" />
            )}
          </TouchableOpacity>
        </View>

        {/* Likes */}
        <Text style={styles.likesText}>좋아요 {item.likeCount || 0}개</Text>

        {/* Caption: 아래에 작게 한 줄 */}
        {!!(item.content && item.content.trim().length > 0) && (
          <Text style={styles.captionSmall} numberOfLines={1}>
            {item.content}
          </Text>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>피드를 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (error && !refreshing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchFeeds}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
        {/* 탭 내비게이터 사용으로 하단 바는 전역에서 렌더링됨 */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* 상단 앱바 (Instagram 스타일) */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>피드</Text>
      </View>

      {/* 피드 리스트 */}
      <FlatList
        data={feeds}
        renderItem={renderFeedItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#007AFF"]}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* 탭 내비게이터 사용으로 하단 바는 전역에서 렌더링됨 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  // 로딩/에러
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // 상단 앱바
  appBar: {
    backgroundColor: "#fff",
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
  // appBarActions 제거

  // 리스트
  listContainer: {
    paddingBottom: 100,
  },
  separator: {
    height: 8,
    backgroundColor: "#f8f9fa",
  },

  // Stories 제거

  // Post
  postContainer: {
    backgroundColor: "#fff",
    paddingBottom: 8,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: "#eee",
  },
  headerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerUsername: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
  },
  headerMore: {
    fontSize: 18,
    color: "#111",
    paddingHorizontal: 8,
  },
  postImageWrap: {
    width: width,
    height: width,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  postImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  metricCenterWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  metricDistanceText: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  metricUnit: {
    fontSize: 20,
    fontWeight: "700",
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  metricPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  metricPillText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  /* 하단 캡션/태그 오버레이 제거 */
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  // actionLeft 제거: 좋아요만 유지
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  icon: {
    fontSize: 22,
  },
  iconHeartActive: {
    color: "#e60023",
  },
  likesText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  captionSmall: {
    fontSize: 12,
    color: "#666",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  // viewCommentsText 제거
  // timeText 제거
  profileInitial: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
