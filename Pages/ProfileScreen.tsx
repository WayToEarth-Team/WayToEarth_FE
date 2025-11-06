// screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert, ConfirmAlert } from "../components/ui/AlertDialog";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  getMyProfile,
  getMySummary,
  deleteMyAccount,
  type UserProfile,
  type UserSummary,
} from "../utils/api/users";
import { useFocusEffect } from "@react-navigation/native";
import SafeLayout from "../components/Layout/SafeLayout";
import { Ionicons } from "@expo/vector-icons";
import AppTopBar from "../components/Layout/AppTopBar";
import { clearTokens } from "../utils/auth/tokenManager";
import { deactivateToken } from "../utils/notifications";
import { logout as apiLogout } from "../utils/api/auth";

const number = (v: number | null | undefined, digits = 1) =>
  typeof v === "number" ? Number(v.toFixed(digits)) : 0;

export default function ProfileScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight?.() ?? 0;
  const [me, setMe] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const retriedRef = React.useRef(false);
  const [dialog, setDialog] = useState<{ open: boolean; title?: string; message?: string; kind?: "positive" | "negative" | "message" }>({ open: false, kind: "message" });
  const [confirm, setConfirm] = useState<{ open: boolean; title?: string; message?: string; destructive?: boolean; onConfirm?: () => void }>({ open: false });

  const fetchData = useCallback(async () => {
    try {
      const [meRes, sumRes] = await Promise.all([
        getMyProfile(),
        getMySummary(),
      ]);
      setMe(meRes);
      setSummary(sumRes);
      console.log("✅ /v1/users/me 응답:", meRes);
      console.log("✅ /v1/users/me/summary 응답:", sumRes);
    } catch (err: any) {
      console.warn(err);
      setDialog({ open: true, kind: "negative", title: "오류", message: err?.response?.data?.message || "정보를 불러오지 못했습니다." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 로딩 보호: 5초가 지나도 로딩이면 강제 해제하여 빈 화면 방지
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      try {
        if (loading) {
          console.warn("[Profile] loading timeout → force hide spinner");
          setLoading(false);
        }
      } catch {}
    }, 5000);
    return () => clearTimeout(t);
  }, [loading]);

  // 서버 저장 직후 늦게 반영되는 경우 대비 1회 재시도
  useEffect(() => {
    const noAvatar = !(
      (me as any)?.profile_image_url ||
      (me as any)?.profileImageUrl ||
      route?.params?.avatarUrl
    );
    if (!loading && noAvatar && !retriedRef.current) {
      retriedRef.current = true;
      const t = setTimeout(() => fetchData(), 1200);
      return () => clearTimeout(t);
    }
  }, [loading, me, route?.params?.avatarUrl, fetchData]);

  // 화면 재진입 시 재조회(프로필 수정 반영)
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLogout = useCallback(async () => {
    setConfirm({
      open: true,
      title: "로그아웃",
      message: "정말 로그아웃 하시겠어요?",
      destructive: true,
      onConfirm: async () => {
        try {
          await deactivateToken();
          try { await apiLogout(); } catch {}
        } catch (error) {
          setDialog({ open: true, kind: "negative", title: "오류", message: "로그아웃 중 문제가 발생했습니다." });
        } finally {
          try { await clearTokens(); } catch {}
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }
      },
    });
  }, [navigation]);

  const handleDeleteAccount = useCallback(() => {
    setConfirm({
      open: true,
      title: "회원 탈퇴",
      message:
        "정말 탈퇴하시겠습니까?\n\n모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.\n- 러닝 기록\n- 크루 정보\n- 피드 게시물\n- 방명록\n- 엠블럼",
      destructive: true,
      onConfirm: async () => {
        try {
          try { await deactivateToken(); } catch (e) { console.warn("FCM 토큰 비활성화 실패:", e); }
          await deleteMyAccount();
          try { await clearTokens(); } catch {}
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          setDialog({ open: true, kind: "positive", title: "탈퇴 완료", message: "회원 탈퇴가 완료되었습니다." });
        } catch (error: any) {
          console.error("회원 탈퇴 실패:", error);
          const raw = error?.response?.data?.message || error?.message || "";
          // 크루장(OWNER)인 경우 백엔드에서 에러를 주면 친절한 메시지로 대체
          const isCrewOwner = /크루장|OWNER|소유자|crew owner|transfer ownership/i.test(String(raw));
          const message = isCrewOwner
            ? "크루장은 바로 탈퇴할 수 없습니다.\n크루 소유권을 다른 멤버에게 이양하거나 크루를 폐쇄한 뒤 다시 시도해주세요."
            : raw || "회원 탈퇴 중 문제가 발생했습니다.";
          setDialog({ open: true, kind: "negative", title: "탈퇴 실패", message });
        }
      },
    });
  }, [navigation]);

  // 필드 매핑
  const nickname = me?.nickname || (me as any)?.name || "사용자";
  const overrideFromRoute: string | undefined = route?.params?.avatarUrl;
  const rawProfileUrl =
    overrideFromRoute ||
    me?.profile_image_url ||
    (me as any)?.profileImageUrl ||
    "";
  const cacheKey =
    (me as any)?.profile_image_key ||
    (me as any)?.updated_at ||
    (me as any)?.updatedAt ||
    route?.params?.cacheBust ||
    "";
  const profileUrl = rawProfileUrl
    ? rawProfileUrl.includes("?")
      ? rawProfileUrl
      : `${rawProfileUrl}?v=${encodeURIComponent(
          String(cacheKey || Date.now())
        )}`
    : "";

  const totalDistance = useMemo(() => {
    const v =
      summary?.total_distance ??
      (summary as any)?.totalDistance ??
      me?.total_distance ??
      (me as any)?.totalDistance;
    return number(v, 1);
  }, [summary, me]);

  const totalCount = useMemo(() => {
    return summary?.total_running_count ?? me?.total_running_count ?? 0;
  }, [summary, me]);

  const ownedEmblems = useMemo(() => {
    return summary?.emblem_count ?? (me as any)?.owned_emblem_count ?? 0;
  }, [summary, me]);

  const completionRate = useMemo(() => {
    const c = (summary as any)?.completion ?? summary?.completion_rate;
    return typeof c === "number" ? Math.round(c * 100) : undefined;
  }, [summary]);

  if (loading) {
    return (
      <SafeLayout withBottomInset={false} withTopInset={false}>
        <AppTopBar
          title="내 정보"
          navigation={navigation}
          backgroundColor="#4A7FE8"
          borderBottomColor="#3C6FD0"
          tintColor="#FFFFFF"
        />
        <View style={[styles.container, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>불러오는 중...</Text>
        </View>
      </SafeLayout>
    );
  }

  return (
    <SafeLayout withBottomInset={false} withTopInset={false}>
      <View style={styles.container}>
        {/* Alerts */}
        {dialog.open && dialog.kind === "positive" && (
          <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />
        )}
        {dialog.open && dialog.kind === "negative" && (
          <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />
        )}
        {dialog.open && dialog.kind === "message" && (
          <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />
        )}
        <ConfirmAlert
          visible={!!confirm.open}
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm({ open: false })}
          onConfirm={async () => {
            const fn = confirm.onConfirm;
            setConfirm({ open: false });
            try { await fn?.(); } catch {}
          }}
        />
        <AppTopBar
          title="내 정보"
          navigation={navigation}
          backgroundColor="#F5F5F5"
          borderBottomColor="#F5F5F5"
        />

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentInsetAdjustmentBehavior={
            Platform.OS === "ios" ? "automatic" : "never"
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + tabBarHeight + 80 }}
        >
          {/* 프로필 섹션 */}
          <View style={styles.profileSection}>
            {/* 프로필 이미지 */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatarOuterRing}>
                <View style={styles.avatarInnerRing}>
                  {profileUrl ? (
                    <Image
                      key={profileUrl}
                      source={{ uri: profileUrl }}
                      style={styles.avatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person-outline" size={36} color="#666" />
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* 닉네임 */}
            <Text style={styles.nickname}>{nickname}</Text>
          </View>

          {/* 통계 카드 */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalDistance}</Text>
              <Text style={styles.statLabel}>총 거리(km)</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.orangeText]}>
                {totalCount}
              </Text>
              <Text style={styles.statLabel}>러닝 횟수</Text>
            </View>
          </View>

          {/* 엠블럼 & 방명록: 카드형 메뉴 */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() =>
                navigation.navigate("Emblem", {
                  nickname,
                  ownedEmblems,
                  completionRate,
                })
              }
            >
              <Text style={styles.menuTitle}>엠블럼 컬렉션</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => navigation.navigate("MyGuestbookScreen")}
            >
              <Text style={styles.menuTitle}>내 방명록</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuSpacer} />

          {/* 기본 정보: 카드형 메뉴 (분리) */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={() => navigation.navigate("ProfileEdit")}
            >
              <Text style={styles.menuTitle}>기본 정보 관리</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuSpacer} />

          {/* 로그아웃 */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={handleLogout}
            >
              <Text style={[styles.menuTitle, styles.logoutText]}>
                로그아웃
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuSpacer} />

          {/* 회원 탈퇴 */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.6}
              onPress={handleDeleteAccount}
            >
              <Text style={[styles.menuTitle, styles.deleteAccountText]}>
                회원 탈퇴
              </Text>
            </TouchableOpacity>
          </View>

          {/* 설정 메뉴 - 위 카드로 통합 */}

          {/* 동적 하단 여백은 contentContainerStyle로 대체 */}
        </ScrollView>

        {/* 하단 네비게이션 */}
        {/* 탭 내비게이터 사용으로 하단 바는 전역에서 렌더링됨 */}
      </View>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },

  // 헤더
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: "#F5F5F5",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
  },
  shareIcon: {
    fontSize: 16,
    color: "#666666",
  },

  // 프로필 섹션
  profileSection: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 40,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatarOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInnerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#D0D0D0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  nickname: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888888",
    fontWeight: "400",
  },

  // 통계 카드
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  orangeText: {
    color: "#FF6B35",
  },
  statLabel: {
    fontSize: 14,
    color: "#888888",
    fontWeight: "400",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#F0F0F0",
    marginHorizontal: 20,
  },

  // 뱃지 섹션
  badgeSection: {},

  // 메뉴 섹션
  menuSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: "hidden",
  },
  menuSpacer: { height: 12 },
  menuDivider: {
    height: 1,
    backgroundColor: "#F0F0F0",
    marginLeft: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#FFFFFF",
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "400",
    color: "#000000",
  },
  logoutText: {
    color: "#FF3B30",
  },
  deleteAccountText: {
    color: "#999",
    fontSize: 14,
  },
  chevron: {
    fontSize: 18,
    color: "#C0C0C0",
    fontWeight: "300",
  },

  // 하단 여백
  bottomSpacing: { height: 120 },
});
