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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState<any | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");
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

  useEffect(() => {
    (async () => {
      try {
        const ids = records.map((r: any) => r.id).filter(Boolean);
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

  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const weeklyRunCount = records.filter((r) => {
    if (!r.startedAt) return false;
    const recordDate = new Date(r.startedAt);
    return recordDate >= monday;
  }).length;

  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 12, color: "#64748b", fontSize: 15 }}>
            불러오는 중...
          </Text>
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
      setSavedWeeklyGoal(
        typeof weeklyGoalNumber === "number" && !Number.isNaN(weeklyGoalNumber)
          ? String(weeklyGoalNumber)
          : ""
      );
      setWeekly((prev: any) => (prev ? { ...prev } : prev));
    } catch (e: any) {
      const status = e?.response?.status as number | undefined;
      const data = e?.response?.data || {};
      const errObj = (data as any)?.error || {};
      const details: string = errObj?.details || (data as any)?.details || "";
      const rawMsg: string =
        errObj?.message || (data as any)?.message || e?.message || "";
      const code: string = (
        errObj?.code ||
        (data as any)?.code ||
        ""
      ).toString();

      let message = rawMsg || "주간 목표 저장에 실패했습니다.";
      const toManyWeeklyGoalMsg = "주간목표에 맞는 키로수를 설정해주세요";
      if (
        status === 400 &&
        (/INVALID_PARAMETER/i.test(code) ||
          /weeklyGoalDistance/i.test(details) ||
          /weekly|goal|distance|주간|목표/i.test(rawMsg) ||
          /less than or equal to 999\.99|out of range|too large|max/i.test(
            details
          ))
      ) {
        message = toManyWeeklyGoalMsg;
      }
      setDialog({ open: true, kind: "negative", title: "입력 오류", message });
    } finally {
      setSavingGoal(false);
    }
  };

  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: any) => {
    return (
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
    );
  };

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
        <View style={s.emptyChartCard}>
          <MaterialCommunityIcons name="chart-bar" size={48} color="#cbd5e1" />
          <Text style={s.emptyChartText}>주간 거리 데이터가 없습니다</Text>
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

    const todayIndex = new Date().getDay();

    return (
      <View style={s.chartCard}>
        <View style={s.chartHeader}>
          <MaterialCommunityIcons name="chart-line" size={20} color="#667eea" />
          <Text style={s.chartTitle}>주간 러닝 거리</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            height: chartHeight,
            marginTop: 16,
          }}
        >
          {dailyDistances.map((item, idx) => {
            const distance =
              typeof item?.distance === "number" ? item.distance : 0;
            const h = Math.max((distance / maxDistance) * chartHeight, 2);
            const isToday = (idx + 1) % 7 === todayIndex;
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
                      borderRadius: 8,
                      backgroundColor: isFull
                        ? "#10b981"
                        : isToday
                        ? "#667eea"
                        : distance > 0
                        ? "#a5b4fc"
                        : "#e2e8f0",
                    }}
                  />
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: isToday ? "#667eea" : "#64748b",
                  }}
                >
                  {dayLabel(item?.day || "")}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: distance > 0 ? "#1e293b" : "#cbd5e1",
                    marginTop: 2,
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
    <SafeAreaView edges={["top", "bottom"]} style={s.root}>
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
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32 + Math.max(insets.bottom, 0),
        }}
        onScroll={({ nativeEvent }) => {
          if (!loadingMore && hasMore && isCloseToBottom(nativeEvent)) {
            loadMoreRecords();
          }
        }}
        scrollEventThrottle={200}
      >
        {/* 헤더 섹션 */}
        <View style={s.headerSection}>
          <Text style={s.mainTitle}>러닝 기록</Text>
          <Text style={s.mainSubtitle}>이번 주 활동을 확인하세요</Text>
        </View>

        {/* 주간 목표 카드 */}
        <View style={s.goalCard}>
          {isEditingGoal ? (
            <>
              <View style={s.goalEditHeader}>
                <Ionicons name="flag" size={20} color="#667eea" />
                <Text style={s.goalEditTitle}>주간 목표 설정</Text>
              </View>
              <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
                <View style={[s.input, { flex: 1 }]}>
                  <TextInput
                    style={{
                      fontSize: 16,
                      color: "#1e293b",
                      paddingVertical: 12,
                    }}
                    placeholder="예) 25"
                    placeholderTextColor="#94a3b8"
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
                  <Ionicons name="checkmark" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setWeeklyGoal(savedWeeklyGoal);
                    setIsEditingGoal(false);
                  }}
                  style={s.cancelButton}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={s.goalHeader}>
                <View style={s.goalIconContainer}>
                  <Ionicons name="flag" size={20} color="#667eea" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.goalLabel}>이번 주 목표</Text>
                  <Text style={s.goalValue}>
                    {savedWeeklyGoal ? `${savedWeeklyGoal} km` : "목표 미설정"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setWeeklyGoal(savedWeeklyGoal);
                    setIsEditingGoal(true);
                  }}
                  style={s.editButton}
                >
                  <Ionicons name="create-outline" size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {savedWeeklyGoal && Number(savedWeeklyGoal) > 0 && (
                <>
                  <View style={s.progressContainer}>
                    <View style={s.progressBar}>
                      <View
                        style={[
                          s.progressFill,
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
                    <View style={s.progressInfo}>
                      <Text style={s.progressText}>
                        {(weekly?.totalDistance ?? 0).toFixed(1)} km
                      </Text>
                      <Text style={s.progressPercent}>
                        {Math.round(
                          ((weekly?.totalDistance ?? 0) /
                            Number(savedWeeklyGoal)) *
                            100
                        )}
                        %
                      </Text>
                    </View>
                  </View>
                </>
              )}

              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <MaterialCommunityIcons
                    name="run"
                    size={24}
                    color="#667eea"
                  />
                  <Text style={s.statValue}>{totalRunningCount}</Text>
                  <Text style={s.statLabel}>총 러닝</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statBox}>
                  <Ionicons name="calendar" size={24} color="#10b981" />
                  <Text style={s.statValue}>{weeklyRunCount}</Text>
                  <Text style={s.statLabel}>이번 주</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 주간 차트 */}
        {weekly ? (
          <>
            <WeeklyChart weekly={weekly} />

            {/* 주간 통계 */}
            <View style={s.statsCard}>
              <View style={s.statItem}>
                <MaterialCommunityIcons
                  name="map-marker-distance"
                  size={28}
                  color="#667eea"
                />
                <Text style={s.statItemValue}>
                  {(weekly.totalDistance ?? 0).toFixed(1)}
                </Text>
                <Text style={s.statItemLabel}>거리 (km)</Text>
              </View>
              <View style={s.statItem}>
                <Ionicons name="time-outline" size={28} color="#10b981" />
                <Text style={s.statItemValue}>
                  {formatDuration(weekly.totalDuration ?? 0)}
                </Text>
                <Text style={s.statItemLabel}>시간</Text>
              </View>
              <View style={s.statItem}>
                <MaterialCommunityIcons
                  name="speedometer"
                  size={28}
                  color="#f59e0b"
                />
                <Text style={s.statItemValue}>
                  {weekly.averagePace ?? "-:-"}
                </Text>
                <Text style={s.statItemLabel}>평균 페이스</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={s.emptyCard}>
            <MaterialCommunityIcons name="run-fast" size={64} color="#cbd5e1" />
            <Text style={s.emptyText}>아직 이번 주 러닝 기록이 없어요</Text>
            <Text style={s.emptySubtext}>첫 러닝을 시작해보세요!</Text>
          </View>
        )}

        {/* AI 분석 섹션 */}
        {records.length >= 5 && (
          <TouchableOpacity
            style={s.aiCard}
            onPress={() =>
              navigation.navigate("AIFeedbackScreen", {
                completedCount: records.length,
                latestRecordId: records[0]?.id,
              })
            }
          >
            <View style={s.aiCardContent}>
              <View style={s.aiIconBox}>
                <Ionicons name="sparkles" size={24} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.aiTitle}>웨이 AI 코치 분석</Text>
                <Text style={s.aiSubtitle}>
                  최근 10개 러닝 기록 기반 맞춤 피드백
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#cbd5e1" />
            </View>
          </TouchableOpacity>
        )}

        {records.length > 0 && records.length < 5 && (
          <View style={s.aiWaitCard}>
            <View style={s.aiWaitHeader}>
              <View style={s.aiWaitIconBox}>
                <Ionicons name="bulb-outline" size={24} color="#f59e0b" />
              </View>
              <Text style={s.aiWaitTitle}>AI 분석 준비중</Text>
            </View>
            <Text style={s.aiWaitText}>
              5개 이상 러닝 완료 시 AI 분석을 이용할 수 있어요
            </Text>
            <View style={s.aiWaitProgress}>
              <View
                style={[
                  s.aiWaitProgressFill,
                  { width: `${(records.length / 5) * 100}%` },
                ]}
              />
            </View>
            <Text style={s.aiWaitProgressText}>
              {records.length}/5 완료 · {5 - records.length}개 더 필요해요
            </Text>
          </View>
        )}

        {/* 운동 기록 리스트 */}
        <View style={s.recordsSection}>
          <View style={s.recordsHeader}>
            <Text style={s.recordsTitle}>운동 기록</Text>
            {records.length > 0 && (
              <Text style={s.recordsCount}>{records.length}개</Text>
            )}
          </View>

          {records.length === 0 ? (
            <View style={s.emptyRecords}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={64}
                color="#cbd5e1"
              />
              <Text style={s.emptyRecordsText}>최근 운동 기록이 없습니다</Text>
              <Text style={s.emptyRecordsSubtext}>
                러닝을 시작하고 기록을 남겨보세요
              </Text>
            </View>
          ) : (
            records.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={s.recordItem}
                onPress={() =>
                  navigation.navigate("RecordDetailScreen", {
                    recordId: r.id,
                  })
                }
                activeOpacity={0.7}
              >
                <View style={s.mapPreview}>
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
                        strokeColor="#667eea"
                        strokeWidth={3}
                      />
                    </MapView>
                  ) : (
                    <View style={s.mapPlaceholder}>
                      <Ionicons name="map-outline" size={32} color="#cbd5e1" />
                    </View>
                  )}
                </View>
                <View style={s.recordContent}>
                  <View style={s.recordTop}>
                    <Text style={s.recordTitle}>{r.title || "러닝 기록"}</Text>
                    {r?.runningType && (
                      <View
                        style={[
                          s.badge,
                          r.runningType === "JOURNEY"
                            ? s.badgeJourney
                            : s.badgeSingle,
                        ]}
                      >
                        <Text style={s.badgeText}>
                          {r.runningType === "JOURNEY" ? "여정" : "일반"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={s.recordStats}>
                    <View style={s.recordStat}>
                      <Ionicons
                        name="navigate"
                        size={14}
                        color="#64748b"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={s.recordStatText}>
                        {(r.distanceKm ?? 0).toFixed(2)} km
                      </Text>
                    </View>
                    <View style={s.recordStat}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color="#64748b"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={s.recordStatText}>
                        {formatDuration(r.durationSeconds)}
                      </Text>
                    </View>
                    <View style={s.recordStat}>
                      <Ionicons
                        name="flame-outline"
                        size={14}
                        color="#64748b"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={s.recordStatText}>
                        {r.calories ?? 0} kcal
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {loadingMore && (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color="#667eea" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerSection: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
  // 목표 카드
  goalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  goalLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  editButton: {
    backgroundColor: "#667eea",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  goalEditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalEditTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  input: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  saveButton: {
    backgroundColor: "#667eea",
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f1f5f9",
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    marginTop: 20,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#667eea",
    borderRadius: 5,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 14,
    color: "#667eea",
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
  },
  // 차트 카드
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyChartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 40,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyChartText: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 12,
  },
  // 통계 카드
  statsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  statItemValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  statItemLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  // 빈 카드
  emptyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 48,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  // AI 카드
  aiCard: {
    backgroundColor: "#0f172a",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  aiCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  aiIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#667eea",
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
  },
  // AI 대기 카드
  aiWaitCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  aiWaitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  aiWaitIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  aiWaitTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#78350f",
  },
  aiWaitText: {
    fontSize: 13,
    color: "#92400e",
    marginBottom: 16,
  },
  aiWaitProgress: {
    height: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  aiWaitProgressFill: {
    height: "100%",
    backgroundColor: "#f59e0b",
    borderRadius: 4,
  },
  aiWaitProgressText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },
  // 기록 섹션
  recordsSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  recordsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  recordsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  recordsCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#667eea",
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyRecords: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 48,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyRecordsText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 16,
  },
  emptyRecordsSubtext: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  // 기록 아이템
  recordItem: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mapPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  recordContent: {
    flex: 1,
  },
  recordTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  badgeSingle: {
    backgroundColor: "#10b981",
  },
  badgeJourney: {
    backgroundColor: "#667eea",
  },
  recordStats: {
    flexDirection: "row",
    gap: 12,
  },
  recordStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordStatText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
});
