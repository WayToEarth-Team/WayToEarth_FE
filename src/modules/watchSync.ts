// src/modules/watchSync.ts
// Wear bridge + Server API orchestration with logging

import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import {
  apiStart,
  apiUpdate,
  apiPause,
  apiResume,
  apiComplete,
} from '../../utils/api/running';
import { caloriesKcal } from '../../utils/run';

const { WayToEarthWear } = NativeModules as any;
const emitter = new NativeEventEmitter(WayToEarthWear);

const debugLog = (...args: any[]) => { if (__DEV__) { try { console.log(...args); } catch {} } };

export type RunningType = 'SINGLE' | 'JOURNEY' | 'CREW' | string;

export interface RealtimeRunningData {
  sessionId: string;
  distanceMeters: number;
  durationSeconds: number;
  heartRate?: number;
  paceSeconds?: number;
  averagePaceSeconds?: number;
  calories: number;
  currentPoint?: {
    latitude: number;
    longitude: number;
    sequence?: number;
    t?: number;
    acc?: number;
  };
  timestamp: number;
}

let inited = false;
let subs: EmitterSubscription[] = [];

// Keep last session id for convenience
let currentSessionId: string | null = null;

// Realtime data state for UI
let realtimeData: RealtimeRunningData | null = null;
let realtimeListeners: ((data: RealtimeRunningData) => void)[] = [];

// Ensure listeners are set once
export function initWatchSync() {
  if (inited) return;
  inited = true;

  subs.push(
    emitter.addListener('wearStarted', (s: string) => {
      try { debugLog('[WEAR EVT] started:', s); } catch {}
    }),
    emitter.addListener('wearStopped', (s: string) => {
      try { debugLog('[WEAR EVT] stopped:', s); } catch {}
    }),
    emitter.addListener('wearPaused', (s: string) => {
      try {
        debugLog('[WEAR EVT] paused:', s);
        const p = JSON.parseSafe(s);
        if (p?.sessionId) apiPause({ sessionId: p.sessionId }).catch(err => debugLog('[API ERR] pause:', err?.message));
      } catch (e) { debugLog('[EVT ERR] wearPaused parse:', (e as Error).message); }
    }),
    emitter.addListener('wearResumed', (s: string) => {
      try {
        debugLog('[WEAR EVT] resumed:', s);
        const p = JSON.parseSafe(s);
        if (p?.sessionId) apiResume({ sessionId: p.sessionId }).catch(err => debugLog('[API ERR] resume:', err?.message));
      } catch (e) { debugLog('[EVT ERR] wearResumed parse:', (e as Error).message); }
    }),
    emitter.addListener('wearRealtimeUpdate', (s: string) => {
      try {
        // Wear payload
        // { sessionId, distanceMeters, durationSeconds, heartRate, paceSeconds, averagePaceSeconds, calories, currentPoint{lat,lon,sequence(1-based),t,acc}, timestamp }
        const p = JSON.parseSafe(s);
        if (!p || !p.sessionId) { return; }
        const sessionId: string = p.sessionId;
        const distanceMeters: number = Number(p.distanceMeters) || 0;
        const durationSeconds: number = Number(p.durationSeconds) || 0;
        const averagePaceSeconds: number | null = isFinite(Number(p.averagePaceSeconds)) ? Number(p.averagePaceSeconds) : (distanceMeters>0? Math.round(durationSeconds / (distanceMeters/1000)): null);
        const calories = isFinite(Number(p.calories)) ? Number(p.calories) : caloriesKcal(distanceMeters/1000, durationSeconds);
        const heartRate = isFinite(Number(p.heartRate)) ? Number(p.heartRate) : undefined;
        const paceSeconds = isFinite(Number(p.paceSeconds)) ? Number(p.paceSeconds) : undefined;
        const cp = p.currentPoint || {};
        const latRaw = Number(cp.latitude);
        const lngRaw = Number(cp.longitude);
        const isFiniteNum = (v: any) => typeof v === 'number' && isFinite(v);
        const isValidLatLng = (lat: number, lng: number) =>
          isFiniteNum(lat) && isFiniteNum(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

        const hasValidPoint = isValidLatLng(latRaw, lngRaw);
        const currentPoint = hasValidPoint
          ? {
              latitude: latRaw,
              longitude: lngRaw,
              sequence: isFinite(Number(cp.sequence)) ? Number(cp.sequence) : undefined,
              t: isFinite(Number(cp.t)) ? Number(cp.t) : Math.floor(Date.now() / 1000),
              acc: isFinite(Number(cp.acc)) ? Number(cp.acc) : undefined,
            }
          : undefined as any;

        // Update realtime state for UI
        realtimeData = {
          sessionId,
          distanceMeters,
          durationSeconds,
          heartRate,
          paceSeconds,
          averagePaceSeconds: averagePaceSeconds ?? undefined,
          calories,
          currentPoint,
          timestamp: Number(p.timestamp) || Date.now(),
        };

        // Notify all listeners
        realtimeListeners.forEach(listener => {
          try {
            listener(realtimeData!);
          } catch (err) {
            debugLog('[UI ERR] realtime listener:', (err as Error).message);
          }
        });

        // Send to backend API (only when we have a valid currentPoint)
        if (currentPoint && isValidLatLng(currentPoint.latitude, currentPoint.longitude)) {
          const body = {
            sessionId,
            distanceMeters,
            durationSeconds,
            averagePaceSeconds,
            calories,
            currentPoint,
          } as any;
          debugLog('[API] running/update payload:', body);
          apiUpdate(body).catch(err => debugLog('[API ERR] update:', err?.message));
        } else {
          debugLog('[API] running/update skipped: invalid or missing currentPoint');
        }
      } catch (e) {
        debugLog('[EVT ERR] realtime parse:', (e as Error).message);
      }
    }),
    emitter.addListener('wearRunningComplete', (s: string) => {
      try {
        debugLog('[WEAR EVT] complete len=', s?.length);
        const run = JSON.parseSafe(s);
        if (!run || !run.sessionId) return;
        // Transform to apiComplete payload
        const distanceMeters = Number(run.totalDistanceMeters || run.distanceMeters || 0) || 0;
        const durationSeconds = Number(run.durationSeconds || 0) || 0;
        const averagePaceSeconds = isFinite(Number(run.averagePaceSeconds)) ? Number(run.averagePaceSeconds) : (distanceMeters>0? Math.round(durationSeconds/(distanceMeters/1000)): null);
        const calories = Number(run.calories || 0) || 0;
        const averageHeartRate = isFinite(Number(run.averageHeartRate)) ? Number(run.averageHeartRate) : null;
        const maxHeartRate = isFinite(Number(run.maxHeartRate)) ? Number(run.maxHeartRate) : null;
        const routePointsRaw: any[] = Array.isArray(run.routePoints) ? run.routePoints : [];
        const num = (v: any) => (isFinite(Number(v)) ? Number(v) : NaN);
        const isValidLatLng2 = (lat: number, lng: number) =>
          isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
        const routePoints = routePointsRaw
          .map((p, i) => {
            const lat = num(p.latitude);
            const lng = num(p.longitude);
            return {
              latitude: lat,
              longitude: lng,
              sequence: isFinite(Number(p.sequence)) ? Number(p.sequence) : i + 1,
              timestampSeconds: isFinite(Number(p.timestampSeconds)) ? Number(p.timestampSeconds) : undefined,
              heartRate: isFinite(Number(p.heartRate)) ? Number(p.heartRate) : undefined,
              paceSeconds: isFinite(Number(p.paceSeconds)) ? Number(p.paceSeconds) : undefined,
              altitude: isFinite(Number(p.altitude)) ? Number(p.altitude) : undefined,
              accuracy: isFinite(Number(p.accuracy)) ? Number(p.accuracy) : undefined,
              cumulativeDistanceMeters: isFinite(Number(p.cumulativeDistanceMeters)) ? Number(p.cumulativeDistanceMeters) : undefined,
            };
          })
          .filter((p) => isValidLatLng2(p.latitude, p.longitude))
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        const body = {
          sessionId: String(run.sessionId),
          distanceMeters,
          durationSeconds,
          averagePaceSeconds,
          calories,
          averageHeartRate,
          maxHeartRate,
          routePoints,
          endedAt: Date.now(),
        };
        debugLog('[API] running/complete payload:', { sessionId: body.sessionId, distanceMeters, durationSeconds, averagePaceSeconds, calories, averageHeartRate, maxHeartRate, count: routePoints.length });

        // Send to backend and store runId
        apiComplete(body)
          .then(result => {
            debugLog('[API OK] running/complete -> runId:', result?.runId);
            // runId를 complete data에 추가하고 별도 이벤트 발생
            if (result?.runId) {
              run.runId = result.runId;
              // runId를 별도로 알리는 이벤트 발생
              emitter.emit('wearRunIdReceived', JSON.stringify({
                sessionId: run.sessionId,
                runId: result.runId
              }));
            }
          })
          .catch(err => debugLog('[API ERR] complete:', err?.message));

        // Clear realtime data and notify listeners (running has ended)
        realtimeData = null;
        currentSessionId = null;
        debugLog('[WATCH] Running session cleared');
      } catch (e) {
        debugLog('[EVT ERR] complete parse:', (e as Error).message);
      }
    }),
  );
}

export async function startRunOrchestrated(runningType: RunningType, opts?: { journeyId?: number; sessionId?: string }) {
  if (!isWatchAvailable()) {
    throw new Error('Watch module is not available. Make sure the app is running on Android with watch support.');
  }

  initWatchSync();
  // 1) Server start to get/confirm sessionId
  const sessionId = opts?.sessionId || `phone-${Date.now()}`;
  try {
    const startRes = await apiStart({ sessionId, runningType: (runningType as any) || 'SINGLE', journeyId: opts?.journeyId });
    const sid = String(startRes?.sessionId || sessionId);
    currentSessionId = sid;
    debugLog('[API OK] running/start -> sessionId=', sid);
    // 2) Start watch session
    const ok = await WayToEarthWear.startWatchSession(sid, runningType);
    debugLog('[WEAR] start command sent ok=', ok);
    return sid;
  } catch (e: any) {
    debugLog('[ORCH ERR] startRunOrchestrated:', e?.message);
    throw e;
  }
}

export async function pauseRun(sessionId?: string) {
  if (!isWatchAvailable()) {
    debugLog('[ORCH WARN] pauseRun: Watch module not available');
    return false;
  }
  const sid = sessionId || currentSessionId; if (!sid) return false;
  try {
    const ok = await WayToEarthWear.pauseWatchSession(sid);
    debugLog('[WEAR] pause command sent ok=', ok);
    // 서버 동기화는 wearPaused 이벤트에서 호출됨(이중 호출 방지)
    return ok;
  } catch (e:any) { debugLog('[ORCH ERR] pause:', e?.message); return false; }
}

export async function resumeRun(sessionId?: string) {
  if (!isWatchAvailable()) {
    debugLog('[ORCH WARN] resumeRun: Watch module not available');
    return false;
  }
  const sid = sessionId || currentSessionId; if (!sid) return false;
  try {
    const ok = await WayToEarthWear.resumeWatchSession(sid);
    debugLog('[WEAR] resume command sent ok=', ok);
    // 서버 동기화는 wearResumed 이벤트에서 호출됨
    return ok;
  } catch (e:any) { debugLog('[ORCH ERR] resume:', e?.message); return false; }
}

export async function stopRun(sessionId?: string) {
  if (!isWatchAvailable()) {
    debugLog('[ORCH WARN] stopRun: Watch module not available');
    return false;
  }
  const sid = sessionId || currentSessionId; if (!sid) return false;
  try {
    const ok = await WayToEarthWear.stopWatchSession(sid);
    debugLog('[WEAR] stop command sent ok=', ok);
    // 서버 complete는 wearRunningComplete 이벤트에서 호출됨
    // Note: realtimeData will be cleared after wearRunningComplete event
    return ok;
  } catch (e:any) { debugLog('[ORCH ERR] stop:', e?.message); return false; }
}

// Subscribe to realtime updates
export function subscribeRealtimeUpdates(listener: (data: RealtimeRunningData) => void): () => void {
  realtimeListeners.push(listener);
  // Return unsubscribe function
  return () => {
    const index = realtimeListeners.indexOf(listener);
    if (index > -1) realtimeListeners.splice(index, 1);
  };
}

// Get current realtime data (for initial render)
export function getRealtimeData(): RealtimeRunningData | null {
  return realtimeData;
}

// Cleanup all listeners and reset state
export function cleanupWatchSync() {
  debugLog('[WATCH] Cleaning up listeners...');
  subs.forEach(sub => {
    try {
      sub.remove();
    } catch (e) {
      debugLog('[WATCH] Failed to remove listener:', (e as Error).message);
    }
  });
  subs = [];
  realtimeListeners = [];
  realtimeData = null;
  currentSessionId = null;
  inited = false;
  debugLog('[WATCH] Cleanup complete');
}

// Check if watch module is available
export function isWatchAvailable(): boolean {
  return WayToEarthWear != null && typeof WayToEarthWear === 'object';
}

// Open companion app or Bluetooth settings to connect watch
export async function openWatchConnectionUI(): Promise<boolean> {
  try {
    if (!isWatchAvailable()) return false;
    if (typeof WayToEarthWear.openWearManager === 'function') {
      const ok = await WayToEarthWear.openWearManager();
      return !!ok;
    }
    return false;
  } catch {
    return false;
  }
}

// JSON.parse with guard
;(JSON as any).parseSafe = (s: any) => { try { return JSON.parse(String(s)); } catch { return null; } };

export default {
  initWatchSync,
  startRunOrchestrated,
  pauseRun,
  resumeRun,
  stopRun,
  subscribeRealtimeUpdates,
  getRealtimeData,
  cleanupWatchSync,
  isWatchAvailable,
  openWatchConnectionUI,
};
