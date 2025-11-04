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
import {
  initWatchSync,
  subscribeRealtimeUpdates,
  startRunOrchestrated,
  isWatchAvailable,
  type RealtimeRunningData
} from "../src/modules/watchSync";
import { useWatchConnection } from "../src/hooks/useWatchConnection";

export default function LiveRunningScreen({ navigation, route }: { navigation: any; route?: any }) {
  const targetDistanceKm = (route?.params?.targetDistanceKm as number | undefined) ?? undefined;
  const t = useLiveRunTracker();

  // 백그라운드 러닝 훅
  const backgroundRunning = useBackgroundRunning();

  // 워치 연결 상태
  const watchStatus = useWatchConnection();

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

  // 워치 모드 상태
  const [watchMode, setWatchMode] = useState(false);
  const [watchRunning, setWatchRunning] = useState(false);
  const [watchData, setWatchData] = useState<RealtimeRunningData | null>(null);
  const [watchCompleteData, setWatchCompleteData] = useState<any>(null);
  const [watchRoutePoints, setWatchRoutePoints] = useState<Array<{latitude: number; longitude: number}>>([]);

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

  // 워치 동기화 초기화
  useEffect(() => {
    if (isWatchAvailable()) {
      console.log('[LiveRunning] Initializing watch sync');
      initWatchSync();
    }
  }, []);

  // 워치 모드일 때 실시간 데이터 구독
  useEffect(() => {
    if (!watchMode) return;

    console.log('[LiveRunning] Subscribing to watch updates');

    // 실시간 데이터 구독
    const unsubscribeUpdates = subscribeRealtimeUpdates((data) => {
      console.log('[LiveRunning] Watch data received:', data);
      setWatchData(data);

      // 첫 데이터 수신 시 러닝 시작으로 간주
      if (!watchRunning) {
        setWatchRunning(true);

        // AsyncStorage에 러닝 세션 저장 (탭 바 숨김용)
        import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
          AsyncStorage.setItem('@running_session', JSON.stringify({
            isRunning: true,
            sessionId: data.sessionId,
            startTime: Date.now(),
          }));
        });
      }

      // 워치 위치로 지도 이동 및 경로 누적
      if (data.currentPoint && data.currentPoint.latitude && data.currentPoint.longitude) {
        const newPoint = {
          latitude: data.currentPoint.latitude,
          longitude: data.currentPoint.longitude,
        };

        // 경로에 새 포인트 추가 (중복 방지)
        setWatchRoutePoints(prev => {
          const lastPoint = prev[prev.length - 1];
          // 마지막 포인트와 동일한지 확인 (좌표가 정확히 같으면 추가하지 않음)
          if (lastPoint &&
              Math.abs(lastPoint.latitude - newPoint.latitude) < 0.00001 &&
              Math.abs(lastPoint.longitude - newPoint.longitude) < 0.00001) {
            return prev;
          }
          return [...prev, newPoint];
        });

        // 지도 중심 이동
        if (t.bindMapCenter) {
          t.bindMapCenter(newPoint);
        }
      }
    });

    // wearStarted 이벤트 리스너 추가
    const { NativeModules, NativeEventEmitter } = require('react-native');
    const { WayToEarthWear } = NativeModules;
    const emitter = new NativeEventEmitter(WayToEarthWear);

    const startedSub = emitter.addListener('wearStarted', (payload: string) => {
      console.log('[LiveRunning] Watch session started:', payload);
      setWatchRunning(true);
    });

    // wearRunningComplete 이벤트 리스너 추가 (워치에서 종료 버튼 누름)
    const completeSub = emitter.addListener('wearRunningComplete', (payload: string) => {
      console.log('[LiveRunning] Watch session completed:', payload);

      try {
        // payload 파싱
        const completeData = JSON.parse(payload);
        console.log('[LiveRunning] Parsed complete data:', completeData);

        // 완료 데이터 저장
        setWatchCompleteData(completeData);

        // 워치 러닝 종료
        setWatchRunning(false);

        // 혹시 실행 중인 핸드폰 러닝이 있다면 종료 (정리)
        if (t.isRunning) {
          console.log('[LiveRunning] Stopping phone running session after watch complete');
          t.stop().catch(err => console.error('[LiveRunning] Failed to stop:', err));
        }

        // AsyncStorage 세션 정보 제거
        import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
          AsyncStorage.removeItem('@running_session');
        });

        // 저장 확인 다이얼로그 표시
        setConfirmSave(true);
      } catch (e) {
        console.error('[LiveRunning] Failed to parse complete data:', e);
      }
    });

    // wearRunIdReceived 이벤트 리스너 추가 (서버에서 runId 수신)
    const runIdSub = emitter.addListener('wearRunIdReceived', (payload: string) => {
      console.log('[LiveRunning] Watch runId received:', payload);

      try {
        const data = JSON.parse(payload);
        console.log('[LiveRunning] Parsed runId data:', data);

        // watchCompleteData 업데이트
        setWatchCompleteData(prev => {
          if (prev && prev.sessionId === data.sessionId) {
            return { ...prev, runId: data.runId };
          }
          return prev;
        });
      } catch (e) {
        console.error('[LiveRunning] Failed to parse runId data:', e);
      }
    });

    return () => {
      unsubscribeUpdates();
      startedSub.remove();
      completeSub.remove();
      runIdSub.remove();
    };
  }, [watchMode]);

  const handleRunningStart = useCallback(() => {
    console.log("[LiveRunning] start pressed -> checking watch connection");

    // 워치 연결 확인 후 모드 결정
    if (watchStatus.isConnected && isWatchAvailable()) {
      console.log("[LiveRunning] Watch connected, using watch mode");
      setWatchMode(true);
    } else {
      console.log("[LiveRunning] Watch not connected, using phone-only mode");
      setWatchMode(false);
      // 폰 모드에서만 GPS 가열
      try { (t as any).prime?.(); } catch {}
    }

    setCountdownVisible(true);
  }, [watchStatus.isConnected]);

  const handleCountdownDone = useCallback(async () => {
    console.log("[LiveRunning] countdown done, watchMode:", watchMode);
    console.log("[LiveRunning] AppState at start:", AppState.currentState);
    setCountdownVisible(false);

    if (watchMode) {
      // 워치 모드: 워치 세션 시작
      try {
        console.log("[LiveRunning] Starting watch session");
        const sessionId = await startRunOrchestrated('SINGLE');
        console.log("[LiveRunning] Watch session started:", sessionId);
        setAlert({
          open: true,
          kind: 'positive',
          title: '워치 연동',
          message: '워치와 연동되어 러닝을 시작합니다'
        });
      } catch (error) {
        console.error("[LiveRunning] Watch start failed, fallback to phone mode:", error);
        // 워치 시작 실패 시 폰 모드로 전환
        setWatchMode(false);
        requestAnimationFrame(() => {
          t.start();
        });
        setAlert({
          open: true,
          kind: 'negative',
          title: '워치 연동 실패',
          message: '폰 모드로 시작합니다'
        });
      }
    } else {
      // 폰 전용 모드: 기존 로직
      requestAnimationFrame(() => {
        console.log("[LiveRunning] calling t.start() (phone mode)");
        t.start();
      });
    }

    // 권한 요청은 비동기로 병렬 처리 (UI 차단 방지)
    backgroundRunning.requestNotificationPermission().catch(() => {});
  }, [watchMode, t, backgroundRunning]);

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
      // 혹시 실행 중인 러닝 세션이 있다면 종료
      if (t.isRunning) {
        console.log('[LiveRunning] Stopping running session in doExitWithoutSave');
        await t.stop();
      }

      await backgroundRunning.clearSession();

      // AsyncStorage 세션 정보도 제거
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.removeItem('@running_session');
      });
    } catch {}

    // 워치 모드 리셋
    setWatchMode(false);
    setWatchRunning(false);
    setWatchData(null);
    setWatchCompleteData(null);
    setWatchRoutePoints([]);

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
        if (!watchMode) {
          await t.stop();
        }
      } catch (e) {
        console.error("러닝 정리 실패:", e);
      } finally {
        isStoppingRef.current = false;
      }
    });
  }, [navigation, backgroundRunning, t, watchMode]);

  const doExitWithSave = useCallback(async () => {
    try {
      // 워치 모드인지 폰 모드인지 확인
      if (watchMode && watchCompleteData) {
        // 워치 모드: watchCompleteData 사용 (watchSync.ts에서 이미 서버에 complete 전송됨)
        const distanceMeters = watchCompleteData.totalDistanceMeters || watchCompleteData.distanceMeters || 0;
        const distanceKm = distanceMeters / 1000;
        const avgPaceSec = watchCompleteData.averagePaceSeconds || null;
        const calories = watchCompleteData.calories || 0;
        const durationSec = watchCompleteData.durationSeconds || 0;

        // routePoints 처리: watchCompleteData에서 가져오거나 실시간 누적된 watchRoutePoints 사용
        let routePointsForSummary = [];
        if (watchCompleteData.routePoints && Array.isArray(watchCompleteData.routePoints) && watchCompleteData.routePoints.length > 0) {
          routePointsForSummary = watchCompleteData.routePoints.map((p: any) => ({
            latitude: p.latitude,
            longitude: p.longitude,
          }));
          console.log('[LiveRunning] Using routePoints from watchCompleteData:', routePointsForSummary.length);
        } else if (watchRoutePoints.length > 0) {
          routePointsForSummary = watchRoutePoints;
          console.log('[LiveRunning] Using accumulated watchRoutePoints:', routePointsForSummary.length);
        } else {
          console.warn('[LiveRunning] No route points available');
        }

        await backgroundRunning.stopForegroundService();
        await backgroundRunning.clearSession();

        // watchMode 리셋
        setWatchMode(false);
        setWatchCompleteData(null);
        setWatchRoutePoints([]);

        navigation.navigate("RunSummary", {
          runId: watchCompleteData.runId || null, // watchSync.ts에서 apiComplete 결과로 받은 runId
          defaultTitle: "오늘의 러닝",
          distanceKm,
          paceLabel: avgPaceSec ? `${Math.floor(avgPaceSec / 60)}:${String(avgPaceSec % 60).padStart(2, "0")}` : "--:--",
          kcal: calories,
          elapsedSec: durationSec,
          elapsedLabel: `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}`,
          routePath: routePointsForSummary,
          sessionId: watchCompleteData.sessionId || "",
        });
      } else {
        // 폰 모드: 기존 로직
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
      }
    } catch (e) {
      console.error("러닝 완료/저장 실패:", e);
      setAlert({ open:true, kind:'negative', title:'저장 실패', message:'네트워크 또는 서버 오류가 발생했어요.' });
    } finally {
      isStoppingRef.current = false;
    }
  }, [navigation, t, backgroundRunning, watchMode, watchCompleteData]);

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
        route={watchMode && watchRunning ? watchRoutePoints : t.route}
        last={watchMode && watchRunning && watchRoutePoints.length > 0 ? watchRoutePoints[watchRoutePoints.length - 1] : t.last}
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

      {/* 상단 탭 컨트롤 - 러닝 중이 아닐 때만 표시 */}
      {!t.isRunning && !watchRunning && (
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
      )}

      {(t.isRunning || t.isPaused || watchRunning) && (
        <RunStatsCard
          distanceKm={watchMode && watchData ? watchData.distanceMeters / 1000 : t.distance}
          paceLabel={
            watchMode && watchData && watchData.averagePaceSeconds
              ? `${Math.floor(watchData.averagePaceSeconds / 60)}:${String(watchData.averagePaceSeconds % 60).padStart(2, "0")}`
              : t.paceLabel
          }
          kcal={watchMode && watchData ? watchData.calories : t.kcal}
          speedKmh={t.speedKmh}
          elapsedSec={watchMode && watchData ? watchData.durationSeconds : t.elapsedSec}
        />
      )}

      {t.isPaused && !watchMode && (
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

      {!t.isRunning && !watchRunning && (
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

      {(t.isRunning || watchRunning) && !watchMode && (
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

      {watchRunning && watchMode && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomSafe + 20,
            alignItems: "center",
          }}
        >
          <Text style={{
            fontSize: 14,
            color: "rgba(0,0,0,0.6)",
            backgroundColor: "rgba(255,255,255,0.9)",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
          }}>
            ⌚ 워치에서 제어 중
          </Text>
        </View>
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
