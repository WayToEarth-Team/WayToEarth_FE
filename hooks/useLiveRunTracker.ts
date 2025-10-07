import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import {
  createKalman2D,
  kalmanInit,
  kalmanPredict,
  kalmanUpdate,
  projectToMeters,
  unprojectFromMeters,
} from "../utils/filters/kalman2d";
import { WAY_LOCATION_TASK } from "../utils/backgroundLocation";
import type { LatLng } from "../types/types";
import { distanceKm } from "../utils/geo";
import { fmtMMSS, avgPaceSecPerKm, caloriesKcal } from "../utils/run";
import { apiStart, apiUpdate, apiPause, apiResume, apiStartSession } from "../utils/api/running";

type TimerId = ReturnType<typeof setInterval>;
type Sample = { t: number; p: LatLng; a?: number; s?: number };

const UPDATE_MIN_MS = 5000; // 5초 간격
const UPDATE_MIN_KM = 0.05; // 50m 이동

// 두 점 사이 거리(m)
const toMeters = (a: LatLng, b: LatLng) => distanceKm(a, b) * 1000;

export function useLiveRunTracker(runningType: "SINGLE" | "JOURNEY" = "SINGLE") {
  // ── 상태
  const [route, setRoute] = useState<LatLng[]>([]);
  const [distance, setDistance] = useState(0); // km
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [weightKg] = useState(65);

  // ✅ 준비 상태
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);

  // ── refs
  const prev = useRef<LatLng | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const elapsedTimerRef = useRef<TimerId | null>(null);
  const mapCenterRef = useRef<((p: LatLng) => void) | undefined>(undefined);
  const appStateRef = useRef<string>(AppState.currentState);
  const recentRef = useRef<Sample[]>([]);
  const pausedRef = useRef(false);
  const prevAccRef = useRef<number | null>(null); // m
  const kfRef = useRef<ReturnType<typeof createKalman2D> | null>(null);
  const originRef = useRef<LatLng | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // 시간 계산: 시스템 시각 기반으로 일시정지 누적 반영
  const startEpochRef = useRef<number | null>(null); // ms
  const pausedAccumMsRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);

  // 세션 & 업데이트 쓰로틀
  const sessionIdRef = useRef<string | null>(null);
  const lastUpdateAtRef = useRef<number>(0);
  const lastUpdateDistanceRef = useRef<number>(0);

  // 거리/시퀀스 최신값 ref (쓰로틀 계산 정확도 개선)
  const distanceRef = useRef(0); // km
  const seqRef = useRef(0); // route point sequence

  // ✅ 캐시된 위치
  const cachedLocationRef = useRef<LatLng | null>(null);

  // 노이즈 여부 판단
  const shouldIgnoreSample = (
    prevP: LatLng | null,
    cur: Location.LocationObject
  ) => {
    const acc = cur.coords.accuracy ?? 999; // m
    const spd = cur.coords.speed ?? null; // m/s
    // 정확도 너무 나쁘면 제외(완화)
    if (acc > 65) return true;

    if (!prevP) return false; // 첫 포인트 수락
    const p = {
      latitude: cur.coords.latitude,
      longitude: cur.coords.longitude,
    };
    const seg = toMeters(prevP, p);
    // 이동 최소 임계치(완화)
    const minMove = Math.max(1.5, Math.min(acc * 0.3, 3));
    if (seg < minMove) return true;
    // 정지에 가까운 속도에서의 미세 흔들림 제거
    if (typeof spd === "number" && spd >= 0 && spd < 0.6) {
      if (seg < Math.max(2, Math.min(acc * 0.5, 4))) return true;
    }
    return false;
  };

  // 앱 시작시 GPS 준비
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      appStateRef.current = s;
    });
    const prepareGPS = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          cachedLocationRef.current = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        }
        setIsReady(true);
      } catch (error) {
        console.warn("GPS 준비 실패:", error);
        setIsReady(true);
      }
    };
    prepareGPS();
    return () => {
      stop();
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const centerMap = (p: LatLng) => mapCenterRef.current?.(p);

  /** 포인트 반영 + 속도/거리 갱신 + 주기 업데이트 전송 */
  const pushPoint = async (p: LatLng, acc?: number, spd?: number) => {
    const now = Date.now();

    // ── 거리 계산(스파이크 필터)
    let newDistanceKm = distanceRef.current;
    if (prev.current) {
      const segKm = distanceKm(prev.current, p);
      const dtSec =
        recentRef.current.length > 0
          ? (now - recentRef.current[recentRef.current.length - 1].t) / 1000
          : 1;
      const mps = (segKm * 1000) / Math.max(dtSec, 0.001);
      // 속도 스파이크 필터(완화 → 강화): 6.5 m/s 초과는 노이즈로 간주
      if (mps <= 6.5) {
        // 정확도 기반 거리 보정(완화): 세그먼트의 30%, 평균 정확도의 10%, 절대 1.5m 중 최소만 차감
        const prevAcc = prevAccRef.current ?? acc ?? 0;
        const curAcc = acc ?? prevAccRef.current ?? 0;
        const segM = segKm * 1000;
        const avgAcc = (prevAcc + curAcc) / 2;
        const noiseAllowanceM = Math.min(1.5, 0.1 * avgAcc, 0.3 * segM);
        const effM = Math.max(0, segM - noiseAllowanceM);
        newDistanceKm = distanceRef.current + effM / 1000;
      }
    } else {
      newDistanceKm = 0;
    }

    // 상태/refs 갱신
    distanceRef.current = newDistanceKm;
    setDistance(newDistanceKm);
    prev.current = p;
    seqRef.current += 1;
    setRoute((cur) => (cur.length ? [...cur, p] : [p]));

    // 최근 5초 평균 속도
    recentRef.current.push({ t: now, p, a: acc, s: spd });
    const cutoff = now - 5000;
    while (recentRef.current.length && recentRef.current[0].t < cutoff) {
      recentRef.current.shift();
    }
    const arr = recentRef.current;
    if (arr.length >= 2) {
      const dt = (arr[arr.length - 1].t - arr[0].t) / 1000; // s
      const dk = distanceKm(arr[0].p, arr[arr.length - 1].p); // km
      setSpeedKmh(dt > 0 ? (dk / dt) * 3600 : 0);
    }

    if (appStateRef.current === "active") {
      centerMap(p);
    }
    if (typeof acc === "number") prevAccRef.current = acc;

    // ── 주기 업데이트 (세션 있을 때만)
    const sid = sessionIdRef.current;
    if (!sid) return;

    const msEnough = now - lastUpdateAtRef.current >= UPDATE_MIN_MS;
    const kmEnough =
      distanceRef.current - lastUpdateDistanceRef.current >= UPDATE_MIN_KM;

    if (msEnough || kmEnough) {
      try {
        const paceSec = avgPaceSecPerKm(distanceRef.current, elapsedSec);
        console.log("[RunTracker] 주기 업데이트 전송:", {
          sessionId: sid,
          distanceKm: distanceRef.current.toFixed(3),
          durationSec: elapsedSec,
          sequence: seqRef.current,
        });
        await apiUpdate({
          sessionId: sid,
          distanceMeters: Math.round(distanceRef.current * 1000),
          durationSeconds: elapsedSec,
          averagePaceSeconds: isFinite(paceSec) ? Math.floor(paceSec) : null,
          calories: caloriesKcal(distanceRef.current, weightKg),
          currentPoint: {
            latitude: p.latitude,
            longitude: p.longitude,
            sequence: seqRef.current,
            t: Math.floor(now / 1000),
          },
        });
        lastUpdateAtRef.current = now;
        lastUpdateDistanceRef.current = distanceRef.current;
        console.log("[RunTracker] 주기 업데이트 성공");
      } catch (e) {
        console.error("[RunTracker] 주기 업데이트 실패:", e);
        // 조용히 무시(다음 주기 때 재시도)
      }
    }
  };

  /** 타이머: 시스템 시각 기반 경과시간 산출 */
  const startElapsed = () => {
    if (elapsedTimerRef.current) return;
    elapsedTimerRef.current = setInterval(() => {
      const startMs = startEpochRef.current ?? Date.now();
      const pausedMs = pausedAccumMsRef.current + (pausedAtRef.current ? (Date.now() - pausedAtRef.current) : 0);
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs - pausedMs) / 1000));
      setElapsedSec(elapsed);
    }, 1000);
  };
  const stopElapsed = () => {
    if (!elapsedTimerRef.current) return;
    clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
  };

  /** ✅ 최적화된 시작 */
  const start = async () => {
    console.log("[RunTracker] start() invoked");
    if (isInitializing) return; // 중복 방지
    setIsInitializing(true);

    try {
      // 1) 권한: 먼저 현재 상태 확인 후, 필요 시에만 요청
      let perm = await Location.getForegroundPermissionsAsync();
      console.log("[RunTracker] location perm status(before):", perm?.status);
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
        console.log("[RunTracker] location perm status(after):", perm?.status);
        if (perm.status !== "granted") {
          console.warn("[RunTracker] location permission denied");
          setIsInitializing(false);
          return;
        }
      }

      try {
        // @ts-ignore (iOS only)
        await Location.setActivityTypeAsync?.(Location.ActivityType.Fitness);
      } catch {}

      // 2) 상태 초기화 (초기 위치는 첫 watch 콜백에서 세팅)
      startEpochRef.current = Date.now();
      pausedAccumMsRef.current = 0;
      pausedAtRef.current = null;
      const seed = cachedLocationRef.current ?? null;
      if (seed) {
        setRoute([seed]);
        prev.current = seed;
        recentRef.current = [{ t: Date.now(), p: seed }];
        centerMap(seed);
      } else {
        setRoute([]);
        prev.current = null;
        recentRef.current = [];
      }
      distanceRef.current = 0;
      setDistance(0);
      setSpeedKmh(0);
      setElapsedSec(0);
      seqRef.current = 0;

      pausedRef.current = false;
      setIsPaused(false);
      setIsRunning(true);
      console.log("[RunTracker] state set to running");
      startElapsed();

      // 세션 생성 (백엔드 API 호출)
      (async () => {
        try {
          // 1. 로컬 세션 ID 생성
          const localSessionId = `session_${Date.now()}`;
          console.log("[RunTracker] 세션 생성 시도:", { localSessionId, runningType });

          // 2. 백엔드에 세션 시작 알림
          const sess = await apiStart({
            sessionId: localSessionId,
            runningType: runningType
          });

          sessionIdRef.current = sess.sessionId ?? localSessionId;
          lastUpdateAtRef.current = 0;
          lastUpdateDistanceRef.current = 0;
          console.log("[RunTracker] 세션 시작 완료:", {
            sessionId: sessionIdRef.current,
            response: sess
          });
        } catch (e) {
          console.error("[RunTracker] 세션 생성 실패:", e);
          console.error("[RunTracker] 에러 상세:", JSON.stringify(e, null, 2));
          // 백엔드 실패 시에도 로컬 세션으로 계속
          sessionIdRef.current = `local_${Date.now()}`;
          console.log("[RunTracker] 로컬 세션으로 폴백:", sessionIdRef.current);
        }
      })();

      // 위치 스트림(백그라운드)
      (async () => {
        try {
          subRef.current?.remove?.();
          subRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Highest,
              timeInterval: 1000,
              distanceInterval: 2,
            },
            (loc) => {
              // console trace for incoming points
              // Avoid noisy logs: only print every ~5s via recentRef length
              // Here minimal log to confirm callback wiring
              // console.log("[RunTracker] location update received");
              if (pausedRef.current) return;
              // 🔒 노이즈 필터
              if (shouldIgnoreSample(prev.current, loc)) return;

              const raw = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              } as LatLng;

              // Kalman smoothing in local meters frame
              const nowTs = Date.now();
              if (!originRef.current) originRef.current = raw;
              const origin = originRef.current!;
              const meas = projectToMeters(origin, raw);
              if (!kfRef.current) {
                kfRef.current = createKalman2D(0.1, Math.max(3, loc.coords.accuracy || 5));
                kalmanInit(kfRef.current, meas);
                lastTsRef.current = nowTs;
              } else {
                const dt = lastTsRef.current ? Math.max(0.05, (nowTs - lastTsRef.current) / 1000) : 1;
                kalmanPredict(kfRef.current, dt);
                const rMeas = Math.max(3, loc.coords.accuracy || 5);
                kalmanUpdate(kfRef.current, meas, rMeas);
                lastTsRef.current = nowTs;
              }
              const kf = kfRef.current!;
              const filtered = unprojectFromMeters(origin, { x: kf.x[0], y: kf.x[1] });

              // 첫 포인트라면 초기 상태 세팅
              if (!prev.current && route.length === 0) {
                prev.current = filtered;
                setRoute([filtered]);
                recentRef.current = [{ t: Date.now(), p: filtered }];
                centerMap(filtered);
              } else {
                pushPoint(
                  filtered,
                  loc.coords.accuracy,
                  loc.coords.speed ?? undefined
                );
              }
            }
          );

          // Start background location updates (OS-managed foreground service)
          try {
            // Ensure background location permission (Android 10+ requires "항상 허용")
            const bg = await Location.getBackgroundPermissionsAsync();
            if (bg.status !== 'granted') {
              const req = await Location.requestBackgroundPermissionsAsync();
              console.log('[BG-LOC] request background perm:', req.status);
            }

            const hasTask = await Location.hasStartedLocationUpdatesAsync(WAY_LOCATION_TASK);
            if (!hasTask) {
              console.log('[BG-LOC] starting background updates');
              await Location.startLocationUpdatesAsync(WAY_LOCATION_TASK, {
                // 백그라운드에서는 리소스 사용을 줄여 안정성을 높입니다.
                accuracy: Location.Accuracy.High,
                timeInterval: 3000,
                distanceInterval: 5,
                showsBackgroundLocationIndicator: false,
                pausesUpdatesAutomatically: false,
                foregroundService: {
                  notificationTitle: '러닝 진행 중',
                  notificationBody: '앱을 열어 진행 상태를 확인하세요',
                },
              } as any);
            } else {
              console.log('[BG-LOC] background updates already running');
            }
          } catch (e) {
            console.warn('[BG-LOC] start failed:', e);
          }
        } catch (e) {
          console.warn("위치 스트림 설정 실패:", e);
        }
      })();
    } catch (e) {
      console.error("러닝 시작 실패:", e);
      setIsRunning(false);
    } finally {
      setIsInitializing(false);
    }
  };

  /** 일시정지 */
  const pause = async () => {
    if (!isRunning || isPaused) return;
    pausedRef.current = true;
    setIsPaused(true);
    pausedAtRef.current = Date.now();
    stopElapsed();
    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await apiPause({ sessionId: sid });
      } catch {}
    }
  };

  /** 재개 */
  const resume = async () => {
    if (!isRunning || !isPaused) return;
    pausedRef.current = false;
    setIsPaused(false);
    if (pausedAtRef.current) {
      pausedAccumMsRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    startElapsed();
    const sid = sessionIdRef.current;
    if (sid) {
      try {
        await apiResume({ sessionId: sid });
      } catch {}
    }
  };

  /** 종료(센서 정리만) */
  const stop = () => {
    subRef.current?.remove?.();
    subRef.current = null;
    stopElapsed();
    setIsRunning(false);
    setIsPaused(false);
    setIsInitializing(false);
    pausedRef.current = false;
    startEpochRef.current = null;
    pausedAccumMsRef.current = 0;
    pausedAtRef.current = null;
    // Stop background updates
    Location.hasStartedLocationUpdatesAsync(WAY_LOCATION_TASK)
      .then((v) => (v ? Location.stopLocationUpdatesAsync(WAY_LOCATION_TASK) : undefined))
      .catch(() => {});
  };

  // 파생값
  const last = route[route.length - 1] ?? null;
  const paceSec = avgPaceSecPerKm(distance, elapsedSec);
  const paceLabel = isFinite(paceSec) ? fmtMMSS(paceSec) : "--:--";
  const kcal = caloriesKcal(distance, weightKg);

  // 맵 카메라 바인딩
  const bindMapCenter = (fn: (p: LatLng) => void) =>
    (mapCenterRef.current = fn);

  return {
    // 상태
    route,
    distance,
    last,
    isRunning,
    isPaused,
    elapsedSec,
    paceLabel,
    kcal,
    speedKmh,

    // 준비 상태
    isReady,
    isInitializing,

    // 제어
    start,
    pause,
    resume,
    stop,

    // 바인딩
    bindMapCenter,

    // 세션ID (요약 저장용)
    get sessionId() {
      return sessionIdRef.current;
    },
  };
}
