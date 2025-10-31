import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert } from "../components/ui/AlertDialog";
import { Ionicons } from "@expo/vector-icons";
// ✅ 올바른 경로로 수정
import { apiComplete } from "../utils/api/running";
import SummaryMap from "../components/Running/SummaryMap";
import { getRunningRecordDetail } from "../utils/api/running";

export default function RunSummaryScreen({ route, navigation }: any) {
  const {
    distanceKm = 0,
    paceLabel = "--:--",
    kcal = 0,
    elapsedLabel = "0:00",
    elapsedSec,
    routePath = [],
    startedAt,
    endedAt,
    sessionId,
    snapshotUri,
    runId: runIdFromParams,
  } = route.params || {};

  const [title, setTitle] = useState("금요일 오전 러닝");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  const [routeForMap, setRouteForMap] = useState<any[]>(
    (routePath?.length && (routePath[0]?.lat != null || routePath[0]?.lng != null))
      ? routePath.map((p: any) => ({ latitude: p.latitude ?? p.lat, longitude: p.longitude ?? p.lng }))
      : (Array.isArray(routePath) ? routePath : [])
  );

  const initialRunId =
    typeof runIdFromParams === "number"
      ? runIdFromParams
      : Number.isFinite(Number(runIdFromParams))
      ? Number(runIdFromParams)
      : null;
  const runIdRef = useRef<number | null>(initialRunId);

  const paceSecPerKm = useMemo(() => {
    if (!paceLabel || paceLabel.includes("-")) return null;
    const [m, s] = String(paceLabel)
      .split(":")
      .map((v) => parseInt(v, 10));
    if (Number.isNaN(m) || Number.isNaN(s)) return null;
    return m * 60 + s;
  }, [paceLabel]);

  const currentDateTime = useMemo(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = now.getHours();
    const min = String(now.getMinutes()).padStart(2, "0");
    const ampm = hh < 12 ? "오전" : "오후";
    const hh12 = ((hh + 11) % 12) + 1;
    return `${mm}월 ${dd}일 ${ampm} ${hh12}:${min}`;
  }, []);

  useEffect(() => {
    (async () => {
      if (runIdRef.current || saving) return;

      // 개발 중 서버 세션이 없으면 더미 id로 즉시 활성화
      if (!sessionId || String(sessionId).startsWith("local_")) {
        console.warn("[RunSummary] 서버 세션 없음 → DEV 더미 runId=1 사용");
        runIdRef.current = 1; // ⚠️ 운영 전 제거
        return;
      }

      try {
        setSaving(true);

        const normalized =
          routePath?.length &&
          (routePath[0]?.lat != null || routePath[0]?.lng != null)
            ? routePath.map((p: any, i: number) => ({
                latitude: p.latitude ?? p.lat,
                longitude: p.longitude ?? p.lng,
                sequence: i + 1,
                t: p.t ? Math.floor(p.t) : undefined,
              }))
            : routePath.map((p: any, i: number) => ({
                latitude: p.latitude,
                longitude: p.longitude,
                sequence: i + 1,
              }));

        const durSec =
          typeof elapsedSec === "number"
            ? elapsedSec
            : (() => {
                const [mm, ss] = String(elapsedLabel ?? "0:00")
                  .split(":")
                  .map((x) => parseInt(x, 10));
                return (mm || 0) * 60 + (ss || 0);
              })();

        const { runId } = await apiComplete({
          sessionId,
          endedAt: endedAt ? Date.parse(endedAt) : Date.now(),
          distanceMeters: Math.round(distanceKm * 1000),
          durationSeconds: durSec,
          averagePaceSeconds: paceSecPerKm,
          calories: Math.round(kcal),
          routePoints: normalized,
          title,
        });

        if (!runId) {
          console.warn("[RunSummary] runId 없음 → DEV 더미 id 적용");
          runIdRef.current = 1; // ⚠️ 운영 전 제거
          setSaving(false);
          return;
        }

        runIdRef.current = runId;
      } catch (e) {
        console.error("[RunSummary] 저장 실패:", e);
        setDialog({ open:true, kind:'negative', title:'저장 실패', message:'네트워크 상태를 확인하고 다시 시도해주세요.' });
      } finally {
        setSaving(false);
      }
    })();
  }, [
    distanceKm,
    elapsedLabel,
    elapsedSec,
    kcal,
    paceSecPerKm,
    routePath,
    endedAt,
    sessionId,
    saving,
    title,
  ]);

  // 폴리라인 보강: routePath가 비어있고 runId가 있으면 서버에서 상세 경로 가져오기
  useEffect(() => {
    (async () => {
      try {
        if (routeForMap?.length) return;
        const id = runIdRef.current;
        if (!id) return;
        const detail = await getRunningRecordDetail(id);
        const pts = (detail.routePoints || []).map((p: any) => ({ latitude: p.latitude, longitude: p.longitude }));
        if (pts.length) setRouteForMap(pts);
      } catch (e) {
        // 경로가 없어도 화면은 계속 동작
      }
    })();
  }, [runIdRef.current]);

  const onSharePress = () => {
    if (runIdRef.current === null) {
      setDialog({ open:true, kind:'message', title:'잠시만요', message:'기록 저장 후 다시 시도해주세요.' });
      return;
    }

    navigation.navigate("FeedCompose", {
      runId: runIdRef.current,
      defaultTitle: title,
      // 지도 스냅샷 사용 중단 → 직접 업로드 유도
      distanceKm,
      paceLabel,
      elapsedLabel,
      kcal: Math.round(kcal),
    });
  };

  const onCompletePress = () => {
    // 메인으로 이동 (탭 홈)
    try {
      navigation.navigate("MainTabs");
    } catch {
      // 폴백: Main으로 이동 시도
      navigation.navigate("Main");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {dialog.open && dialog.kind === 'positive' && (
        <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'negative' && (
        <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'message' && (
        <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#666",
            marginTop: 8,
            marginBottom: 4,
            paddingHorizontal: 20,
          }}
        >
          {currentDateTime}
        </Text>

        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          {isEditingTitle ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={() => setIsEditingTitle(false)}
              onSubmitEditing={() => setIsEditingTitle(false)}
              autoFocus
              selectTextOnFocus
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#000",
                borderBottomWidth: 1,
                borderBottomColor: "#3B82F6",
                paddingBottom: 4,
              }}
            />
          ) : (
            <Pressable
              onPress={() => setIsEditingTitle(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "700",
                  color: "#000",
                  flex: 1,
                }}
              >
                {title}
              </Text>
              <Ionicons name="pencil" size={20} color="#666" />
            </Pressable>
          )}
        </View>

        <Text
          style={{
            fontSize: 48,
            fontWeight: "900",
            color: "#000",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          {distanceKm.toFixed(2)}Km
        </Text>

        <View
          style={{
            marginHorizontal: 20,
            marginBottom: 32,
            borderRadius: 16,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <SummaryMap
            route={routeForMap}
            height={280}
            borderRadius={16}
            showKmMarkers
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: 20,
            marginBottom: 40,
          }}
        >
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#000",
                marginBottom: 4,
              }}
            >
              {elapsedLabel}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", fontWeight: "500" }}>
              시간
            </Text>
          </View>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#000",
                marginBottom: 4,
              }}
            >
              {paceLabel}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", fontWeight: "500" }}>
              평균 페이스
            </Text>
          </View>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#000",
                marginBottom: 4,
              }}
            >
              {Math.round(kcal)}
            </Text>
            <Text style={{ fontSize: 12, color: "#666", fontWeight: "500" }}>
              칼로리
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onSharePress}
          disabled={runIdRef.current === null || saving}
          style={{
            backgroundColor:
              runIdRef.current === null || saving ? "#ccc" : "#000",
            marginHorizontal: 20,
            marginBottom: 12,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {saving ? "저장 중..." : "공유하기"}
          </Text>
        </Pressable>

        {/* 완료하기: 메인으로 이동 */}
        <Pressable
          onPress={onCompletePress}
          style={{
            backgroundColor: "#111111",
            marginHorizontal: 20,
            marginBottom: 40,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            완료하기
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: { padding: 4 },
  dateTime: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  titleSection: { paddingHorizontal: 20, marginBottom: 20 },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#000", flex: 1 },
  titleInput: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#3B82F6",
    paddingBottom: 4,
  },
  distance: {
    fontSize: 48,
    fontWeight: "900",
    color: "#000",
    textAlign: "center",
    marginBottom: 24,
  },
  mapContainer: {
    marginHorizontal: 20,
    marginBottom: 32,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  statItem: { alignItems: "center", flex: 1 },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#000",
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: "#666", fontWeight: "500" },
  shareButton: {
    backgroundColor: "#000",
    marginHorizontal: 20,
    marginBottom: 40,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonDisabled: { backgroundColor: "#ccc" },
  shareButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
