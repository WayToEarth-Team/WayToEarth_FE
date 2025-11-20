// Pages/LandmarkGuestbookScreen.tsx
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getGuestbooksByLandmark,
  getGuestbookErrorMessage,
} from "@utils/api/guestbook";
import type {
  GuestbookResponse,
  PageableResponse,
} from "@types/guestbook";

interface LandmarkGuestbookScreenProps {
  route: {
    params: {
      landmarkId: number;
      landmarkName?: string;
    };
  };
  navigation: any;
}

/**
 * 랜드마크별 방명록 목록 화면
 * - 특정 랜드마크의 공개 방명록만 표시
 * - 페이징 지원
 * - Pull to Refresh
 */
export default function LandmarkGuestbookScreen({
  route,
  navigation,
}: LandmarkGuestbookScreenProps) {
  const { landmarkId, landmarkName } = route.params;

  const [guestbooks, setGuestbooks] = useState<GuestbookResponse[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuestbooks();
  }, [page]);

  const loadGuestbooks = async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const response: PageableResponse<GuestbookResponse> =
        await getGuestbooksByLandmark(landmarkId, page, 20);

      if (page === 0) {
        setGuestbooks(response.content);
      } else {
        setGuestbooks((prev) => [...prev, ...response.content]);
      }

      setHasMore(!response.last);
    } catch (err: any) {
      console.error("[LandmarkGuestbook] 조회 실패:", err);
      setError(getGuestbookErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setHasMore(true);
    // page가 0이면 직접 로드, 아니면 0으로 리셋하여 useEffect 트리거
    if (page === 0) {
      loadGuestbooks();
    } else {
      setPage(0);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

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

  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  const renderGuestbookItem = ({
    item,
    index,
  }: {
    item: GuestbookResponse;
    index: number;
  }) => (
    <View style={styles.guestbookItem}>
      {/* 번호 배지 */}
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{guestbooks.length - index}</Text>
      </View>

      {/* 사용자 정보 */}
      <View style={styles.userInfo}>
        <Text style={styles.nickname}>{item.user.nickname}</Text>
        <Text style={styles.location}>from {item.landmark.cityName}</Text>
      </View>

      {/* 날짜 */}
      <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>

      {/* 메시지 */}
      <Text style={styles.message}>{item.message}</Text>

      {/* 하단 장식선 */}
      <View style={styles.decorativeLines}>
        <View style={styles.decorativeLine} />
        <View style={styles.decorativeLine} />
        <View style={styles.decorativeLine} />
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerCard}>
      {/* 왼쪽 장식 패널 */}
      <View style={styles.decorativePanel}>
        <View style={styles.decorativePanelLine} />
        <View style={styles.decorativePanelLine} />
        <View style={styles.decorativePanelLine} />
      </View>

      {/* 정보 영역 */}
      <View style={styles.headerContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="business-outline" size={18} color="#8b4513" />
          <Text style={styles.headerEmojiText}>{landmarkName || "랜드마크"}</Text>
        </View>
        <Text style={styles.headerSubtitle}>여행자들의 발자취</Text>
        <Text style={styles.headerCount}>총 {guestbooks.length}개의 기록</Text>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if ((loading && page === 0) || refreshing) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8b4513" />
          <Text style={styles.loadingText}>방명록을 불러오는 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#a0522d" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="document-text-outline" size={40} color="#a0522d" style={{ marginBottom: 8 }} />
        <Text style={styles.emptyText}>
          아직 작성된 방명록이 없습니다.
        </Text>
        <Text style={styles.emptySubText}>
          첫 방명록을 남겨보세요!
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || page === 0) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#8b4513" />
        <Text style={styles.footerText}>더 불러오는 중...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#8b4513" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{landmarkName || "랜드마크"} 방명록</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 방명록 목록 */}
      <FlatList
        data={guestbooks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderGuestbookItem}
        ListHeaderComponent={guestbooks.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8b4513"
          />
        }
        contentContainerStyle={
          guestbooks.length === 0 ? styles.emptyListContainer : styles.listContent
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f3f0",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f3f0",
    paddingHorizontal: 20,
    paddingVertical: 20,
    height: 80,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 18,
    color: "#8b4513",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8b4513",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  headerCard: {
    backgroundColor: "#8b4513",
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    height: 130,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
    overflow: "hidden",
  },
  decorativePanel: {
    width: 60,
    backgroundColor: "#654321",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  decorativePanelLine: {
    width: 30,
    height: 2,
    backgroundColor: "#d4af37",
  },
  headerContent: {
    flex: 1,
    backgroundColor: "#f4f1e8",
    padding: 20,
    justifyContent: "space-between",
  },
  headerEmojiText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8b4513",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#a0522d",
    marginTop: 4,
  },
  headerCount: {
    fontSize: 12,
    color: "#8b4513",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: "#a0522d",
    marginTop: 12,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b4513",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: "#8b4513",
    borderRadius: 25,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8b4513",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#a0522d",
    textAlign: "center",
    lineHeight: 20,
  },
  guestbookItem: {
    backgroundColor: "#fffef7",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#d4af37",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 24,
    minHeight: 176,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  numberBadge: {
    position: "absolute",
    left: 24,
    top: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#8b4513",
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  userInfo: {
    marginLeft: 44,
    marginBottom: 12,
  },
  nickname: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8b4513",
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    color: "#a0522d",
    fontStyle: "italic",
  },
  dateText: {
    position: "absolute",
    right: 24,
    top: 24,
    fontSize: 12,
    color: "#8b4513",
  },
  message: {
    fontSize: 15,
    color: "#5d4037",
    lineHeight: 22.5,
    marginTop: 8,
  },
  decorativeLines: {
    position: "absolute",
    right: 24,
    bottom: 16,
    gap: 4,
    alignItems: "flex-end",
  },
  decorativeLine: {
    width: 36,
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#a0522d",
    marginTop: 8,
  },
});
