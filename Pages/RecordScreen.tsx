import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  PositiveAlert,
  NegativeAlert,
  MessageAlert,
} from "../components/ui/AlertDialog";
import { Dimensions } from "react-native";
import {
  getWeeklyStats,
  listRunningRecords,
  getRunningRecordDetail,
} from "../utils/api/running";
import { getMyProfile } from "../utils/api/users";
import { client } from "../utils/api/client";
import MapView, { Polyline } from "react-native-maps";

export default function RecordScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState<any | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");
  // 서버에 저장되어 있는 주간 목표(취소 시 복원 용도)
  const [savedWeeklyGoal, setSavedWeeklyGoal] = useState<string>("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [totalRunningCount, setTotalRunningCount] = useState<number>(0);
  const [records, setRecords] = useState<any[]>([]);
  const [pageSize] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [dialog, setDialog] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    kind?: "positive" | "negative" | "message";
  }>({ open: false, kind: "message" });
  const width = Dimensions.get("window").width;
  const [previews, setPreviews] = useState<
    Record<number, { coords: { latitude: number; longitude: number }[] }>
  >({});

  useEffect(() => {
    (async () => {
      try {
        const [w, r, me] = await Promise.all([
          getWeeklyStats(),
          listRunningRecords(pageSize, 0),
          getMyProfile(),
        ]);
        console.log("[RecordScreen] Weekly stats:", w);
        const first = Array.isArray(r) ? r : [];
        console.log("[RecordScreen] Records:", first);
        if (first.length > 0) {
          console.log("[RecordScreen] First record:", first[0]);
        }
        setWeekly(w ?? null);
        setRecords(first);
        setOffset(first.length);
        setHasMore(first.length === pageSize);

        // Load weekly goal and total running count from profile
        const v = (me as any)?.weekly_goal_distance;
        const goalStr = v != null && !Number.isNaN(Number(v)) ? String(v) : "";
        setWeeklyGoal(goalStr);
        setSavedWeeklyGoal(goalStr);
        setTotalRunningCount((me as any)?.total_running_count ?? 0);
      } catch (e) {
        console.warn(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 미니맵 프리뷰 로드 (상위 5개만 우선)
  useEffect(() => {
    (async () => {
      try {
        const ids = records
          .slice(0, 5)
          .map((r: any) => r.id)
          .filter(Boolean);
        await Promise.all(
          ids.map(async (id) => {
            if (previews[id]) return;
            try {
              const d = await getRunningRecordDetail(id);
              const raw = (d.routePoints || []).map((p: any) => ({
                latitude: p.latitude,
                longitude: p.longitude,
              }));
              const isFiniteNum = (v: any) =>
                typeof v === "number" && isFinite(v);
              const isValidLatLng = (lat: number, lng: number) =>
                isFiniteNum(lat) &&
                isFiniteNum(lng) &&
                Math.abs(lat) <= 90 &&
                Math.abs(lng) <= 180 &&
                !(lat === 0 && lng === 0);
              const pts = raw.filter((p) =>
                isValidLatLng(p.latitude, p.longitude)
              );
              if (pts.length)
                setPreviews((prev) => ({ ...prev, [id]: { coords: pts } }));
            } catch {}
          })
        );
      } catch {}
    })();
  }, [records]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || isNaN(seconds)) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 이번 주 러닝 횟수 계산 (records에서 직접 계산)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0(일) ~ 6(토)
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // 월요일로 설정
  monday.setHours(0, 0, 0, 0);

  const weeklyRunCount = records.filter((r) => {
    if (!r.startedAt) return false;
    const recordDate = new Date(r.startedAt);
    return recordDate >= monday;
  }).length;

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8, color: "#6b7280" }}>불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const saveWeeklyGoal = async () => {
    if (savingGoal) return;
    try {
      setSavingGoal(true);
      const weeklyGoalNumber =
        weeklyGoal?.trim() === "" ? undefined : Number(weeklyGoal);

      // 커스텀 검증: 1000km 이상 설정 시 사용자 친화 메시지 출력 후 중단
      if (
        typeof weeklyGoalNumber === "number" &&
        !Number.isNaN(weeklyGoalNumber) &&
        weeklyGoalNumber >= 1000
      ) {
        setDialog({
          open: true,
          kind: "negative",
          title: "입력 오류",
          message: "주간목표에 맞는 키로수를 설정해주세요",
        });
        return;
      }

      const payload = {
        weekly_goal_distance:
          typeof weeklyGoalNumber === "number" &&
          !Number.isNaN(weeklyGoalNumber)
            ? weeklyGoalNumber
            : undefined,
      };

      await client.put("/v1/users/me", payload);
      setDialog({
        open: true,
        kind: "positive",
        title: "완료",
        message: "주간 목표가 저장되었습니다.",
      });
      setIsEditingGoal(false);
      // 저장 성공 시 기준값 갱신 (취소 복원 지점 업데이트)
      setSavedWeeklyGoal(
        typeof weeklyGoalNumber === "number" && !Number.isNaN(weeklyGoalNumber)
          ? String(weeklyGoalNumber)
          : ""
      );
      // 강제 리렌더링(그래프/요약 등 의존 뷰가 즉시 반영되도록)
      setWeekly((prev: any) => (prev ? { ...prev } : prev));
    } catch (e: any) {
      const status = e?.response?.status as number | undefined;
      const data = e?.response?.data || {};
      const errObj = (data as any)?.error || {};
      const details: string = errObj?.details || (data as any)?.details || "";
      const rawMsg: string = errObj?.message || (data as any)?.message || e?.message || "";
      const code: string = (errObj?.code || (data as any)?.code || "").toString();

      // 백엔드 검증 메시지 해석 → 사용자 친화 문구로 변환
      let message = rawMsg || "주간 목표 저장에 실패했습니다.";
      const toManyWeeklyGoalMsg = "주간목표에 맞는 키로수를 설정해주세요";
      if (
        status === 400 && (
          /INVALID_PARAMETER/i.test(code) ||
          /weeklyGoalDistance/i.test(details) ||
          /weekly|goal|distance|주간|목표/i.test(rawMsg) ||
          /less than or equal to 999\.99|out of range|too large|max/i.test(details)
        )
      ) {
        message = toManyWeeklyGoalMsg;
      }
      setDialog({ open: true, kind: "negative", title: "입력 오류", message });
    } finally {
      setSavingGoal(false);
    }
  };

  // 스크롤 하단 감지
  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: any) => {
    return (
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
    );
  };

  // 추가 레코드 로드
  const loadMoreRecords = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const more = await listRunningRecords(pageSize, offset);
      const moreArr = Array.isArray(more) ? more : [];
      setRecords((prev) => [...prev, ...moreArr]);
      setOffset((prev) => prev + moreArr.length);
      setHasMore(moreArr.length === pageSize);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const WeeklyChart = ({ weekly }: { weekly: any }) => {
    const dailyDistances: Array<{ day: string; distance: number }> =
      weekly?.dailyDistances || [];
    const chartHeight = 140;
    const barWidth = Math.floor((width - 80) / 7);

    if (!dailyDistances.length) {
      return (
        <View style={s.card}>
          <Text style={s.dim}>주간 거리 데이터가 없습니다</Text>
        </View>
      );
    }

    const distances = dailyDistances.map((d) => d?.distance ?? 0);
    const weekMax = Math.max(...distances, 0.1);
    const maxDistance = Math.max(weekMax * 1.05, 1);

    const dayLabel = (d: string) => {
      const map: any = {
        MONDAY: "월",
        TUESDAY: "화",
        WEDNESDAY: "수",
        THURSDAY: "목",
        FRIDAY: "금",
        SATURDAY: "토",
        SUNDAY: "일",
      };
      return map[d] ?? d?.slice?.(0, 1) ?? "";
    };

    const todayIndex = new Date().getDay(); // 0=Sun

    return (
      <View style={[s.card, { padding: 16 }]}>
        <Text style={{ fontWeight: "700", marginBottom: 12 }}>
          주간 러닝 거리
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: chartHeight,
          }}
        >
          {dailyDistances.map((item, idx) => {
            const distance =
              typeof item?.distance === "number" ? item.distance : 0;
            const h = Math.max((distance / maxDistance) * chartHeight, 2);
            const isToday = (idx + 1) % 7 === todayIndex; // 서버 순서에 따라 조정 가능
            const isFull = distance >= weekMax * 0.95 && distance > 0;
            return (
              <View key={idx} style={{ flex: 1, alignItems: "center" }}>
                <View
                  style={{
                    justifyContent: "flex-end",
                    height: chartHeight,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      height: h,
                      width: barWidth - 10,
                      borderRadius: 6,
                      backgroundColor: isFull
                        ? "#059669"
                        : isToday
                        ? "#22c55e"
                        : distance > 0
                        ? "#10b981"
                        : "#e5e7eb",
                    }}
                  />
                </View>
                <Text
                  style={{ fontSize: 12, color: isToday ? "#22c55e" : "#666" }}
                >
                  {dayLabel(item?.day || "")}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: distance > 0 ? "#333" : "#b3b3b3",
                  }}
                >
                  {distance > 0 ? distance.toFixed(1) : "0"}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
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
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        onScroll={({ nativeEvent }) => {
          if (!loadingMore && hasMore && isCloseToBottom(nativeEvent)) {
            loadMoreRecords();
          }
        }}
        scrollEventThrottle={200}
      >
        {/* 주간 러닝 차트 - 상단 배치 */}
        <Text style={s.sectionTitle}>이번 주 러닝</Text>
        {weekly ? (
          <>
            <WeeklyChart weekly={weekly} />

            {/* 주간 통계 3종 */}
            <View style={s.statsCard}>
              <View style={s.row3}>
                <View style={s.col}>
                  <Text style={s.v}>
                    {(weekly.totalDistance ?? 0).toFixed(1)}
                  </Text>
                  <Text style={s.k}>거리(km)</Text>
                </View>
                <View style={s.col}>
                  <Text style={s.v}>
                    {formatDuration(weekly.totalDuration ?? 0)}
                  </Text>
                  <Text style={s.k}>시간</Text>
                </View>
                <View style={s.col}>
                  <Text style={s.v}>{weekly.averagePace ?? "-:-"}</Text>
                  <Text style={s.k}>평균 페이스</Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>아직 이번 주 러닝 기록이 없어요</Text>
          </View>
        )}

        {/* 주간 목표 카드 - 간결하게 재디자인 */}
        <View style={s.goalCardCompact}>
          {isEditingGoal ? (
            <>
              <Text style={s.goalTitleCompact}>주간 목표 설정</Text>
              <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
                <View style={[s.input, { flex: 1 }]}>
                  <TextInput
                    style={{ fontSize: 16, color: "#111", paddingVertical: 8 }}
                    placeholder="예) 25"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    value={weeklyGoal}
                    onChangeText={(v) =>
                      setWeeklyGoal((v || "").replace(/[^\d]/g, ""))
                    }
                  />
                </View>
                <TouchableOpacity
                  onPress={saveWeeklyGoal}
                  disabled={savingGoal}
                  style={[s.saveButton, savingGoal && { opacity: 0.6 }]}
                >
                  <Text style={s.saveButtonText}>
                    {savingGoal ? "저장중" : "저장"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    // 취소 시 입력값 되돌리고 편집 종료
                    setWeeklyGoal(savedWeeklyGoal);
                    setIsEditingGoal(false);
                  }}
                  style={s.cancelButton}
                >
                  <Text style={s.cancelButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={s.goalCompactHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.goalLabelCompact}>주간 목표</Text>
                  <Text style={s.goalValueCompact}>
                    {savedWeeklyGoal ? `${savedWeeklyGoal} km` : "목표 미설정"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    // 편집 시작 시 서버 기준값으로 입력값 초기화
                    setWeeklyGoal(savedWeeklyGoal);
                    setIsEditingGoal(true);
                  }}
                  style={s.editButton}
                >
                  <Text style={s.editButtonText}>설정</Text>
                </TouchableOpacity>
              </View>

              {savedWeeklyGoal && Number(savedWeeklyGoal) > 0 && (
                <>
                  <View style={s.progressBarCompact}>
                    <View
                      style={[
                        s.progressFillCompact,
                        {
                          width: `${Math.min(
                            ((weekly?.totalDistance ?? 0) /
                              Number(savedWeeklyGoal)) *
                              100,
                            100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                  <View style={s.progressInfoRow}>
                    <Text style={s.progressInfo}>
                      {(weekly?.totalDistance ?? 0).toFixed(1)} / {savedWeeklyGoal}{" "}
                      km
                    </Text>
                    <Text style={s.progressPercent}>
                      {Math.round(
                        ((weekly?.totalDistance ?? 0) / Number(savedWeeklyGoal)) *
                          100
                      )}
                      % 달성
                    </Text>
                  </View>
                </>
              )}

              {/* 러닝 통계 */}
              <View style={s.runningStats}>
                <View style={s.statItem}>
                  <Text style={s.statValue}>{totalRunningCount}</Text>
                  <Text style={s.statLabel}>총 러닝</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statValue}>{weeklyRunCount}</Text>
                  <Text style={s.statLabel}>이번 주</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* AI 분석 섹션 */}
        {records.length >= 5 && (
          <TouchableOpacity
            style={s.aiSectionCard}
            onPress={() =>
              navigation.navigate("AIFeedbackScreen", {
                completedCount: records.length,
                latestRecordId: records[0]?.id,
              })
            }
          >
            <View style={s.aiSectionHeader}>
              <View style={s.aiIconContainer}>
                <Text style={s.aiIcon}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aiSectionTitle}>웨이 AI 코치 분석</Text>
                <Text style={s.aiSectionDesc}>
                  최근 10개 러닝 기록을 분석한 맞춤형 피드백
                </Text>
              </View>
              <Text style={s.aiSectionArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {records.length > 0 && records.length < 5 && (
          <View style={s.aiInfoCard}>
            <View style={s.aiInfoHeader}>
              <Text style={s.aiInfoIcon}>💡</Text>
              <Text style={s.aiInfoTitle}>AI 분석 준비중</Text>
            </View>
            <Text style={s.aiInfoText}>
              AI 분석은 5개 이상 러닝 완료 시 이용 가능해요
            </Text>
            <View style={s.aiProgressBar}>
              <View
                style={[
                  s.aiProgressFill,
                  { width: `${(records.length / 5) * 100}%` },
                ]}
              />
            </View>
            <Text style={s.aiProgressText}>
              {records.length}/5 완료 · {5 - records.length}개 더 필요해요
            </Text>
          </View>
        )}

        <Text style={[s.h1, { marginTop: 20 }]}>운동 기록</Text>
        {records.length === 0 ? (
          <View style={s.card}>
            <Text style={[s.dim, { textAlign: "center" }]}>
              최근 운동 기록이 없습니다
            </Text>
          </View>
        ) : (
          records.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={s.item}
              onPress={() =>
                navigation.navigate("RecordDetailScreen", {
                  recordId: r.id,
                })
              }
            >
              <View
                style={{
                  width: 72,
                  height: 72,
                  marginRight: 12,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: "#F3F4F6",
                }}
              >
                {previews[r.id]?.coords?.length ? (
                  <MapView
                    pointerEvents="none"
                    style={{ flex: 1 }}
                    initialRegion={{
                      latitude: previews[r.id].coords[0].latitude,
                      longitude: previews[r.id].coords[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Polyline
                      coordinates={previews[r.id].coords}
                      strokeColor="#2563eb"
                      strokeWidth={3}
                    />
                  </MapView>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={s.itemTitle}>{r.title || "러닝 기록"}</Text>
                  {r?.runningType ? (
                    <View
                      style={[
                        s.badge,
                        r.runningType === "JOURNEY"
                          ? s.badgeJourney
                          : s.badgeSingle,
                      ]}
                    >
                      <Text style={s.badgeText}>
                        {r.runningType === "JOURNEY" ? "여정" : "일반러닝"}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.itemSub}>
                  {(r.distanceKm ?? 0).toFixed(2)}km ·{" "}
                  {formatDuration(r.durationSeconds)} · {r.calories ?? 0}
                  kcal
                </Text>
              </View>
              <Text style={{ color: "#9CA3AF" }}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 18, fontWeight: "700" },
  dim: { color: "#6b7280" },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  statsCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
  row3: { flexDirection: "row" },
  col: { flex: 1, alignItems: "center" },
  v: { fontSize: 18, fontWeight: "800", color: "#111" },
  k: { color: "#6b7280", marginTop: 4, fontSize: 12 },
  item: {
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  itemTitle: { fontWeight: "700", color: "#111" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  badgeSingle: { backgroundColor: "#10b981" },
  badgeJourney: { backgroundColor: "#7c3aed" },
  itemSub: { color: "#6b7280", marginTop: 4 },
  input: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  // AI 분석 섹션 카드
  aiSectionCard: {
    marginTop: 16,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  aiSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiIcon: {
    fontSize: 24,
  },
  aiSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  aiSectionDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  aiSectionArrow: {
    fontSize: 20,
    color: "rgba(255,255,255,0.5)",
  },
  // AI 준비중 카드
  aiInfoCard: {
    marginTop: 16,
    backgroundColor: "#F0F9FF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  aiInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  aiInfoIcon: {
    fontSize: 20,
  },
  aiInfoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E3A8A",
  },
  aiInfoText: {
    fontSize: 13,
    color: "#1E40AF",
    marginBottom: 12,
  },
  aiProgressBar: {
    height: 8,
    backgroundColor: "#BFDBFE",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  aiProgressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 4,
  },
  aiProgressText: {
    fontSize: 12,
    color: "#1E40AF",
    fontWeight: "600",
  },
  // 간결한 목표 카드
  goalCardCompact: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  goalCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  goalLabelCompact: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  goalValueCompact: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111",
  },
  goalTitleCompact: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  editButton: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#111",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  progressBarCompact: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFillCompact: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  progressInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressInfo: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 13,
    color: "#10b981",
    fontWeight: "700",
  },
  runningStats: {
    flexDirection: "row",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E7EB",
  },
});
