// src/hooks/useWatchRunning.ts
// React hook for watch running realtime updates

import { useState, useEffect } from 'react';
import { subscribeRealtimeUpdates, getRealtimeData, RealtimeRunningData } from '../modules/watchSync';

/**
 * 워치 러닝 실시간 데이터를 구독하는 React Hook
 *
 * @example
 * ```tsx
 * function RunningScreen() {
 *   const runningData = useWatchRunning();
 *
 *   if (!runningData) {
 *     return <Text>러닝 대기 중...</Text>;
 *   }
 *
 *   return (
 *     <View>
 *       <Text>거리: {(runningData.distanceMeters / 1000).toFixed(2)} km</Text>
 *       <Text>시간: {formatDuration(runningData.durationSeconds)}</Text>
 *       <Text>심박수: {runningData.heartRate || '-'} BPM</Text>
 *       <Text>페이스: {formatPace(runningData.paceSeconds)}</Text>
 *       <Text>칼로리: {runningData.calories} kcal</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useWatchRunning(): RealtimeRunningData | null {
  const [data, setData] = useState<RealtimeRunningData | null>(() => getRealtimeData());

  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = subscribeRealtimeUpdates((newData) => {
      setData(newData);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  return data;
}

/**
 * 시간을 HH:MM:SS 형식으로 포맷
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 페이스를 분'초" 형식으로 포맷
 */
export function formatPace(paceSeconds?: number): string {
  if (!paceSeconds || paceSeconds <= 0) return '-';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * 거리를 km 단위로 포맷
 */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km.toFixed(2);
}

export default useWatchRunning;
