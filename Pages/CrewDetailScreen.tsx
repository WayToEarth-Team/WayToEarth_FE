import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PositiveAlert,
  NegativeAlert,
  MessageAlert,
  ConfirmAlert,
  DestructiveConfirm,
} from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getMyProfile, getUserProfile } from "../utils/api/users";
import {
  getMyCrewDetail,
  closeCrew,
  leaveCrew,
  promoteMember,
  demoteMember,
  transferOwnership,
  removeMember,
  approveRequest,
  rejectRequest,
  getCrewMembers,
} from "../utils/api/crews";
import {
  getCrewMonthlySummary,
  getCrewMemberRanking,
} from "../utils/api/crewStats";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Member = {
  id: string;
  nickname: string;
  role: "ADMIN" | "MEMBER";
  distance?: number;
  profileImage?: string | null;
  lastRunningDate?: string | null;
};
type Applicant = {
  id: string;
  nickname: string;
  level?: string;
  userId?: string;
  profileImage?: string | null;
};

export default function CrewDetailScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [crewId, setCrewId] = useState<string>("");
  const [myUserId, setMyUserId] = useState<string>("");
  const [crewName, setCrewName] = useState("");
  const [crewImageUrl, setCrewImageUrl] = useState<string | null>(null);
  const [crewInfo, setCrewInfo] = useState({
    members: "",
    roleLabel: "",
    totalDistance: "0km",
    activeMembers: "0명",
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Applicant[]>([]);
  const [selectedTab, setSelectedTab] = useState<"통계" | "멤버" | "설정">(
    "통계"
  );
  const [mvpMember, setMvpMember] = useState<{
    name: string;
    distance: string;
    profileImage?: string | null;
    userId?: string | number;
  } | null>(null);
  const [memberRanking, setMemberRanking] = useState<
    Array<{
      userId: number;
      userName: string;
      totalDistance: number;
      rank: number;
      profileImage?: string | null;
    }>
  >([]);

  // 멤버 무한 스크롤 상태
  const [memberPage, setMemberPage] = useState(0);
  const [hasMoreMembers, setHasMoreMembers] = useState(true);
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);

  const isRefreshingRef = useRef(false);
  const [alert, setAlert] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    kind?: "positive" | "negative" | "message";
  }>({ open: false, kind: "message" });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    destructive?: boolean;
    onConfirm?: () => void;
  }>({ open: false });

  const refresh = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      console.log("[CREW_DETAIL] refresh start");
      const detail = await getMyCrewDetail();
      if (!detail) {
        console.log("[CREW_DETAIL] no my crew detail (null)");
      } else {
        console.log("[CREW_DETAIL] detail loaded:", {
          id: detail.crew.id,
          name: detail.crew.name,
          members: detail.members?.length,
        });
      }
      if (detail) {
        setCrewName(detail.crew.name);
        setCrewId(String(detail.crew.id));
        setRole(detail.role);
        setCrewImageUrl(detail.crew.imageUrl ?? null);
        console.log("[CREW_DETAIL] crew image:", detail.crew.imageUrl);
        console.log(
          "[CREW_DETAIL] members with profiles:",
          detail.members.map((m) => ({
            id: m.id,
            nick: m.nickname,
            profile: m.profileImage,
          }))
        );
        if (selectedTab !== "멤버") {
          setMembers(detail.members as Member[]);
        }
        setPending(detail.pending as Applicant[]);
        // 월간 요약/멤버 랭킹 조회
        try {
          const now = new Date();
          const month = `${now.getFullYear()}${String(
            now.getMonth() + 1
          ).padStart(2, "0")}`;
          const [summary, ranking] = await Promise.all([
            getCrewMonthlySummary(String(detail.crew.id), month).catch((e) => {
              console.warn(
                "[CREW_DETAIL] monthly summary failed",
                e?.response?.status || e?.message || e
              );
              return null;
            }),
            getCrewMemberRanking(String(detail.crew.id), {
              month,
              limit: 10,
            }).catch((e) => {
              console.warn(
                "[CREW_DETAIL] member ranking failed",
                e?.response?.status || e?.message || e
              );
              return [];
            }),
          ]);
          const dist = summary?.totalDistance ?? 0;
          const memberCount = detail.members?.length ?? 0;
          const active = summary?.totalActiveMembers ?? memberCount;

          console.log("[CREW_DETAIL] Setting crew info:", {
            memberCount,
            active,
            dist,
          });

          setCrewInfo({
            members: `멤버 ${memberCount}명`,
            roleLabel: `내 역할 ${detail.role === "ADMIN" ? "관리자" : "멤버"}`,
            totalDistance: formatKm(dist),
            activeMembers: `${active}명`,
          });
          // 0km 멤버 포함: 전체 멤버를 기준으로 API 결과를 병합하여 거리 미기록자도 표시
          const apiMap = new Map<string, any>();
          (ranking || []).forEach((r: any) => apiMap.set(String(r.userId), r));
          const all = (detail.members || []).map((m: any) => {
            const r = apiMap.get(String(m.id));
            return {
              userId: Number(m.id),
              userName: String(m.nickname || ""),
              totalDistance: r?.totalDistance ?? 0,
              rank: 0,
              profileImage: m.profileImage ?? null,
            };
          });
          all.sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0));
          const ranked = all.map((x, i) => ({ ...x, rank: i + 1 }));
          setMemberRanking(ranked);

          const top = ranking?.[0];
          if (top) {
            // MVP 사용자의 프로필 이미지 로드
            const mvpUserId = top.userId;
            let profileImage: string | null = null;

            if (mvpUserId) {
              // 이미 로드된 멤버 목록에서 프로필 찾기
              const memberInList = detail.members.find(
                (m) => String(m.id) === String(mvpUserId)
              );
              if (memberInList?.profileImage) {
                profileImage = memberInList.profileImage;
                console.log(
                  "[CREW_DETAIL] MVP profile from member list:",
                  profileImage
                );
              } else {
                // 폴백: 멤버 목록에 프로필이 없는 경우, 사용자 프로필 API로 조회
                try {
                  const myProfile = await getMyProfile();
                  if (String(myProfile.id) === String(mvpUserId)) {
                    // MVP가 나인 경우
                    profileImage = myProfile.profile_image_url ?? null;
                    console.log(
                      "[CREW_DETAIL] MVP is me, using my profile image:",
                      profileImage
                    );
                  } else {
                    // MVP가 다른 사람인 경우
                    const mvpProfile = await getUserProfile(String(mvpUserId));
                    profileImage = mvpProfile.profile_image_url ?? null;
                    console.log(
                      "[CREW_DETAIL] MVP profile from user API:",
                      profileImage
                    );
                  }
                } catch (e) {
                  console.warn("[CREW_DETAIL] Failed to load profile:", e);
                }
              }
            }

            setMvpMember({
              name: top.userName,
              distance: formatKm(top.totalDistance),
              profileImage,
              userId: mvpUserId,
            });
          } else {
            setMvpMember(null);
          }
        } catch {}
      } else {
        // 내 크루가 없는 경우: 간단히 안내
        setCrewName("");
        setCrewId("");
        setMembers([]);
        setPending([]);
        setCrewInfo({
          members: "",
          roleLabel: "",
          totalDistance: "0km",
          activeMembers: "0명",
        });
        setAlert({
          open: true,
          kind: "message",
          title: "내 크루 없음",
          message: "현재 가입된 크루가 없습니다.",
        });
      }
    } finally {
      console.log("[CREW_DETAIL] refresh done");
      if (!opts?.silent) setLoading(false);
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    refresh();
    // 내 사용자 식별자 확보: 자기 자신에 대한 액션(내보내기 등) 숨김 처리용
    (async () => {
      try {
        const me = await getMyProfile();
        setMyUserId(String((me as any)?.id ?? ""));
      } catch {}
    })();
  }, []);

  // 포커스 시/주기적 새로고침 (실시간에 가깝게)
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      // 즉시 소프트 리프레시
      refresh({ silent: true });
      // 포커스 중 폴링 (멤버 탭이면 더 짧게)
      const interval = setInterval(
        () => {
          if (!cancelled) refresh({ silent: true });
        },
        selectedTab === "멤버" ? 15000 : 30000
      );
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [selectedTab, crewId])
  );

  // 앱이 Active로 전환될 때 소프트 리프레시
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh({ silent: true });
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {}
    };
  }, [crewId]);

  // 무한 스크롤: 추가 멤버 로드
  const loadMoreMembers = async () => {
    if (loadingMoreMembers || !hasMoreMembers || !crewId) return;

    setLoadingMoreMembers(true);
    try {
      const nextPage = memberPage + 1;
      const result = await getCrewMembers(crewId, nextPage, 20);
      setMembers((prev) => [...prev, ...result.members]);
      setMemberPage(nextPage);
      setHasMoreMembers(result.hasMore);
    } catch (error) {
      console.error("Failed to load more members:", error);
    } finally {
      setLoadingMoreMembers(false);
    }
  };

  // 탭 변경 시 멤버 목록 리셋 및 첫 페이지 로드
  useEffect(() => {
    if (selectedTab === "멤버" && crewId) {
      const loadFirstPage = async () => {
        setLoadingMoreMembers(true);
        try {
          const result = await getCrewMembers(crewId, 0, 20);
          console.log(
            "[CREW_DETAIL] Setting members (first page):",
            result.members.length,
            result.members
          );
          setMembers(result.members);
          setMemberPage(0);
          setHasMoreMembers(result.hasMore);
        } catch (error) {
          console.error("Failed to load members:", error);
        } finally {
          setLoadingMoreMembers(false);
        }
      };
      loadFirstPage();
    }
  }, [selectedTab, crewId]);

  // 더 견고한 관리자 판별: 서버 역할 + 멤버 목록 + 소유자 폴백
  const isAdmin =
    role === "ADMIN" ||
    members.some((m) => m.id === myUserId && m.role === "ADMIN");

  function formatKm(n: number | string) {
    const v = typeof n === "string" ? Number(n) : n;
    if (!isFinite(v as any)) return "0km";
    const r = Math.round((v as number) * 10) / 10;
    return r % 1 === 0 ? `${r | 0}km` : `${r}km`;
  }

  function formatLastRunning(date: string | null | undefined): string {
    if (!date) return "러닝기록 없음";
    const runningDate = new Date(date);
    if (isNaN(runningDate.getTime())) return "-";
    const now = new Date();
    const diffMs = now.getTime() - runningDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (diffDays <= 7) return `${diffDays}일전`;
    return runningDate.toLocaleDateString("ko-KR");
  }

  return (
    <SafeAreaView edges={["top"]} style={s.container}>
      <Alerts
        alert={alert}
        setAlert={setAlert}
        confirm={confirm}
        setConfirm={setConfirm}
      />
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={s.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => refresh({ silent: false })}
            tintColor="#4A7FE8"
            titleColor="#4A7FE8"
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 200;
          if (
            isCloseToBottom &&
            selectedTab === "멤버" &&
            !loadingMoreMembers &&
            hasMoreMembers
          ) {
            loadMoreMembers();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* 크루 정보 카드 (그리드 스타일과 유사한 미니멀 카드) */}
        <View style={s.crewInfoCard}>
          <View style={s.crewHeader}>
            <View style={s.crewAvatarContainer}>
              {crewImageUrl ? (
                <Image
                  source={{ uri: crewImageUrl, cache: "force-cache" }}
                  style={s.crewAvatar}
                  resizeMode="cover"
                  onError={(e) =>
                    console.log(
                      "[CREW_DETAIL] Crew image error:",
                      e.nativeEvent.error
                    )
                  }
                />
              ) : (
                <View style={s.crewAvatarPlaceholder}>
                  <Ionicons name="people" size={28} color="#94A3B8" />
                </View>
              )}
            </View>
            <Text style={s.crewName}>{crewName}</Text>
            <View style={s.countRow}>
              <Ionicons name="people" size={14} color="#6B7280" />
              <Text style={s.countText}>
                {loading ? "로딩 중..." : crewInfo.members || "멤버 0명"}
              </Text>
            </View>
            <TouchableOpacity
              style={s.chatBtn}
              onPress={() => {
                setAlert({
                  open: true,
                  kind: "message",
                  title: "채팅 이동",
                  message: crewId
                    ? `크루(${crewName || ""}) 채팅으로 이동 시도`
                    : "크루 정보를 불러오지 못했습니다.",
                });
                if (!crewId) {
                  setAlert({
                    open: true,
                    kind: "negative",
                    title: "채팅 이동 불가",
                    message:
                      "크루 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
                  });
                  return;
                }
                const params: any = { crewId: crewId, crewName };
                const state: any = (navigation as any)?.getState?.();
                const canHere =
                  Array.isArray(state?.routeNames) &&
                  state.routeNames.includes("CrewChat");
                if (canHere) {
                  (navigation as any).navigate("CrewChat", params);
                } else {
                  const parent = (navigation as any)?.getParent?.();
                  if (parent) {
                    parent.navigate("CrewChat", params);
                  } else {
                    setAlert({
                      open: true,
                      kind: "negative",
                      title: "채팅 이동 불가",
                      message: "네비게이션 경로를 찾을 수 없습니다.",
                    });
                  }
                }
              }}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#6366F1"
              />
            </TouchableOpacity>
          </View>

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{crewInfo.totalDistance}</Text>
              <Text style={s.statLabel}>월간 총 거리</Text>
            </View>
            <View style={s.statItem}>
              <Text style={s.statValue}>{crewInfo.activeMembers}</Text>
              <Text style={s.statLabel}>이번 달 활동</Text>
            </View>
          </View>
        </View>

        {/* 가입 신청은 통계 탭 내부로 이동 */}

        {/* 탭 메뉴 */}
        <View style={s.tabContainer}>
          <TouchableOpacity
            style={[s.tab, selectedTab === "통계" && s.activeTab]}
            onPress={() => setSelectedTab("통계")}
          >
            <Text
              style={[s.tabText, selectedTab === "통계" && s.activeTabText]}
            >
              통계
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, selectedTab === "멤버" && s.activeTab]}
            onPress={() => setSelectedTab("멤버")}
          >
            <Text
              style={[s.tabText, selectedTab === "멤버" && s.activeTabText]}
            >
              멤버
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, selectedTab === "설정" && s.activeTab]}
            onPress={() => setSelectedTab("설정")}
          >
            <Text
              style={[s.tabText, selectedTab === "설정" && s.activeTabText]}
            >
              설정
            </Text>
          </TouchableOpacity>
        </View>

        {/* 통계 탭 내용 */}
        {selectedTab === "통계" && (
          <>
            {/* 멤버 랭킹 표 */}
            {memberRanking && memberRanking.length > 0 && (
              <View style={s.rankCard}>
                <View style={s.rankHeader}>
                  <Text style={s.rankTitle}>멤버 랭킹</Text>
                  <Text style={s.rankSubtitle}>이번 달 누적 거리 기준</Text>
                </View>
                <View>
                  {memberRanking.map((r) => (
                    <View key={r.userId} style={s.rankRow}>
                      <View style={s.rankLeft}>
                        <View
                          style={[
                            s.rankBadge,
                            r.rank <= 3 && s[`rankBadgeTop${r.rank}` as const],
                          ]}
                        >
                          <Text
                            style={[
                              s.rankBadgeText,
                              r.rank <= 3 && s.rankBadgeTextTop,
                            ]}
                          >
                            {r.rank}
                          </Text>
                        </View>
                        <View style={s.rankAvatarWrap}>
                          {r.profileImage ? (
                            <Image
                              source={{ uri: r.profileImage }}
                              style={s.rankAvatar}
                            />
                          ) : (
                            <View style={s.rankAvatarPlaceholder}>
                              <Ionicons
                                name="person"
                                size={16}
                                color="#9CA3AF"
                              />
                            </View>
                          )}
                        </View>
                        <Text style={s.rankName} numberOfLines={1}>
                          {r.userName}
                        </Text>
                      </View>
                      <View style={s.rankRight}>
                        <Text style={s.rankDistance}>
                          {(Math.round(r.totalDistance * 10) / 10).toFixed(
                            r.totalDistance % 1 === 0 ? 0 : 1
                          )}
                        </Text>
                        <Text style={s.rankUnit}>km</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 통계 및 MVP 섹션 */}

            {/* MVP 섹션 (새 디자인) */}
            {mvpMember && (
              <View style={s.mvpSection}>
                <LinearGradient
                  colors={["#FEFCE8", "#FEF9C3", "#FEF3C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.mvpGradient}
                >
                  <View style={s.mvpDecoCircle1} />
                  <View style={s.mvpDecoCircle2} />

                  <View style={s.mvpContent}>
                    <View style={s.mvpHeaderRow}>
                      <View style={s.mvpTitleGroup}>
                        <Text style={s.mvpEmoji}>🏆</Text>
                        <Text style={s.mvpTitle}>이번 달 MVP</Text>
                      </View>
                      <View style={s.mvpBadge}>
                        <Text style={s.mvpBadgeText}>MVP</Text>
                      </View>
                    </View>

                    <View style={s.mvpCard}>
                      <View style={s.mvpAvatarContainer}>
                        {mvpMember.profileImage ? (
                          <Image
                            source={{
                              uri: mvpMember.profileImage,
                              cache: "force-cache",
                            }}
                            style={s.mvpAvatar}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={s.mvpAvatarPlaceholder}>
                            <Ionicons name="person" size={28} color="#F59E0B" />
                          </View>
                        )}
                        <View style={s.crownBadge}>
                          <Text style={s.crownEmoji}>👑</Text>
                        </View>
                      </View>

                      <View style={s.mvpInfo}>
                        <Text style={s.mvpName}>{mvpMember.name}</Text>
                        <View style={s.mvpDistanceRow}>
                          <Ionicons
                            name="trending-up"
                            size={16}
                            color="#F59E0B"
                          />
                          <Text style={s.mvpDistance}>
                            {mvpMember.distance}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
          </>
        )}

        {/* 멤버 탭 내용 */}
        {selectedTab === "멤버" && (
          <>
            {/* 가입 신청 (관리자만 - 멤버 탭에 표시) */}
            {isAdmin && (
              <View style={s.applicationCard}>
                <View style={s.applicationHeader}>
                  <Text style={s.applicationTitle}>가입 신청</Text>
                  {pending.length > 0 && (
                    <View style={s.applicationBadge}>
                      <Text style={s.applicationBadgeText}>
                        {pending.length}
                      </Text>
                    </View>
                  )}
                </View>

                {pending.length > 0 ? (
                  pending.map((a) => (
                    <View key={a.id} style={s.applicationRow}>
                      <View style={s.applicantInfo}>
                        {a.profileImage ? (
                          <Image
                            source={{ uri: a.profileImage }}
                            style={s.applicantAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              s.applicantAvatar,
                              s.applicantAvatarPlaceholder,
                            ]}
                          >
                            <Ionicons name="person" size={20} color="#F59E0B" />
                          </View>
                        )}
                        <View>
                          <Text style={s.applicantName}>{a.nickname}</Text>
                          <Text style={s.applicantLevel}>{a.level}</Text>
                        </View>
                      </View>
                      <View style={s.applicationBtns}>
                        <TouchableOpacity
                          style={s.approvePill}
                          onPress={async () => {
                            try {
                              await approveRequest(a.id);
                              await refresh({ silent: true });
                            } catch (e: any) {
                              try {
                                const detail = await getMyCrewDetail();
                                const already = detail?.members?.some(
                                  (m) =>
                                    a.userId &&
                                    String(m.id) === String(a.userId)
                                );
                                if (already) await refresh({ silent: true });
                                else
                                  setAlert({
                                    open: true,
                                    kind: "negative",
                                    title: "승인 실패",
                                    message:
                                      e?.response?.data?.message ||
                                      "서버 오류로 승인에 실패했습니다. 잠시 후 다시 시도해주세요.",
                                  });
                              } catch {
                                setAlert({
                                  open: true,
                                  kind: "negative",
                                  title: "승인 실패",
                                  message:
                                    e?.response?.data?.message ||
                                    "서버 오류로 승인에 실패했습니다. 잠시 후 다시 시도해주세요.",
                                });
                              }
                            }
                          }}
                          accessibilityLabel="승인"
                        >
                          <Text style={s.approvePillText}>승인</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.rejectPill}
                          onPress={async () => {
                            await rejectRequest(a.id);
                            await refresh({ silent: true });
                          }}
                          accessibilityLabel="거부"
                        >
                          <Text style={s.rejectPillText}>거부</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={s.emptyApplicationState}>
                    <View style={s.emptyIconCircle}>
                      <Ionicons
                        name="people-outline"
                        size={32}
                        color="#D1D5DB"
                      />
                    </View>
                    <Text style={s.emptyApplicationTitle}>
                      새로운 가입 신청이 없습니다
                    </Text>
                    <Text style={s.emptyApplicationDesc}>
                      크루에 가입 신청이 들어오면 여기에 표시됩니다
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={s.membersSection}>
              <Text style={s.sectionTitle}>멤버 목록 ({members.length}명)</Text>
              {members.map((m) => {
                console.log(
                  "[MEMBER_RENDER] Rendering member:",
                  m.nickname,
                  "hasImage:",
                  !!m.profileImage
                );
                const isSelf =
                  (myUserId && String(m.id) === String(myUserId)) ||
                  m.nickname === "나";
                return (
                  <View key={m.id} style={s.memberRow}>
                    <View style={s.memberInfo}>
                      <View style={s.memberAvatarContainer}>
                        {m.profileImage ? (
                          <Image
                            source={{
                              uri: m.profileImage,
                              cache: "force-cache",
                            }}
                            style={s.memberAvatar}
                            resizeMode="cover"
                            onLoad={() =>
                              console.log(
                                "[MEMBER] Image loaded for:",
                                m.nickname
                              )
                            }
                            onError={(e) =>
                              console.log(
                                "[MEMBER] Image error for:",
                                m.nickname,
                                e.nativeEvent.error
                              )
                            }
                          />
                        ) : (
                          <View style={s.memberAvatarPlaceholder}>
                            <Ionicons name="person" size={20} color="#9CA3AF" />
                          </View>
                        )}
                      </View>
                      <View style={s.memberTextInfo}>
                        <Text
                          style={s.memberName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {m.nickname}
                          {m.role === "ADMIN" && (
                            <Text style={s.adminBadge}> 관리자</Text>
                          )}
                        </Text>
                        <Text style={s.memberSub}>
                          최근 러닝: {formatLastRunning(m.lastRunningDate)}
                        </Text>
                      </View>
                    </View>
                    {isAdmin && !isSelf && (
                      <View style={s.actionGroup}>
                        {/* 내보내기 버튼을 왼쪽에 */}
                        {m.role !== "ADMIN" && (
                          <TouchableOpacity
                            style={s.roundIconBtn}
                            onPress={() => {
                              setConfirm({
                                open: true,
                                title: "확인",
                                message: `${m.nickname} 님을 내보낼까요?`,
                                destructive: true,
                                onConfirm: async () => {
                                  try {
                                    await removeMember(crewId, m.id);
                                    // Optimistic UI: 즉시 목록에서 제거
                                    setMembers((prev) =>
                                      prev.filter(
                                        (x) => String(x.id) !== String(m.id)
                                      )
                                    );
                                    // 멤버 수 텍스트 갱신
                                    setCrewInfo((ci) => {
                                      try {
                                        const match = /\d+/.exec(
                                          ci.members || ""
                                        );
                                        const prevCount = match
                                          ? parseInt(match[0])
                                          : members.length;
                                        const nextCount = Math.max(
                                          0,
                                          prevCount - 1
                                        );
                                        return {
                                          ...ci,
                                          members: `멤버 ${nextCount}명`,
                                        } as any;
                                      } catch {
                                        return ci as any;
                                      }
                                    });
                                    setAlert({
                                      open: true,
                                      kind: "positive",
                                      title: "완료",
                                      message: `${m.nickname} 님을 내보냈습니다.`,
                                    });
                                    // 서버 동기화
                                    await refresh({ silent: true });
                                  } catch (e: any) {
                                    const msg =
                                      e?.response?.data?.message ||
                                      e?.message ||
                                      "내보내기에 실패했습니다.";
                                    setAlert({
                                      open: true,
                                      kind: "negative",
                                      title: "오류",
                                      message: msg,
                                    });
                                  }
                                },
                              });
                            }}
                            accessibilityLabel="내보내기"
                          >
                            <Ionicons
                              name="person-remove-outline"
                              size={18}
                              color="#EF4444"
                            />
                          </TouchableOpacity>
                        )}

                        {/* 매니저 임명/해제 아이콘을 그 오른쪽에 */}
                        {m.role !== "ADMIN" ? (
                          <TouchableOpacity
                            style={s.roundIconBtn}
                            onPress={() => {
                              setConfirm({
                                open: true,
                                title: "관리자 임명",
                                message: `${m.nickname} 님을 매니저(관리자)로 임명하시겠습니까?`,
                                destructive: false,
                                onConfirm: async () => {
                                  await promoteMember(crewId, m.id);
                                  await refresh({ silent: true });
                                },
                              });
                            }}
                            accessibilityLabel="관리자 지정"
                          >
                            <Ionicons
                              name="star-outline"
                              size={18}
                              color="#F59E0B"
                            />
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={s.roundIconBtn}
                            onPress={() => {
                              setConfirm({
                                open: true,
                                title: "권한 해제",
                                message: `${m.nickname} 님의 매니저 권한을 해제하시겠습니까?`,
                                destructive: true,
                                onConfirm: async () => {
                                  await demoteMember(crewId, m.id);
                                  await refresh({ silent: true });
                                },
                              });
                            }}
                            accessibilityLabel="권한 해제"
                          >
                            <Ionicons name="star" size={18} color="#6B7280" />
                          </TouchableOpacity>
                        )}

                        {/* 권한 이임(ADMIN일 때만) */}
                        {m.role === "ADMIN" && (
                          <TouchableOpacity
                            style={s.roundIconBtn}
                            onPress={() => {
                              setConfirm({
                                open: true,
                                title: "권한 이임",
                                message: `${m.nickname} 님에게 운영 권한을 이임하시겠습니까?`,
                                destructive: true,
                                onConfirm: async () => {
                                  await transferOwnership(crewId, m.id);
                                  await refresh({ silent: true });
                                },
                              });
                            }}
                            accessibilityLabel="권한 이임"
                          >
                            <Ionicons
                              name="swap-horizontal"
                              size={18}
                              color="#3B82F6"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* 무한 스크롤 로딩 인디케이터 */}
              {loadingMoreMembers && (
                <View style={s.loadingMore}>
                  <ActivityIndicator size="small" color="#4A90E2" />
                  <Text style={s.loadingText}>멤버 목록 불러오는 중...</Text>
                </View>
              )}

              {/* 더 이상 없음 표시 */}
              {!hasMoreMembers && members.length > 0 && (
                <View style={s.endMessage}>
                  <Text style={s.endText}>모든 멤버를 불러왔습니다</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* 설정 탭 내용 */}
        {selectedTab === "설정" && (
          <View style={s.settingsSection}>
            <Text style={s.sectionTitle}>크루 설정</Text>

            {/* 관리자 전용: 크루 정보 관리 */}
            {isAdmin && (
              <TouchableOpacity
                style={s.settingItem}
                onPress={() => {
                  navigation.navigate("CrewEdit" as never, { crewId } as never);
                }}
              >
                <View style={s.settingItemLeft}>
                  <View style={[s.settingIcon, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons
                      name="settings-outline"
                      size={20}
                      color="#4A7FE8"
                    />
                  </View>
                  <Text style={s.settingItemText}>크루 정보 관리</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {isAdmin ? (
              <TouchableOpacity
                style={s.closeCrewBtn}
                onPress={() => {
                  setConfirm({
                    open: true,
                    title: "크루 폐쇄",
                    message:
                      "정말로 크루를 폐쇄하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
                    destructive: true,
                    onConfirm: async () => {
                      await closeCrew(crewId);
                      setAlert({
                        open: true,
                        kind: "positive",
                        title: "완료",
                        message: "크루가 폐쇄되었습니다.",
                      });
                      // 폐쇄 후 뒤로 가기 (크루 목록 화면으로)
                      navigation.goBack();
                    },
                  });
                }}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={s.closeCrewBtnText}>크루 폐쇄</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.closeCrewBtn, { backgroundColor: "#111827" }]}
                onPress={() => {
                  setConfirm({
                    open: true,
                    title: "크루 탈퇴",
                    message: "크루를 탈퇴하시겠습니까?",
                    destructive: true,
                    onConfirm: async () => {
                      try {
                        await leaveCrew(crewId);
                        setAlert({
                          open: true,
                          kind: "positive",
                          title: "완료",
                          message: "크루에서 탈퇴했습니다.",
                        });
                        // 탈퇴 후 뒤로 가기 (크루 목록 화면으로)
                        navigation.goBack();
                      } catch (e: any) {
                        const msg =
                          e?.response?.data?.message ||
                          e?.message ||
                          "잠시 후 다시 시도해주세요.";
                        if (/크루장|OWNER|소유자/.test(String(msg))) {
                          setAlert({
                            open: true,
                            kind: "message",
                            title: "탈퇴 불가",
                            message:
                              "크루장은 바로 탈퇴할 수 없습니다. 멤버에게 소유권을 양도한 뒤 탈퇴하거나, 크루를 폐쇄하세요.",
                          });
                        } else {
                          setAlert({
                            open: true,
                            kind: "negative",
                            title: "탈퇴 실패",
                            message: msg,
                          });
                        }
                      }
                    },
                  });
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#fff" />
                <Text style={s.closeCrewBtnText}>크루 탈퇴</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Alerts rendering
function Alerts({ alert, setAlert, confirm, setConfirm }: any) {
  return (
    <>
      {alert?.open && alert.kind === "positive" && (
        <PositiveAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
      )}
      {alert?.open && alert.kind === "negative" && (
        <NegativeAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
      )}
      {alert?.open && alert.kind === "message" && (
        <MessageAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
      )}
      {confirm?.open &&
        (confirm?.destructive ? (
          <DestructiveConfirm
            visible
            title={confirm.title}
            message={confirm.message}
            onClose={() => setConfirm({ open: false })}
            onCancel={() => setConfirm({ open: false })}
            onConfirm={async () => {
              await confirm.onConfirm?.();
              setConfirm({ open: false });
            }}
          />
        ) : (
          <ConfirmAlert
            visible
            title={confirm.title}
            message={confirm.message}
            onClose={() => setConfirm({ open: false })}
            onCancel={() => setConfirm({ open: false })}
            onConfirm={async () => {
              await confirm.onConfirm?.();
              setConfirm({ open: false });
            }}
          />
        ))}
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  blueHeader: { backgroundColor: "#4A7FE8", paddingTop: 8 },
  headerTime: {
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  searchIcon: { padding: 4 },
  searchIconText: { fontSize: 22 },
  scrollView: { flex: 1 },

  // 크루 정보 카드 - 그리드 스타일과 유사한 화이트 카드
  crewInfoCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  crewHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  crewAvatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    marginBottom: 10,
  },
  crewAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  crewAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  crewName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  countText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  chatBtn: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  statLabel: { fontSize: 12, color: "#6B7280" },

  // 가입 신청
  applicationCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  applicationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  applicationTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  applicationBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: "center",
  },
  applicationBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#F59E0B",
  },
  applicationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 8,
  },
  applicantInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  applicantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  applicantAvatarPlaceholder: {
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  applicantName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },
  applicantLevel: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  applicationBtns: { flexDirection: "row", gap: 8, flexShrink: 0 },
  // pill buttons for approve / reject
  approvePill: {
    backgroundColor: "#10B981",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  approvePillText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  rejectPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectPillText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  // Empty State 스타일
  emptyApplicationState: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#F3F4F6",
  },
  emptyApplicationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyApplicationDesc: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 240,
  },

  // 탭
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#4A7FE8",
  },
  tabText: { fontSize: 15, color: "#9CA3AF", fontWeight: "600" },
  activeTabText: { color: "#4A7FE8", fontWeight: "700" },

  // 통계 섹션
  statsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsSectionTitle: { fontSize: 16, fontWeight: "700", color: "#000" },
  filterButtons: { flexDirection: "row", gap: 8 },
  filterBtn: {
    backgroundColor: "#4A7FE8",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  filterBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  filterBtnInactive: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  filterBtnInactiveText: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  statsCards: { flexDirection: "row", gap: 12 },
  statsCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  statsCardValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#4A7FE8",
    marginBottom: 4,
  },
  statsCardLabel: { fontSize: 12, color: "#6B7280" },

  // MVP 섹션
  mvpSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  mvpGradient: {
    padding: 20,
    position: "relative",
  },
  mvpDecoCircle1: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    top: -30,
    right: -30,
  },
  mvpDecoCircle2: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    bottom: -20,
    left: 20,
  },
  mvpContent: {
    position: "relative",
    zIndex: 1,
  },
  mvpHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  mvpTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mvpEmoji: {
    fontSize: 22,
  },
  mvpTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#78350F",
    letterSpacing: -0.3,
  },
  mvpBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  mvpBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mvpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  mvpAvatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  mvpAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "#FBBF24",
  },
  mvpAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FBBF24",
  },
  crownBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FBBF24",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  crownEmoji: {
    fontSize: 16,
  },
  mvpInfo: {
    flex: 1,
  },
  mvpName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  mvpDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mvpDistance: {
    fontSize: 15,
    color: "#92400E",
    fontWeight: "700",
  },

  // 멤버 섹션
  membersSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  memberInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  memberAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    marginRight: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  memberTextInfo: { flex: 1, flexShrink: 1 },
  memberName: { fontSize: 15, color: "#111827", fontWeight: "500" },
  memberSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  adminBadge: {
    fontSize: 12,
    color: "#F59E0B",
    fontWeight: "700",
  },
  kickBtn: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  kickBtnText: { color: "#111827", fontSize: 13, fontWeight: "600" },
  roundIconBtn: { backgroundColor: "#F3F4F6", padding: 8, borderRadius: 999 },
  actionGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },

  // 설정 섹션
  settingsSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  settingItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  helperText: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },

  // 랭킹 카드
  rankCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  rankHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  rankTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  rankSubtitle: { fontSize: 12, color: "#64748B" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    marginTop: 6,
  },
  rankLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8 },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeTop1: { backgroundColor: "#F59E0B" },
  rankBadgeTop2: { backgroundColor: "#94A3B8" },
  rankBadgeTop3: { backgroundColor: "#EA580C" },
  rankBadgeText: { fontSize: 13, fontWeight: "800", color: "#111827" },
  rankBadgeTextTop: { color: "#fff" },
  rankAvatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  rankAvatar: { width: 28, height: 28, borderRadius: 14 },
  rankAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  rankName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#1F2937" },
  rankRight: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  rankDistance: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  rankUnit: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  closeCrewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    borderRadius: 10,
  },
  closeCrewBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  // 무한 스크롤 관련
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#6B7280",
  },
  endMessage: {
    alignItems: "center",
    paddingVertical: 20,
  },
  endText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
});
