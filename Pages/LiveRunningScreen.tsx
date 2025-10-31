import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { StackActions } from "@react-navigation/native";
import { navigationRef } from "../navigation/RootNavigation";
import * as Location from "expo-location";
import SafeLayout from "../components/Layout/SafeLayout";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  AppState,
  TouchableOpacity,
} from "react-native";
import { PositiveAlert, NegativeAlert, MessageAlert, ConfirmAlert } from "../components/ui/AlertDialog";
import { LinearGradient } from 'expo-linear-gradient';
import MapRoute from "../components/Running/MapRoute";
import RunStatsCard from "../components/Running/RunStatsCard";
import RunPlayControls from "../components/Running/RunPlayControls";
import CountdownOverlay from "../components/Running/CountdownOverlay";
import WeatherWidget from "../components/Running/WeatherWidget";
import { useLiveRunTracker } from "../hooks/useLiveRunTracker";
import { useBackgroundRunning } from "../hooks/journey/useBackgroundRunning";
import { useWeather } from "../contexts/WeatherContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiComplete } from "../utils/api/running"; // ✅ 추가

export default function LiveRunningScreen({ navigation, route }: { navigation: any; route?: any }) {
  const targetDistanceKm = (route?.params?.targetDistanceKm as number | undefined) ?? undefined;
  const t = useLiveRunTracker();

  // 백그라운드 러닝 훅
  const backgroundRunning = useBackgroundRunning();

  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 12);

  const snapshotFnRef = useRef<(() => Promise<string | null>) | undefined>(
    undefined
  );
  const isStoppingRef = useRef(false);
  const [alert, setAlert] = useState<{ open: boolean; title?: string; message?: string; kind?: 'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  // 탭 상태: 'running' | 'journey'
  const [activeTab, setActiveTab] = useState<'running' | 'journey'>('running');
  const [mapReady, setMapReady] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);

  // 날씨 정보
  const { weather, loading: weatherLoading } = useWeather();

  // 러닝 세션 상태 업데이트 (일반 러닝)
  useEffect(() => {
    if (!t.isRunning) return;
    if (isStoppingRef.current) return; // 종료 진행 중이면 저장/업데이트 중단

    const session = {
      type: 'general' as const,
      sessionId: t.sessionId,
      startTime: Date.now() - (t.elapsedSec * 1000),
      distanceKm: t.distance,
      durationSeconds: t.elapsedSec,
      isRunning: t.isRunning,
      isPaused: t.isPaused,
    };

    // Foreground Service 업데이트
    backgroundRunning.updateForegroundService(session);

    // 세션 상태 저장 (백그라운드 복원용)
    backgroundRunning.saveSession(session);
  }, [t.isRunning, t.distance, t.elapsedSec, t.isPaused]);

  // 러닝 시작 시 Foreground Service 시작
  useEffect(() => {
    if (t.isRunning) {
      const session = {
        type: 'general' as const,
        sessionId: t.sessionId,
        startTime: Date.now() - (t.elapsedSec * 1000),
        distanceKm: t.distance,
        durationSeconds: t.elapsedSec,
        isRunning: true,
        isPaused: t.isPaused,
      };
      backgroundRunning.startForegroundService(session);
    }
  }, [t.isRunning]);

  // 컴포넌트 언마운트 시 세션 정리
  useEffect(() => {
    return () => {
      if (!t.isRunning) {
        backgroundRunning.stopForegroundService();
        backgroundRunning.clearSession();
      }
    };
  }, []);

  const handleRunningStart = useCallback(() => {
    console.log("[LiveRunning] start pressed -> show countdown");
    // 카운트다운 동안 GPS 가열: 초기 위치 락 향상
    try { (t as any).prime?.(); } catch {}
    setCountdownVisible(true);
  }, []);

  const handleCountdownDone = useCallback(async () => {
    console.log("[LiveRunning] countdown done");
    console.log("[LiveRunning] AppState at start:", AppState.currentState);
    setCountdownVisible(false);

    // 즉시 시작 시도 (권한은 내부에서 처리)
    requestAnimationFrame(() => {
      console.log("[LiveRunning] calling t.start()");
      t.start();
    });

    // 권한 요청은 비동기로 병렬 처리 (UI 차단 방지)
    backgroundRunning.requestNotificationPermission().catch(() => {});
  }, [t, backgroundRunning]);

  const elapsedLabel = useMemo(() => {
    const m = Math.floor(t.elapsedSec / 60);
    const s = String(t.elapsedSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [t.elapsedSec]);

  const takeSnapshotWithTimeout = async (
    fn?: () => Promise<string | null>,
    ms = 2000
  ) => {
    if (!fn) return null;
    try {
      return await Promise.race<string | null>([
        fn(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
      ]);
    } catch {
      return null;
    }
  };

  const doExitWithoutSave = useCallback(async () => {
    try {
      await backgroundRunning.clearSession();
    } catch {}

    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace("MainTabs"));
    } else {
      const rootParent = navigation.getParent?.()?.getParent?.();
      if (rootParent && typeof rootParent.dispatch === 'function') {
        rootParent.dispatch(StackActions.replace("MainTabs"));
      } else {
        navigation.navigate("MainTabs", { screen: "LiveRunningScreen" });
      }
    }

    requestAnimationFrame(async () => {
      try {
        await backgroundRunning.stopForegroundService();
        await t.stop();
      } catch (e) {
        console.error("러닝 정리 실패:", e);
      } finally {
        isStoppingRef.current = false;
      }
    });
  }, [navigation, backgroundRunning, t]);

  const doExitWithSave = useCallback(async () => {
    try {
      const avgPaceSec =
        t.distance > 0 && Number.isFinite(t.elapsedSec / t.distance)
          ? Math.floor(t.elapsedSec / Math.max(t.distance, 0.000001))
          : null;
      const routePoints = t.route.map((p, i) => ({ latitude: p.latitude, longitude: p.longitude, sequence: i + 1 }));
      const { runId } = await apiComplete({
        sessionId: t.sessionId as string,
        distanceMeters: Math.round(t.distance * 1000),
        durationSeconds: t.elapsedSec,
        averagePaceSeconds: avgPaceSec,
        calories: Math.round(t.kcal),
        routePoints,
        endedAt: Date.now(),
        title: "오늘의 러닝",
      });

      await backgroundRunning.stopForegroundService();
      await backgroundRunning.clearSession();
      await t.stop();
      navigation.navigate("RunSummary", {
        runId,
        defaultTitle: "오늘의 러닝",
        distanceKm: t.distance,
        paceLabel: t.paceLabel,
        kcal: Math.round(t.kcal),
        elapsedSec: t.elapsedSec,
        elapsedLabel: `${Math.floor(t.elapsedSec / 60)}:${String(t.elapsedSec % 60).padStart(2, "0")}`,
        routePath: t.route,
        sessionId: (t.sessionId as string) ?? "",
      });
    } catch (e) {
      console.error("러닝 완료/저장 실패:", e);
      setAlert({ open:true, kind:'negative', title:'저장 실패', message:'네트워크 또는 서버 오류가 발생했어요.' });
    } finally {
      isStoppingRef.current = false;
    }
  }, [navigation, t, backgroundRunning]);

  const completeRun = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    // 먼저 일시정지 상태로 전환
    if (!t.isPaused) {
      t.pause();
    }

    // 1차: 종료 확인
    setConfirmExit(true);
  }, [navigation, t, backgroundRunning]);

  React.useEffect(() => {
    if (!targetDistanceKm) return;
    if (!t.isRunning) return;
    if (t.distance >= targetDistanceKm) {
      completeRun();
    }
  }, [t.distance, t.isRunning, targetDistanceKm, completeRun]);

  return (
    <SafeLayout withBottomInset>
      {alert.open && alert.kind === 'positive' && (
        <PositiveAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert.open && alert.kind === 'negative' && (
        <NegativeAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      {alert.open && alert.kind === 'message' && (
        <MessageAlert visible title={alert.title} message={alert.message} onClose={() => setAlert({ open:false, kind:'message' })} />
      )}
      <ConfirmAlert
        visible={confirmExit}
        title="러닝 종료"
        message="러닝을 종료하시겠습니까?"
        onClose={() => setConfirmExit(false)}
        onCancel={() => {
          setConfirmExit(false);
          isStoppingRef.current = false;
          if (t.isPaused) t.resume();
        }}
        onConfirm={() => {
          setConfirmExit(false);
          setConfirmSave(true);
        }}
        confirmText="종료"
      />
      <ConfirmAlert
        visible={confirmSave}
        title="기록 저장"
        message="러닝 기록을 저장하시겠습니까?"
        onClose={() => setConfirmSave(false)}
        onCancel={() => {
          setConfirmSave(false);
          doExitWithoutSave();
        }}
        onConfirm={() => {
          setConfirmSave(false);
          doExitWithSave();
        }}
        confirmText="저장"
        cancelText="저장 안 함"
      />
      <MapRoute
        route={t.route}
        last={t.last}
        liveMode
        onBindCenter={t.bindMapCenter}
        onBindSnapshot={(fn) => {
          snapshotFnRef.current = fn;
        }}
        useCurrentLocationOnMount
        onMapReady={() => setMapReady(true)}
      />

      {/* 상단 비네팅 효과 */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0.7)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 180,
          pointerEvents: 'none',
        }}
      />

      {/* 좌우 비네팅 효과 */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.9)', 'transparent', 'rgba(255, 255, 255, 0.9)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
        }}
      />

      {/* 하단 비네팅 효과 */}
      <LinearGradient
        colors={['transparent', 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 1)']}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 200,
          pointerEvents: 'none',
        }}
      />

      {/* 상단 탭 컨트롤 */}
      <View
        style={{
          position: "absolute",
          top: Math.max(insets.top, 12) + 12,
          left: 20,
          right: 20,
          zIndex: 10,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'running' && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab('running')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'running' && styles.segmentTextActive,
              ]}
            >
              러닝
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeTab === 'journey' && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveTab('journey')}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'journey' && styles.segmentTextActive,
              ]}
            >
              여정 러닝
            </Text>
          </TouchableOpacity>
        </View>

        <WeatherWidget
          emoji={weather?.emoji}
          condition={weather?.condition}
          temperature={weather?.temperature}
          recommendation={weather?.recommendation}
          loading={weatherLoading}
        />
      </View>

      {(t.isRunning || t.isPaused) && (
        <RunStatsCard
          distanceKm={t.distance}
          paceLabel={t.paceLabel}
          kcal={t.kcal}
          speedKmh={t.speedKmh}
          elapsedSec={t.elapsedSec}
        />
      )}

      {t.isPaused && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
            일시정지
          </Text>
          <Text style={{ color: "#4b5563", marginTop: 2 }}>
            재생 ▶ 을 누르면 다시 시작됩니다.
          </Text>
          <Text style={{ color: "#4b5563", marginTop: 2 }}>
            종료하려면 ■ 버튼을 2초간 길게 누르세요.
          </Text>
        </View>
      )}

      {!t.isRunning && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomSafe + 90,
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (activeTab === 'running') {
                handleRunningStart();
              } else {
                // Tab Navigator에서 Root Stack으로 이동
                if (navigationRef.isReady()) {
                  navigationRef.navigate('JourneyRouteList' as never);
                } else {
                  // fallback: parent navigation 사용
                  const parentNav = navigation.getParent?.();
                  if (parentNav) {
                    parentNav.navigate('JourneyRouteList');
                  } else {
                    navigation.navigate('JourneyRouteList');
                  }
                }
              }
            }}
            disabled={activeTab === 'running' && (!t.isReady || t.isInitializing)}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor:
                activeTab === 'running' && (!t.isReady || t.isInitializing)
                  ? "rgba(0, 0, 0, 0.3)"
                  : "rgba(0, 0, 0, 0.85)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 10 },
              elevation: 15,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: activeTab === 'running' && (!t.isReady || t.isInitializing)
                  ? "rgba(255, 255, 255, 0.5)"
                  : "#FFFFFF",
                textAlign: "center",
              }}
            >
              {activeTab === 'running'
                ? (!t.isReady
                  ? "준비중"
                  : t.isInitializing
                  ? "시작중"
                  : "시작")
                : "여정"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {t.isRunning && (
        <RunPlayControls
          isRunning={t.isRunning}
          isPaused={t.isPaused}
          onPlay={() => t.start()}
          onPause={() => t.pause()}
          onResume={() => t.resume()}
          onStopTap={() => setAlert({ open:true, kind:'message', title:'안내', message:'종료하려면 길게 누르세요' })}
          onStopLong={completeRun}
        />
      )}

      {/* 탭 내비게이터 사용으로 하단 바는 전역에서 렌더링됨 */}

      <CountdownOverlay
        visible={countdownVisible}
        seconds={3}
        onDone={handleCountdownDone}
      />
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 24,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  segmentButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
});
