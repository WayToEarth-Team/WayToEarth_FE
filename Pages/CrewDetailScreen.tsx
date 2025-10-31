import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert, ConfirmAlert, DestructiveConfirm } from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
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

  // 멤버 무한 스크롤 상태
  const [memberPage, setMemberPage] = useState(0);
  const [hasMoreMembers, setHasMoreMembers] = useState(true);
  const [loadingMoreMembers, setLoadingMoreMembers] = useState(false);

  const isRefreshingRef = useRef(false);
  const [alert, setAlert] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  const [confirm, setConfirm] = useState<{ open:boolean; title?:string; message?:string; destructive?:boolean; onConfirm?: ()=>void }>({ open:false });

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
        console.log("[CREW_DETAIL] members with profiles:", detail.members.map(m => ({ id: m.id, nick: m.nickname, profile: m.profileImage })));
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
              limit: 1,
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

          console.log('[CREW_DETAIL] Setting crew info:', {
            memberCount,
            active,
            dist
          });

          setCrewInfo({
            members: `멤버 ${memberCount}명`,
            roleLabel: `내 역할 ${detail.role === "ADMIN" ? "관리자" : "멤버"}`,
            totalDistance: formatKm(dist),
            activeMembers: `${active}명`,
          });
          const top = ranking?.[0];
          if (top) {
            // MVP 사용자의 프로필 이미지 로드
            const mvpUserId = top.userId;
            let profileImage: string | null = null;

            if (mvpUserId) {
              // 이미 로드된 멤버 목록에서 프로필 찾기
              const memberInList = detail.members.find(m => String(m.id) === String(mvpUserId));
              if (memberInList?.profileImage) {
                profileImage = memberInList.profileImage;
                console.log('[CREW_DETAIL] MVP profile from member list:', profileImage);
              } else {
                // 폴백: 멤버 목록에 프로필이 없는 경우, 사용자 프로필 API로 조회
                try {
                  const myProfile = await getMyProfile();
                  if (String(myProfile.id) === String(mvpUserId)) {
                    // MVP가 나인 경우
                    profileImage = myProfile.profile_image_url ?? null;
                    console.log('[CREW_DETAIL] MVP is me, using my profile image:', profileImage);
                  } else {
                    // MVP가 다른 사람인 경우
                    const mvpProfile = await getUserProfile(String(mvpUserId));
                    profileImage = mvpProfile.profile_image_url ?? null;
                    console.log('[CREW_DETAIL] MVP profile from user API:', profileImage);
                  }
                } catch (e) {
                  console.warn('[CREW_DETAIL] Failed to load profile:', e);
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
        setAlert({ open:true, kind:'message', title:'내 크루 없음', message:'현재 가입된 크루가 없습니다.' });
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
      const interval = setInterval(() => {
        if (!cancelled) refresh({ silent: true });
      }, selectedTab === "멤버" ? 15000 : 30000);
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
      try { sub.remove(); } catch {}
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
          console.log('[CREW_DETAIL] Setting members (first page):', result.members.length, result.members);
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
    <SafeAreaView style={s.container}>
      <Alerts alert={alert} setAlert={setAlert} confirm={confirm} setConfirm={setConfirm} />
      <StatusBar barStyle="light-content" />

      {/* 헤더 */}
      <View style={[s.blueHeader, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <View style={{ width: 24 }} />
          <Text style={s.headerTitle}>크루</Text>
          <TouchableOpacity
            style={s.searchIcon}
            onPress={() => {
              setAlert({ open:true, kind:'message', title:'채팅 이동', message: crewId ? `크루(${crewName || ""}) 채팅으로 이동 시도` : '크루 정보를 불러오지 못했습니다.' });
              if (!crewId) {
                setAlert({ open:true, kind:'negative', title:'채팅 이동 불가', message:'크루 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' });
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
                  setAlert({ open:true, kind:'negative', title:'채팅 이동 불가', message:'네비게이션 경로를 찾을 수 없습니다.' });
                }
              }
            }}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

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
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
          if (isCloseToBottom && selectedTab === "멤버" && !loadingMoreMembers && hasMoreMembers) {
            loadMoreMembers();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* 크루 정보 카드 */}
        <View style={s.crewInfoCard}>
          <View style={s.crewHeader}>
            <View style={s.crewAvatarContainer}>
              {crewImageUrl ? (
                <Image
                  source={{ uri: crewImageUrl, cache: 'force-cache' }}
                  style={s.crewAvatar}
                  resizeMode="cover"
                  onError={(e) => console.log('[CREW_DETAIL] Crew image error:', e.nativeEvent.error)}
                />
              ) : (
                <View style={s.crewAvatarPlaceholder}>
                  <Ionicons name="people" size={28} color="#fff" />
                </View>
              )}
            </View>
            <View style={s.crewHeaderText}>
              <Text style={s.crewName}>{crewName}</Text>
              <Text style={s.crewSubInfo}>
                {loading ? "로딩 중..." : crewInfo.members || "멤버 0명"}
                {crewInfo.roleLabel ? ` • ${crewInfo.roleLabel}` : ""}
              </Text>
            </View>
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
            {/* 가입 신청 (관리자만) */}
            {isAdmin && pending.length > 0 && (
              <View style={s.applicationCard}>
                <Text style={s.applicationTitle}>가입 신청</Text>
                {pending.map((a) => (
                  <View key={a.id} style={s.applicationRow}>
                    <View style={s.applicantInfo}>
                      {a.profileImage ? (
                        <Image
                          source={{ uri: a.profileImage }}
                          style={s.applicantAvatar}
                        />
                      ) : (
                        <View style={s.applicantAvatar}>
                          <Ionicons name="person" size={20} color="#999" />
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
                            // 500/409 등 재시도 플로우: 상세 재조회 후 이미 멤버라면 성공으로 간주
                            try {
                              const detail = await getMyCrewDetail();
                              const already = detail?.members?.some(m => a.userId && String(m.id) === String(a.userId));
                              if (already) {
                                await refresh({ silent: true });
                              } else {
                                setAlert({ open:true, kind:'negative', title:'승인 실패', message: e?.response?.data?.message || '서버 오류로 승인에 실패했습니다. 잠시 후 다시 시도해주세요.' });
                              }
                            } catch {
                              setAlert({ open:true, kind:'negative', title:'승인 실패', message: e?.response?.data?.message || '서버 오류로 승인에 실패했습니다. 잠시 후 다시 시도해주세요.' });
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
                ))}
              </View>
            )}
            {/* 크루 통계 */}
            <View style={s.statsSection}>
              <View style={s.statsSectionHeader}>
                <Text style={s.statsSectionTitle}>크루 통계</Text>
                <View style={s.filterButtons}>
                  <TouchableOpacity style={s.filterBtn}>
                    <Text style={s.filterBtnText}>주간</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.filterBtnInactive}>
                    <Text style={s.filterBtnInactiveText}>월간</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 월간 요약을 추가 카드로 확장하려면 여기서 확장 */}
            </View>

            {/* MVP 섹션 */}
            {mvpMember && (
              <View style={s.mvpSection}>
                <View style={s.mvpHeader}>
                  <Text style={s.mvpTitle}>🏆 이번 주 MVP</Text>
                  <Text style={s.mvpDate}>3월 18일 - 3월 24일</Text>
                </View>
                <View style={s.mvpCard}>
                  <View style={s.mvpAvatarContainer}>
                    {mvpMember.profileImage ? (
                      <Image
                        source={{ uri: mvpMember.profileImage, cache: 'force-cache' }}
                        style={s.mvpAvatar}
                        resizeMode="cover"
                        onError={(e) => console.log('[CREW_DETAIL] MVP image error:', e.nativeEvent.error)}
                      />
                    ) : (
                      <View style={s.mvpAvatarPlaceholder}>
                        <Ionicons name="person" size={24} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={s.mvpInfo}>
                    <Text style={s.mvpName}>{mvpMember.name}</Text>
                    <Text style={s.mvpDistance}>
                      월간 거리: {mvpMember.distance}
                    </Text>
                  </View>
                  <View style={s.mvpBadge}>
                    <Text style={s.mvpBadgeText}>MVP</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* 멤버 탭 내용 */}
        {selectedTab === "멤버" && (
          <View style={s.membersSection}>
            <Text style={s.sectionTitle}>멤버 목록 ({members.length}명)</Text>
            {members.map((m) => {
              console.log('[MEMBER_RENDER] Rendering member:', m.nickname, 'hasImage:', !!m.profileImage);
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
                            cache: 'force-cache'
                          }}
                          style={s.memberAvatar}
                          resizeMode="cover"
                          onLoad={() => console.log('[MEMBER] Image loaded for:', m.nickname)}
                          onError={(e) => console.log('[MEMBER] Image error for:', m.nickname, e.nativeEvent.error)}
                        />
                      ) : (
                        <View style={s.memberAvatarPlaceholder}>
                          <Ionicons name="person" size={20} color="#9CA3AF" />
                        </View>
                      )}
                    </View>
                    <View style={s.memberTextInfo}>
                      <Text style={s.memberName}>
                        {m.nickname}
                        {m.role === "ADMIN" && <Text style={s.adminBadge}> 관리자</Text>}
                      </Text>
                      <Text style={s.memberSub}>
                        최근 러닝: {formatLastRunning(m.lastRunningDate)}
                      </Text>
                    </View>
                  </View>
                  {isAdmin && !isSelf && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {m.role !== "ADMIN" ? (
                        <TouchableOpacity
                          style={s.roundIconBtn}
                          onPress={() => {
                            setConfirm({
                              open: true,
                              title: '관리자 임명',
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
                              title: '권한 해제',
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
                      {m.role === "ADMIN" && (
                        <TouchableOpacity
                          style={s.roundIconBtn}
                          onPress={() => {
                            setConfirm({
                              open: true,
                              title: '권한 이임',
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
                      {m.role !== "ADMIN" && (
                        <TouchableOpacity
                          style={s.roundIconBtn}
                          onPress={() => {
                            setConfirm({
                              open: true,
                              title: '확인',
                              message: `${m.nickname} 님을 내보낼까요?`,
                              destructive: true,
                              onConfirm: async () => {
                                await removeMember(crewId, m.id);
                                await refresh({ silent: true });
                              },
                            });
                          }}
                          accessibilityLabel="내보내기"
                        >
                          <Ionicons
                            name="person-remove"
                            size={18}
                            color="#EF4444"
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
                    <Ionicons name="settings-outline" size={20} color="#4A7FE8" />
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
                    title: '크루 폐쇄',
                    message: '정말로 크루를 폐쇄하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                    destructive: true,
                    onConfirm: async () => {
                      await closeCrew(crewId);
                      setAlert({ open:true, kind:'positive', title:'완료', message:'크루가 폐쇄되었습니다.' });
                      navigation.navigate("Crew" as never);
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
                    title: '크루 탈퇴',
                    message: '크루를 탈퇴하시겠습니까?',
                    destructive: true,
                    onConfirm: async () => {
                      try {
                        await leaveCrew(crewId);
                        setAlert({ open:true, kind:'positive', title:'완료', message:'크루에서 탈퇴했습니다.' });
                        navigation.navigate("Crew" as never);
                      } catch (e: any) {
                        const msg = e?.response?.data?.message || e?.message || '잠시 후 다시 시도해주세요.';
                        if (/크루장|OWNER|소유자/.test(String(msg))) {
                          setAlert({ open:true, kind:'message', title:'탈퇴 불가', message:'크루장은 바로 탈퇴할 수 없습니다. 멤버에게 소유권을 양도한 뒤 탈퇴하거나, 크루를 폐쇄하세요.' });
                        } else {
                          setAlert({ open:true, kind:'negative', title:'탈퇴 실패', message: msg });
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
      {alert?.open && alert.kind === 'positive' && (
        <PositiveAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert?.open && alert.kind === 'negative' && (
        <NegativeAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert?.open && alert.kind === 'message' && (
        <MessageAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {confirm?.open && (confirm?.destructive ? (
        <DestructiveConfirm
          visible
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm({ open:false })}
          onCancel={() => setConfirm({ open:false })}
          onConfirm={async () => { await confirm.onConfirm?.(); setConfirm({ open:false }); }}
        />
      ) : (
        <ConfirmAlert
          visible
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm({ open:false })}
          onCancel={() => setConfirm({ open:false })}
          onConfirm={async () => { await confirm.onConfirm?.(); setConfirm({ open:false }); }}
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

  // 크루 정보 카드
  crewInfoCard: {
    backgroundColor: "#5B8FEE",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
  },
  crewHeader: { flexDirection: "row", marginBottom: 20 },
  crewAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    marginRight: 12,
  },
  crewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  crewAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  crewHeaderText: { flex: 1, justifyContent: "center" },
  crewName: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 4 },
  crewSubInfo: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)" },

  // 가입 신청
  applicationCard: {
    backgroundColor: "#FFF8E1",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
    marginBottom: 12,
  },
  applicationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  applicantInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  applicantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFB4B4",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  applicantName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 2,
  },
  applicantLevel: { fontSize: 12, color: "#666" },
  applicationBtns: { flexDirection: "row", gap: 8 },
  // pill buttons for approve / reject
  approvePill: {
    backgroundColor: "#22C55E",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  approvePillText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rejectPill: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rejectPillText: { color: "#fff", fontSize: 13, fontWeight: "700" },

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
    backgroundColor: "#3A3A3A",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  mvpHeader: { marginBottom: 16 },
  mvpTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 4 },
  mvpDate: { fontSize: 12, color: "#9CA3AF" },
  mvpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4A4A4A",
    padding: 12,
    borderRadius: 12,
  },
  mvpAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    marginRight: 12,
  },
  mvpAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  mvpAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#6B7280",
    justifyContent: "center",
    alignItems: "center",
  },
  mvpInfo: { flex: 1 },
  mvpName: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 4 },
  mvpDistance: { fontSize: 13, color: "#9CA3AF" },
  mvpBadge: {
    backgroundColor: "#6B7280",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  mvpBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

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
  memberInfo: { flexDirection: "row", alignItems: "center" },
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
  memberTextInfo: {
    flex: 1,
  },
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
