import React, {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { StackActions, useFocusEffect } from "@react-navigation/native";
import { navigationRef } from "../navigation/RootNavigation";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import {
  PositiveAlert,
  NegativeAlert,
  MessageAlert,
  ConfirmAlert,
} from "../components/ui/AlertDialog";
import { LinearGradient } from "expo-linear-gradient";
import EmblemCelebration from "../components/Effects/EmblemCelebration";
import MapRoute from "../components/Running/MapRoute";
import RunStatsCard from "../components/Running/RunStatsCard";
import RunPlayControls from "../components/Running/RunPlayControls";
import CountdownOverlay from "../components/Running/CountdownOverlay";
import WeatherWidget from "../components/Running/WeatherWidget";
import { useLiveRunTracker } from "../hooks/useLiveRunTracker";
import { useBackgroundRunning } from "../hooks/journey/useBackgroundRunning";
import { emitRunningSession } from "../utils/navEvents";
import { useWeather } from "../contexts/WeatherContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiComplete, checkPaceCoach } from "../utils/api/running"; // ✅ 추가
import { updateUserSettings } from "../utils/api/users";
import { awardEmblemByCode } from "../utils/api/emblems";
import { useAuth } from "../contexts/AuthContext";
import {
  initWatchSync,
  subscribeRealtimeUpdates,
  startRunOrchestrated,
  isWatchAvailable,
  type RealtimeRunningData,
} from "../src/modules/watchSync";
import { useWatchConnection } from "../src/hooks/useWatchConnection";
import { showToast } from "../utils/toast";

export default function LiveRunningScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const targetDistanceKm =
    (route?.params?.targetDistanceKm as number | undefined) ?? undefined;
  const t = useLiveRunTracker();

  // 백그라운드 러닝 훅
  const backgroundRunning = useBackgroundRunning();

  // 사용자 정보/페이스 코치 설정
  const { user, refreshProfile } = useAuth();
  const [isPaceCoachEnabled, setIsPaceCoachEnabled] = useState(
    user?.is_pace_coach_enabled ?? false
  );
  const [lastCheckedBucket, setLastCheckedBucket] = useState(0); // 페이스 체크 간격 버킷
  const [paceCoachMessage, setPaceCoachMessage] = useState<string | null>(null);

  // 테스트/조정 가능: km 단위 간격 (0.005km = 5m)
  const PACE_CHECK_INTERVAL_KM = 0.005;

  // 워치 연결 상태
  const watchStatus = useWatchConnection();

  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 12);

  const snapshotFnRef = useRef<(() => Promise<string | null>) | undefined>(
    undefined
  );
  const forceCenterRef = useRef<((p: { latitude: number; longitude: number }) => void) | null>(null);
  const isStoppingRef = useRef(false);
  const [alert, setAlert] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    kind?: "positive" | "negative" | "message";
  }>({ open: false, kind: "message" });
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [celebrate, setCelebrate] = useState<{
    visible: boolean;
    count?: number;
  }>({ visible: false });
  const celebratedKmRef = useRef<Set<number>>(new Set());
  const celebratingRef = useRef(false);
  const shown10mRef = useRef(false);

  // 탭 상태: 'running' | 'journey'
  const [activeTab, setActiveTab] = useState<"running" | "journey">("running");
  const [mapReady, setMapReady] = useState(false);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const wasFocused = useRef(true);

  // 워치 모드 상태
  const [watchMode, setWatchMode] = useState(false);
  const [watchRunning, setWatchRunning] = useState(false);
  const [watchData, setWatchData] = useState<RealtimeRunningData | null>(null);
  const [watchCompleteData, setWatchCompleteData] = useState<any>(null);
  const [watchRoutePoints, setWatchRoutePoints] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);

  // 위치명 상태 (예: "효자동")
  const [locationName, setLocationName] = useState<string>("");
  // 날씨 팝업 상태
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  // 날씨 애니메이션
  const weatherAnimOpacity = useRef(new Animated.Value(0)).current;

  const toggleWeather = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        300,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    setWeatherExpanded(!weatherExpanded);

    Animated.timing(weatherAnimOpacity, {
      toValue: weatherExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // 사용자 프로필 변경 시 페이스 코치 설정 동기화
  useEffect(() => {
    if (user?.is_pace_coach_enabled !== undefined) {
      setIsPaceCoachEnabled(!!user.is_pace_coach_enabled);
    }
  }, [user?.is_pace_coach_enabled]);

  // 페이스 코치 토글
  const handlePaceCoachToggle = useCallback(async () => {
    const next = !isPaceCoachEnabled;
    setIsPaceCoachEnabled(next);
    try {
      await updateUserSettings({ is_pace_coach_enabled: next });
      await refreshProfile();
    } catch (e) {
      console.error('[PaceCoach] 설정 업데이트 실패:', e);
      setIsPaceCoachEnabled(!next);
    }
  }, [isPaceCoachEnabled, refreshProfile]);

  // km/시간/페이스 계산 값 (워치 데이터 우선)
  const displayDistanceKm = useMemo(() => {
    if (watchMode && watchData?.distanceMeters != null) {
      return watchData.distanceMeters / 1000;
    }
    return t.distance;
  }, [watchMode, watchData?.distanceMeters, t.distance]);

  const displayElapsedSec = useMemo(() => {
    if (watchMode && watchData?.durationSeconds != null) {
      return watchData.durationSeconds;
    }
    return t.elapsedSec;
  }, [watchMode, watchData?.durationSeconds, t.elapsedSec]);

  const checkPaceCoachIfNeeded = useCallback(async (currentBucket: number, distanceKm: number) => {
    if (!isPaceCoachEnabled) return;
    if (currentBucket <= lastCheckedBucket || distanceKm <= 0) return;

    let currentPaceSeconds: number | null = null;
    if (watchMode && watchData) {
      if (Number.isFinite(watchData.paceSeconds)) currentPaceSeconds = Number(watchData.paceSeconds);
      else if (Number.isFinite(watchData.averagePaceSeconds)) currentPaceSeconds = Number(watchData.averagePaceSeconds);
    } else if (displayElapsedSec > 0 && displayDistanceKm > 0) {
      currentPaceSeconds = Math.floor(displayElapsedSec / Math.max(displayDistanceKm, 0.000001));
    }

    if (!currentPaceSeconds || currentPaceSeconds <= 0) return;

    try {
      const sessionId =
        (watchMode && watchData?.sessionId)
          ? watchData.sessionId
          : t.sessionId || `run-${Date.now()}`;

      const res = await checkPaceCoach({
        session_id: sessionId,
        current_km: Number(distanceKm.toFixed(3)),
        current_pace_seconds: currentPaceSeconds,
      });

      setLastCheckedBucket(currentBucket);

      if (res?.should_alert && res.alert_message) {
        setPaceCoachMessage(res.alert_message);
        showToast(res.alert_message);
        setTimeout(() => setPaceCoachMessage(null), 3000);
      }
    } catch (err) {
      console.error('[PaceCoach] 체크 실패:', err);
    }
  }, [isPaceCoachEnabled, lastCheckedBucket, watchMode, watchData, t.sessionId, displayElapsedSec, displayDistanceKm]);

  useEffect(() => {
    const running = watchMode ? watchRunning : t.isRunning;
    const paused = watchMode ? false : t.isPaused;
    if (!running || paused || !isPaceCoachEnabled) return;

    const currentBucket = Math.floor(displayDistanceKm / PACE_CHECK_INTERVAL_KM);
    if (currentBucket > lastCheckedBucket && currentBucket > 0) {
      checkPaceCoachIfNeeded(currentBucket, displayDistanceKm);
    }
  }, [watchMode, watchRunning, t.isRunning, t.isPaused, isPaceCoachEnabled, displayDistanceKm, lastCheckedBucket, checkPaceCoachIfNeeded, PACE_CHECK_INTERVAL_KM]);

  // 날씨 정보 (이 화면에서만 위치/날씨 활성화)
  const {
    weather,
    loading: weatherLoading,
    enable: enableWeather,
    disable: disableWeather,
  } = useWeather();
  useEffect(() => {
    try {
      enableWeather();
    } catch {}
    return () => {
      try {
        disableWeather();
      } catch {}
    };
  }, []);

  // 위치명 가져오기 (reverse geocoding)
  useEffect(() => {
    const fetchLocationName = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const geocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (geocode && geocode.length > 0) {
          const addr = geocode[0];
          // 동 > 구 > 시 순서로 표시
          const name = addr.district || addr.subregion || addr.city || addr.region || "";
          setLocationName(name);
        }
      } catch (err) {
        console.warn("[LiveRunning] Failed to fetch location name:", err);
      }
    };

    fetchLocationName();
  }, []);

  // 다른 탭에서 돌아올 때만 지도 리프레시 (배터리 절약)
  useFocusEffect(
    React.useCallback(() => {
      console.log("[LiveRunning] Tab focused, wasFocused:", wasFocused.current);
      if (!wasFocused.current) {
        console.log(
          "[LiveRunning] ✅ Returned from another tab, refreshing map"
        );
        setMapKey((prev) => prev + 1);
      }
      wasFocused.current = true;

      return () => {
        console.log("[LiveRunning] 👋 Leaving tab");
        wasFocused.current = false;
      };
    }, [])
  );

  // 러닝 세션 상태 업데이트 (일반 러닝)
  useEffect(() => {
    if (!t.isRunning) return;
    if (isStoppingRef.current) return; // 종료 진행 중이면 저장/업데이트 중단

    const session = {
      type: "general" as const,
      sessionId: t.sessionId,
      startTime: Date.now() - t.elapsedSec * 1000,
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

  // 거리 도달 엠블럼 수여/축하 (세션 중)
  useEffect(() => {
    if (!t.isRunning) return;
    // 10m 도달
    if (!shown10mRef.current && t.distance >= 0.01) {
      shown10mRef.current = true;
      (async () => {
        try {
          const res = await awardEmblemByCode('DIST_10M');
          if (res?.awarded && !celebratingRef.current) {
            celebratingRef.current = true;
            setCelebrate({ visible: true, count: 1 });
            await new Promise((r) => setTimeout(r, 2500));
            setCelebrate({ visible: false });
            celebratingRef.current = false;
          }
        } catch {}
      })();
    }
    // 정수 km 도달
    const km = Math.floor(t.distance);
    if (!Number.isFinite(km) || km < 1) return;
    if (celebratedKmRef.current.has(km)) return;
    celebratedKmRef.current.add(km);
    (async () => {
      try {
        const res = await awardEmblemByCode(`DIST_${km}KM`);
        if (res?.awarded && !celebratingRef.current) {
          celebratingRef.current = true;
          setCelebrate({ visible: true, count: 1 });
          await new Promise((r) => setTimeout(r, 2500));
          setCelebrate({ visible: false });
          celebratingRef.current = false;
        }
      } catch {}
    })();
  }, [t.distance, t.isRunning]);

  // 러닝 시작 시 Foreground Service 시작
  useEffect(() => {
    if (t.isRunning) {
      const session = {
        type: "general" as const,
        sessionId: t.sessionId,
        startTime: Date.now() - t.elapsedSec * 1000,
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
      console.log("[LiveRunning] Initializing watch sync");
      initWatchSync();
    }
  }, []);

  // 워치 모드일 때 실시간 데이터 구독
  useEffect(() => {
    if (!watchMode) return;

    console.log("[LiveRunning] Subscribing to watch updates");

    // 실시간 데이터 구독
    const unsubscribeUpdates = subscribeRealtimeUpdates((data) => {
      console.log("[LiveRunning] Watch data received:", data);
      setWatchData(data);

      // 첫 데이터 수신 시 러닝 시작으로 간주
      if (!watchRunning) {
        setWatchRunning(true);

        // AsyncStorage에 러닝 세션 저장 (탭 바 숨김용)
        try {
          AsyncStorage.setItem(
            "@running_session",
            JSON.stringify({
              isRunning: true,
              sessionId: data.sessionId,
              startTime: Date.now(),
            })
          ).catch(() => {});
        } catch {}

        // 즉시 탭바 숨김 반영
        try {
          emitRunningSession(true);
        } catch {}
      }

      // 워치 위치로 지도 이동 및 경로 누적
      if (
        data.currentPoint &&
        data.currentPoint.latitude &&
        data.currentPoint.longitude
      ) {
        const newPoint = {
          latitude: data.currentPoint.latitude,
          longitude: data.currentPoint.longitude,
        };

        // 경로에 새 포인트 추가 (중복 방지)
        setWatchRoutePoints((prev) => {
          const lastPoint = prev[prev.length - 1];
          // 마지막 포인트와 동일한지 확인 (좌표가 정확히 같으면 추가하지 않음)
          if (
            lastPoint &&
            Math.abs(lastPoint.latitude - newPoint.latitude) < 0.00001 &&
            Math.abs(lastPoint.longitude - newPoint.longitude) < 0.00001
          ) {
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
    const { NativeModules, NativeEventEmitter } = require("react-native");
    const { WayToEarthWear } = NativeModules;
    const emitter = new NativeEventEmitter(WayToEarthWear);

    const startedSub = emitter.addListener("wearStarted", (payload: string) => {
      console.log("[LiveRunning] Watch session started:", payload);
      setWatchRunning(true);
    });

    // wearRunningComplete 이벤트 리스너 추가 (워치에서 종료 버튼 누름)
    const completeSub = emitter.addListener(
      "wearRunningComplete",
      async (payload: string) => {
        console.log("[LiveRunning] Watch session completed:", payload);

        try {
          // payload 파싱
          const completeData = JSON.parse(payload);
          console.log("[LiveRunning] Parsed complete data:", completeData);

          // 완료 데이터 저장
          setWatchCompleteData(completeData);

          // 워치 러닝 종료
          setWatchRunning(false);

          // 혹시 실행 중인 핸드폰 러닝이 있다면 종료 (정리)
          if (t.isRunning) {
            console.log(
              "[LiveRunning] Stopping phone running session after watch complete"
            );
            t.stop().catch((err) =>
              console.error("[LiveRunning] Failed to stop:", err)
            );
          }

          // AsyncStorage 세션 정보 제거
          try { await AsyncStorage.removeItem("@running_session"); } catch {}

          // 위치를 강제로 다시 가져오기 (메인 페이지 지도를 위해)
          console.log(
            "[LiveRunning] Attempting to refresh location after watch complete..."
          );
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            });
            console.log(
              "[LiveRunning] Successfully refreshed location after watch complete:",
              loc.coords
            );
          } catch (err) {
            console.warn(
              "[LiveRunning] Failed to refresh location after watch complete:",
              err
            );
          }

          // 저장 확인 다이얼로그 표시
          setConfirmSave(true);
        } catch (e) {
          console.error("[LiveRunning] Failed to parse complete data:", e);
        }
      }
    );

    // wearRunIdReceived 이벤트 리스너 추가 (서버에서 runId 수신)
    const runIdSub = emitter.addListener(
      "wearRunIdReceived",
      (payload: string) => {
        console.log("[LiveRunning] Watch runId received:", payload);

        try {
          const data = JSON.parse(payload);
          console.log("[LiveRunning] Parsed runId data:", data);

          // watchCompleteData 업데이트
          setWatchCompleteData((prev) => {
            if (prev && prev.sessionId === data.sessionId) {
              return { ...prev, runId: data.runId };
            }
            return prev;
          });
        } catch (e) {
          console.error("[LiveRunning] Failed to parse runId data:", e);
        }
      }
    );

    return () => {
      unsubscribeUpdates();
      startedSub.remove();
      completeSub.remove();
      runIdSub.remove();
    };
  }, [watchMode]);

  const handleRunningStart = useCallback(() => {
    console.log("[LiveRunning] start pressed -> checking watch connection");

    // 새 러닝마다 페이스 코치 상태 초기화
    setLastCheckedBucket(0);
    setPaceCoachMessage(null);

    // 워치 연결 확인 후 모드 결정
    if (watchStatus.isConnected && isWatchAvailable()) {
      console.log("[LiveRunning] Watch connected, using watch mode");
      setWatchMode(true);
    } else {
      console.log("[LiveRunning] Watch not connected, using phone-only mode");
      setWatchMode(false);
      // 폰 모드에서만 GPS 가열
      try {
        (t as any).prime?.();
      } catch {}
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
        const sessionId = await startRunOrchestrated("SINGLE");
        console.log("[LiveRunning] Watch session started:", sessionId);

        // ✅ 워치 러닝 상태 시작 (UI 표시용)
        setWatchRunning(true);

        // 워치 모드 시작과 동시에 탭바 숨김 즉시 반영
        try {
          await AsyncStorage.setItem(
            "@running_session",
            JSON.stringify({
              isRunning: true,
              sessionId,
              startTime: Date.now(),
            })
          );
        } catch {}
        try {
          emitRunningSession(true);
        } catch {}
        setAlert({
          open: true,
          kind: "positive",
          title: "워치 연동",
          message: "워치와 연동되어 러닝을 시작합니다",
        });
      } catch (error) {
        console.error(
          "[LiveRunning] Watch start failed, fallback to phone mode:",
          error
        );
        // 워치 시작 실패 시 폰 모드로 전환
        setWatchMode(false);
        requestAnimationFrame(() => {
          t.start();
        });
        setAlert({
          open: true,
          kind: "negative",
          title: "워치 연동 실패",
          message: "폰 모드로 시작합니다",
        });
      }
    } else {
      // 폰 전용 모드: 기존 로직
      requestAnimationFrame(() => {
        console.log("[LiveRunning] calling t.start() (phone mode)");
        t.start();
      });
      // 러닝 세션 시작 표시 -> 탭 네비 잠금에 사용
      try {
        await AsyncStorage.setItem(
          "@running_session",
          JSON.stringify({
            isRunning: true,
            sessionId: t.sessionId,
            startTime: Date.now(),
          })
        );
      } catch {}
      // 즉시 탭바 숨김 반영
      try {
        emitRunningSession(true);
      } catch {}
    }

    // 권한 요청은 비동기로 병렬 처리 (UI 차단 방지)
    backgroundRunning.requestNotificationPermission().catch(() => {});
  }, [watchMode, t, backgroundRunning]);

  // 러닝 상태 변경 시 제스처 차단 외 탭바 표시 상태도 동기화(이중 안전장치)
  useEffect(() => {
    const running = t.isRunning || watchRunning;
    try {
      emitRunningSession(!!running);
    } catch {}
  }, [t.isRunning, watchRunning]);

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
        console.log(
          "[LiveRunning] Stopping running session in doExitWithoutSave"
        );
        await t.stop();
      }

      await backgroundRunning.clearSession();

      // AsyncStorage 세션 정보도 제거
      try { await AsyncStorage.removeItem("@running_session"); } catch {}
      // 즉시 탭바 복귀
      try {
        emitRunningSession(false);
      } catch {}

      // 위치를 강제로 다시 가져오기 (메인 페이지로 돌아갈 때를 위해)
      console.log(
        "[LiveRunning] Attempting to refresh location before exiting..."
      );
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        console.log(
          "[LiveRunning] Successfully refreshed location in doExitWithoutSave:",
          loc.coords
        );
      } catch (err) {
        console.warn(
          "[LiveRunning] Failed to refresh location before exiting:",
          err
        );
      }
    } catch (e) {
      console.error("[LiveRunning] Error during pre-exit cleanup:", e);
    }

    // 워치 모드 리셋
    setWatchMode(false);
    setWatchRunning(false);
    setWatchData(null);
    setWatchCompleteData(null);
    setWatchRoutePoints([]);

    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace("MainTabs"));
    } else {
      const rootParent = navigation?.getParent?.()?.getParent?.();
      if (rootParent && typeof rootParent.dispatch === "function") {
        rootParent.dispatch(StackActions.replace("MainTabs"));
      } else {
        navigation?.navigate?.("MainTabs", { screen: "LiveRunningScreen" });
      }
    }

    requestAnimationFrame(async () => {
      try {
        await backgroundRunning.stopForegroundService();
        // t.stop()은 이미 위에서 호출되었으므로 중복 호출 방지
        // if (!watchMode) {
        //   await t.stop();
        // }
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
        const distanceMeters =
          watchCompleteData.totalDistanceMeters ||
          watchCompleteData.distanceMeters ||
          0;
        const distanceKm = distanceMeters / 1000;
        const avgPaceSec = watchCompleteData.averagePaceSeconds || null;
        const calories = watchCompleteData.calories || 0;
        const durationSec = watchCompleteData.durationSeconds || 0;

        // routePoints 처리: watchCompleteData에서 가져오거나 실시간 누적된 watchRoutePoints 사용
        let routePointsForSummary = [];
        if (
          watchCompleteData.routePoints &&
          Array.isArray(watchCompleteData.routePoints) &&
          watchCompleteData.routePoints.length > 0
        ) {
          routePointsForSummary = watchCompleteData.routePoints.map(
            (p: any) => ({
              latitude: p.latitude,
              longitude: p.longitude,
            })
          );
          console.log(
            "[LiveRunning] Using routePoints from watchCompleteData:",
            routePointsForSummary.length
          );
        } else if (watchRoutePoints.length > 0) {
          routePointsForSummary = watchRoutePoints;
          console.log(
            "[LiveRunning] Using accumulated watchRoutePoints:",
            routePointsForSummary.length
          );
        } else {
          console.warn("[LiveRunning] No route points available");
        }

        await backgroundRunning.stopForegroundService();
        await backgroundRunning.clearSession();

        // watchMode 리셋
        setWatchMode(false);
        setWatchCompleteData(null);
        setWatchRoutePoints([]);

        // 테스트/개발 강제 표시 제거: 실제 수여 시에만 별도 처리

        // 러닝 종료 → 탭바 재표시
        try {
          emitRunningSession(false);
        } catch {}
        // 네비게이션 안전 가드
        const go = (params: any) => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("RunSummary" as never, params as never);
          } else {
            navigation?.navigate?.("RunSummary", params);
          }
        };
        go({
          runId: watchCompleteData.runId || null, // watchSync.ts에서 apiComplete 결과로 받은 runId
          defaultTitle: "오늘의 러닝",
          distanceKm,
          paceLabel: avgPaceSec
            ? `${Math.floor(avgPaceSec / 60)}:${String(
                avgPaceSec % 60
              ).padStart(2, "0")}`
            : "--:--",
          kcal: calories,
          elapsedSec: durationSec,
          elapsedLabel: `${Math.floor(durationSec / 60)}:${String(
            durationSec % 60
          ).padStart(2, "0")}`,
          routePath: routePointsForSummary,
          sessionId: watchCompleteData.sessionId || "",
        });
      } else {
        // 폰 모드: 기존 로직
        const avgPaceSec =
          t.distance > 0 && Number.isFinite(t.elapsedSec / t.distance)
            ? Math.floor(t.elapsedSec / Math.max(t.distance, 0.000001))
            : null;
        const routePoints = t.route.map((p, i) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          sequence: i + 1,
        }));

        // sessionId가 null인 경우 기본값 생성 (세션 생성이 완료되지 않은 경우)
        const sessionId = t.sessionId || `phone-${Date.now()}`;
        if (!t.sessionId) {
          console.warn(
            "[LiveRunning] sessionId is null, using fallback:",
            sessionId
          );
        }

        const completeRes = await apiComplete({
          sessionId: sessionId,
          distanceMeters: Math.round(t.distance * 1000),
          durationSeconds: t.elapsedSec,
          averagePaceSeconds: avgPaceSec,
          calories: Math.round(t.kcal),
          routePoints,
          endedAt: Date.now(),
          title: "오늘의 러닝",
        });

        const runId = completeRes.runId;
        const awards = (completeRes as any)?.data?.emblemAwardResult;
        // Extra client-side 10m emblem award (if backend didn't automatically)
        let extraAwarded = false;
        try {
          if (t.distance >= 0.01) {
            const res = await awardEmblemByCode("DIST_10M");
            extraAwarded = Boolean(res.awarded);
          }
        } catch {}
        if ((awards && Number(awards.awarded_count) > 0) || extraAwarded) {
          const baseCount = Number(awards?.awarded_count || 0);
          setCelebrate({ visible: true, count: Math.max(1, baseCount + (extraAwarded ? 1 : 0)) });
          await new Promise((r) => setTimeout(r, 2500));
          setCelebrate({ visible: false });
        }

        await backgroundRunning.stopForegroundService();
        await backgroundRunning.clearSession();
        await t.stop();
        // 러닝 종료 → 탭바 재표시
        try {
          emitRunningSession(false);
        } catch {}
        const go2 = (params: any) => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("RunSummary" as never, params as never);
          } else {
            navigation?.navigate?.("RunSummary", params);
          }
        };
        go2({
          runId,
          defaultTitle: "오늘의 러닝",
          distanceKm: t.distance,
          paceLabel: t.paceLabel,
          kcal: Math.round(t.kcal),
          elapsedSec: t.elapsedSec,
          elapsedLabel: `${Math.floor(t.elapsedSec / 60)}:${String(
            t.elapsedSec % 60
          ).padStart(2, "0")}`,
          routePath: t.route,
          sessionId: (t.sessionId as string) ?? "",
        });
      }
    } catch (e) {
      console.error("러닝 완료/저장 실패:", e);
      setAlert({
        open: true,
        kind: "negative",
        title: "저장 실패",
        message: "네트워크 또는 서버 오류가 발생했어요.",
      });
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

  // 러닝 시작 시 네비게이션 비활성화 (뒤로가기/제스처 차단)
  useEffect(() => {
    try {
      navigation?.setOptions?.({
        gestureEnabled: !(t.isRunning || watchRunning),
      });
    } catch {}
    const onBeforeRemove = (e: any) => {
      if (t.isRunning || watchRunning) {
        e.preventDefault();
      }
    };
    const unsub = navigation?.addListener?.("beforeRemove", onBeforeRemove);
    return () => {
      try {
        unsub && unsub();
      } catch {}
    };
  }, [navigation, t.isRunning, watchRunning]);

  return (
    <SafeLayout withBottomInset>
      {alert.open && alert.kind === "positive" && (
        <PositiveAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
      )}
      {alert.open && alert.kind === "negative" && (
        <NegativeAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
      )}
      {alert.open && alert.kind === "message" && (
        <MessageAlert
          visible
          title={alert.title}
          message={alert.message}
          onClose={() => setAlert({ open: false, kind: "message" })}
        />
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

      {paceCoachMessage && (
        <View style={styles.paceCoachBanner}>
          <Text style={styles.paceCoachBannerTitle}>페이스 알림</Text>
          <Text style={styles.paceCoachBannerText}>{paceCoachMessage}</Text>
        </View>
      )}
      <MapRoute
        key={mapKey}
        route={watchMode && watchRunning ? watchRoutePoints : t.route}
        last={
          watchMode && watchRunning && watchRoutePoints.length > 0
            ? watchRoutePoints[watchRoutePoints.length - 1]
            : t.last
        }
        liveMode
        onBindCenter={t.bindMapCenter}
        onBindForceCenter={(fn) => { forceCenterRef.current = fn; }}
        onBindSnapshot={(fn) => {
          snapshotFnRef.current = fn;
        }}
        useCurrentLocationOnMount
        onMapReady={() => setMapReady(true)}
      />

      {/* 현 위치로 돌아오기 버튼: 러닝 중에만 표시, 좌상단 */}
      {(t.isRunning || watchRunning) && (
      <TouchableOpacity
        onPress={async () => {
          try {
            let perm = await Location.getForegroundPermissionsAsync();
            if (perm.status !== "granted") {
              perm = await Location.requestForegroundPermissionsAsync();
              if (perm.status !== "granted") return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            // 강제 센터 이동 바인딩이 있으면 우선 사용
            if (forceCenterRef.current) {
              forceCenterRef.current(p);
            } else if (t.bindMapCenter) {
              // 폴백: 일반 바인딩 (사용자 제스처로 잠시 무시될 수 있음)
              t.bindMapCenter(p as any);
            }
          } catch (e) {
            console.warn('[LiveRunning] recenter failed', e);
          }
        }}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          left: 16,
          top: Math.max(insets.top, 12) + 70,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "rgba(255,255,255,0.95)",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.06)",
        }}
        accessibilityRole="button"
        accessibilityLabel="현 위치로 이동"
      >
        <Ionicons name="locate" size={20} color="#111827" />
      </TouchableOpacity>
      )}

      {/* 상단 비네팅 효과 */}
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 1)",
          "rgba(255, 255, 255, 0.7)",
          "transparent",
        ]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 180,
          pointerEvents: "none",
        }}
      />

      {/* 좌우 비네팅 효과 */}
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0.9)",
          "transparent",
          "rgba(255, 255, 255, 0.9)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
        }}
      />

      {/* 하단 비네팅 효과 */}
      <LinearGradient
        colors={[
          "transparent",
          "rgba(255, 255, 255, 0.6)",
          "rgba(255, 255, 255, 1)",
        ]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 200,
          pointerEvents: "none",
        }}
      />

      {/* 상단 위치 + 날씨 - 러닝 중이 아닐 때만 표시 */}
      {!t.isRunning && !watchRunning && (
        <>
          {/* 상단 중앙: 위치명 + 온도 + 날씨 아이콘 (확장/축소 애니메이션) */}
          {(locationName || weather?.temperature !== undefined) && (
            <TouchableOpacity
              onPress={toggleWeather}
              style={styles.topWeatherContainer}
              activeOpacity={0.7}
            >
              <View style={styles.topWeatherContent}>
                {/* 기본 표시: 위치 + 온도 + 이모지 (확장 시 숨김) */}
                {!weatherExpanded && (
                  <Animated.View
                    style={[
                      styles.topWeatherCompact,
                      { opacity: weatherExpanded ? 0 : 1 }
                    ]}
                  >
                    <Text style={styles.topWeatherText}>
                      {locationName || ""}
                      {locationName && weather?.temperature !== undefined ? " " : ""}
                      {weather?.temperature !== undefined ? `${Math.round(weather.temperature)}°` : ""}
                    </Text>
                    {weather?.emoji && (
                      <Text style={styles.topWeatherEmoji}>{weather.emoji}</Text>
                    )}
                  </Animated.View>
                )}

                {/* 확장 시 표시: 추천 메시지 (기본 상태에서 숨김) */}
                {weatherExpanded && weather?.recommendation && (
                  <Animated.View
                    style={[
                      styles.topWeatherExpanded,
                      { opacity: weatherAnimOpacity }
                    ]}
                  >
                    <Text style={styles.weatherRecommendationText}>
                      {weather.recommendation}
                    </Text>
                  </Animated.View>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* 탭 */}
          <View
            style={{
              position: "absolute",
              top: Math.max(insets.top, 12) + 50,
              left: 20,
              zIndex: 10,
            }}
          >
            <View style={styles.segmentControl}>
              <TouchableOpacity
                style={styles.segmentButton}
                onPress={() => setActiveTab("running")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === "running" && styles.segmentTextActive,
                  ]}
                >
                  러닝
                </Text>
                {activeTab === "running" && (
                  <View style={styles.segmentUnderline} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.segmentButton}
                onPress={() => setActiveTab("journey")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentText,
                    activeTab === "journey" && styles.segmentTextActive,
                  ]}
                >
                  여정 러닝
                </Text>
                {activeTab === "journey" && (
                  <View style={styles.segmentUnderline} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {(t.isRunning || t.isPaused || watchRunning) && (
        <RunStatsCard
          distanceKm={
            watchMode && watchData
              ? watchData.distanceMeters / 1000
              : t.distance
          }
          paceLabel={
            watchMode && watchData && watchData.averagePaceSeconds
              ? `${Math.floor(watchData.averagePaceSeconds / 60)}:${String(
                  watchData.averagePaceSeconds % 60
                ).padStart(2, "0")}`
              : t.paceLabel
          }
          kcal={watchMode && watchData ? watchData.calories : t.kcal}
          speedKmh={t.speedKmh}
          elapsedSec={
            watchMode && watchData ? watchData.durationSeconds : t.elapsedSec
          }
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
        <>
          {/* AI 페이스 코치 버튼 (시작 버튼 왼쪽) */}
          <TouchableOpacity
            onPress={handlePaceCoachToggle}
            style={[
              styles.startPaceCoachButton,
              {
                position: "absolute",
                left: "50%",
                bottom: bottomSafe + 136, // 시작 텍스트와 같은 높이
                marginLeft: -105, // 더 왼쪽으로 간격
              }
            ]}
            activeOpacity={0.7}
          >
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={isPaceCoachEnabled ? "speedometer" : "speedometer-outline"}
                size={22}
                color="#111827"
              />
              {!isPaceCoachEnabled && (
                <View style={styles.startDisabledSlash} />
              )}
            </View>
          </TouchableOpacity>

          {/* 시작 버튼 (중앙) */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: bottomSafe + 130,
              alignItems: "center",
            }}
          >
            <TouchableOpacity
              onPress={() => {
                if (activeTab === "running") {
                  handleRunningStart();
                } else {
                  // Tab Navigator에서 Root Stack으로 이동
                  if (navigationRef.isReady()) {
                    navigationRef.navigate("JourneyRouteList" as never);
                  } else {
                    // fallback: parent navigation 사용
                    const parentNav = navigation.getParent?.();
                    if (parentNav) {
                      parentNav.navigate("JourneyRouteList");
                    } else {
                      navigation.navigate("JourneyRouteList");
                    }
                  }
                }
              }}
              disabled={
                activeTab === "running" && (!t.isReady || t.isInitializing)
              }
              style={{
                width: 85,
                height: 85,
                borderRadius: 42.5,
                backgroundColor:
                  activeTab === "running" && (!t.isReady || t.isInitializing)
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
                  color:
                    activeTab === "running" && (!t.isReady || t.isInitializing)
                      ? "rgba(255, 255, 255, 0.5)"
                      : "#FFFFFF",
                  textAlign: "center",
                }}
              >
                {activeTab === "running"
                  ? !t.isReady
                    ? "준비중"
                    : t.isInitializing
                    ? "시작중"
                    : "시작"
                  : "여정"}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {(t.isRunning || watchRunning) && !watchMode && (
        <RunPlayControls
          isRunning={t.isRunning}
          isPaused={t.isPaused}
          onPlay={() => t.start()}
          onPause={() => t.pause()}
          onResume={() => t.resume()}
          onStopTap={() =>
            setAlert({
              open: true,
              kind: "message",
              title: "안내",
              message: "종료하려면 길게 누르세요",
            })
          }
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
          <Text
            style={{
              fontSize: 14,
              color: "rgba(0,0,0,0.6)",
              backgroundColor: "rgba(255,255,255,0.9)",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
            }}
          >
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

      {/* Celebration overlay should render last to ensure topmost stacking */}
      {celebrate.visible && <EmblemCelebration count={celebrate.count} />}
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  segmentControl: {
    flexDirection: "row",
    gap: 4,
  },
  segmentButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'relative',
  },
  segmentText: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(17, 24, 39, 0.5)",
  },
  segmentTextActive: {
    color: "#111827",
    fontWeight: "800",
  },
  segmentUnderline: {
    position: 'absolute',
    bottom: 4,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: "#111827",
    borderRadius: 1.5,
  },
  startPaceCoachButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  startDisabledSlash: {
    position: 'absolute',
    top: 11,
    left: 11,
    width: 29,
    height: 2.5,
    backgroundColor: '#111827',
    transform: [{ translateX: -14.5 }, { translateY: -1.25 }, { rotate: '-45deg' }],
    borderRadius: 1.5,
  },
  disabledSlash: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 28,
    height: 2,
    backgroundColor: '#EF4444',
    transform: [{ translateX: -14 }, { translateY: -1 }, { rotate: '-45deg' }],
    borderRadius: 1,
  },
  topWeatherContainer: {
    position: "absolute",
    top: 35,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 20,
  },
  topWeatherContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  topWeatherCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  topWeatherText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  topWeatherEmoji: {
    fontSize: 18,
  },
  topWeatherExpanded: {
    paddingVertical: 4,
  },
  weatherRecommendationText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 16,
    textAlign: "center",
  },
  paceCoachBanner: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    padding: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDBA74",
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  paceCoachBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#C2410C",
    marginBottom: 4,
  },
  paceCoachBannerText: {
    fontSize: 12,
    color: "#7C2D12",
  },
});
