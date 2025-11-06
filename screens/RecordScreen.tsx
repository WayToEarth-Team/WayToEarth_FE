import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { PositiveAlert, NegativeAlert, MessageAlert } from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
import { getWeeklyStats, listRunningRecords, getRunningRecordDetail } from "../utils/api/running";
import { getMyProfile } from "../utils/api/users";
import { client } from "../utils/api/client";
import WeeklyChart from "../components/WeeklyChart";
import GoalCard from "../components/GoalCard";
import RecordItem from "../components/RecordItem";

export default function RecordScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [loading, setLoading] = useState(true);
  const [weekly, setWeekly] = useState<any | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState<string>("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [pageSize] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [dialog, setDialog] = useState<{ open: boolean; title?: string; message?: string; kind?: "positive" | "negative" | "message" }>({ open: false, kind: "message" });
  const [previews, setPreviews] = useState<Record<number, { coords: { latitude: number; longitude: number }[] }>>({});

  useEffect(() => {
    (async () => {
      try {
        const [w, r, me] = await Promise.all([getWeeklyStats(), listRunningRecords(pageSize, 0), getMyProfile()]);
        setWeekly(w ?? null);
        const first = Array.isArray(r) ? r : [];
        setRecords(first);
        setOffset(first.length);
        setHasMore(first.length === pageSize);
        const v = (me as any)?.weekly_goal_distance;
        setWeeklyGoal(v != null && !Number.isNaN(Number(v)) ? String(v) : "");
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
        const ids = records.slice(0, 5).map((r: any) => r.id).filter(Boolean);
        await Promise.all(
          ids.map(async (id) => {
            if (previews[id]) return;
            try {
              const d = await getRunningRecordDetail(id);
              const pts = (d.routePoints || []).map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
              if (pts.length) setPreviews((prev) => ({ ...prev, [id]: { coords: pts } }));
            } catch {}
          })
        );
      } catch {}
    })();
  }, [records]);

  if (loading) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={s.root}>
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
      const weeklyGoalNumber = weeklyGoal?.trim() === "" ? undefined : Number(weeklyGoal);
      const payload = { weekly_goal_distance: typeof weeklyGoalNumber === "number" && !Number.isNaN(weeklyGoalNumber) ? weeklyGoalNumber : undefined };
      await client.put("/v1/users/me", payload);
      setDialog({ open: true, kind: "positive", title: "완료", message: "주간 목표가 저장되었습니다." });
      setIsEditingGoal(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "주간 목표 저장에 실패했습니다.";
      setDialog({ open: true, kind: "negative", title: "오류", message: msg });
    } finally {
      setSavingGoal(false);
    }
  };

  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;

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

  return (
    <SafeAreaView edges={["top", "bottom"]} style={s.root}>
      {dialog.open && dialog.kind === "positive" && <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />}
      {dialog.open && dialog.kind === "negative" && <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />}
      {dialog.open && dialog.kind === "message" && <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open: false, kind: "message" })} />}

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + insets.bottom + 120 }}
        onScroll={({ nativeEvent }) => {
          if (!loadingMore && hasMore && isCloseToBottom(nativeEvent)) loadMoreRecords();
        }}
        scrollEventThrottle={200}
      >
        {/* 1. 이번 주 요약 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>이번 주 러닝</Text>
          {weekly ? (
            <View style={s.weeklyCard}>
              <View style={s.statsRow}>
                <View style={s.statBox}>
                  <Text style={s.statValue}>{(weekly.totalDistance ?? 0).toFixed(1)}</Text>
                  <Text style={s.statLabel}>거리 (km)</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statBox}>
                  <Text style={s.statValue}>{/* keep hh:mm:ss formatting on server */ weekly.totalDurationLabel ?? "00:00:00"}</Text>
                  <Text style={s.statLabel}>시간</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statBox}>
                  <Text style={s.statValue}>{weekly.averagePace ?? "-:-"}</Text>
                  <Text style={s.statLabel}>평균 페이스</Text>
                </View>
              </View>
              <WeeklyChart weekly={weekly} />
            </View>
          ) : (
            <View style={s.emptyWeekly}>
              <Text style={s.emptyWeeklyIcon}>📉</Text>
              <Text style={s.emptyWeeklyText}>이번 주 데이터가 없습니다</Text>
              <Text style={s.emptyWeeklySub}>러닝을 시작해 기록을 쌓아보세요</Text>
            </View>
          )}
        </View>

        {/* 2. 주간 목표 */}
        <View style={s.section}>
          <GoalCard
            weekly={weekly}
            weeklyGoal={weeklyGoal}
            setWeeklyGoal={setWeeklyGoal}
            isEditingGoal={isEditingGoal}
            setIsEditingGoal={setIsEditingGoal}
            savingGoal={savingGoal}
            onSave={saveWeeklyGoal}
          />
        </View>

        {/* 3. 운동 기록 리스트 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>운동 기록</Text>
          {records.length === 0 ? (
            <View style={s.emptyRecords}>
              <Text style={s.emptyRecordsIcon}>📝</Text>
              <Text style={s.emptyRecordsText}>최근 운동 기록이 없습니다</Text>
            </View>
          ) : (
            records.map((r) => (
              <RecordItem key={r.id} record={r} preview={previews[r.id]} onPress={() => navigation.navigate("RecordDetailScreen", { recordId: r.id })} />
            ))
          )}
        </View>
      </ScrollView>

      {/* 우측 하단 미니 FAB (탭바 높이 + 안전영역만큼 위로) */}
      {records.length >= 5 ? (
        <TouchableOpacity
          style={[s.fab, { bottom: tabBarHeight + insets.bottom + 16 }]}
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate("AIFeedbackScreen", {
              completedCount: records.length,
              latestRecordId: records[0]?.id,
            })
          }
          accessibilityLabel="AI 평가"
        >
          <Ionicons name="flask-outline" size={22} color="#6B21A8" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.fabDisabled, { bottom: tabBarHeight + insets.bottom + 16 }]}
          activeOpacity={0.85}
          accessibilityLabel="AI 평가 비활성화"
          onPress={() =>
            setDialog({
              open: true,
              kind: "message",
              title: "AI 분석 이용 안내",
              message: "5회 이상 러닝 기록이 있어야 AI 분석 피드백을 받을 수 있습니다.",
            })
          }
        >
          <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#1F2937", letterSpacing: -0.5, marginBottom: 8 },
  weeklyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 32, backgroundColor: "#F3F4F6" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#111" },
  statLabel: { fontSize: 12, color: "#6B7280" },
  emptyWeekly: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center" },
  emptyWeeklyIcon: { fontSize: 32, marginBottom: 8 },
  emptyWeeklyText: { fontSize: 14, fontWeight: "700", color: "#111" },
  emptyWeeklySub: { fontSize: 13, color: "#9CA3AF" },
  emptyRecords: { backgroundColor: "#fff", borderRadius: 16, padding: 40, alignItems: "center" },
  emptyRecordsIcon: { fontSize: 48, marginBottom: 12 },
  emptyRecordsText: { fontSize: 14, color: "#9CA3AF" },
  fab: { position: "absolute", right: 16, width: 48, height: 48, borderRadius: 14, backgroundColor: "#EEE7FF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  fabIcon: { fontSize: 20 },
  fabDisabled: { position: "absolute", right: 16, width: 48, height: 48, borderRadius: 14, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
});
