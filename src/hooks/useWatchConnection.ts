// src/hooks/useWatchConnection.ts
// Hook to check Galaxy Watch connection status

import { useState, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import { isWatchAvailable } from '../modules/watchSync';

const { WayToEarthWear } = NativeModules as any;

export interface WatchConnectionStatus {
  isAvailable: boolean;      // 워치 모듈이 사용 가능한지
  isConnected: boolean;       // 워치가 실제로 연결되어 있는지
  isChecking: boolean;        // 연결 확인 중인지
  deviceName?: string;        // 연결된 워치 이름
}

/**
 * 갤럭시 워치 연결 상태를 확인하는 Hook
 *
 * @example
 * ```tsx
 * function RunningStartScreen() {
 *   const watchStatus = useWatchConnection();
 *
 *   if (watchStatus.isConnected) {
 *     return <Text>워치로 시작 가능!</Text>;
 *   } else {
 *     return <Text>폰으로만 시작 가능</Text>;
 *   }
 * }
 * ```
 */
export function useWatchConnection(): WatchConnectionStatus {
  const [status, setStatus] = useState<WatchConnectionStatus>({
    isAvailable: false,
    isConnected: false,
    isChecking: true,
  });

  useEffect(() => {
    checkWatchConnection();

    // 10초마다 재확인
    const interval = setInterval(() => {
      checkWatchConnection();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkWatchConnection = async () => {
    // iOS는 워치 지원 안 함
    if (Platform.OS !== 'android') {
      setStatus({
        isAvailable: false,
        isConnected: false,
        isChecking: false,
      });
      return;
    }

    // 워치 모듈이 없으면
    if (!isWatchAvailable()) {
      setStatus({
        isAvailable: false,
        isConnected: false,
        isChecking: false,
      });
      return;
    }

    // 워치 연결 확인 (네이티브 모듈 호출)
    try {
      setStatus(prev => ({ ...prev, isChecking: true }));

      // WayToEarthWear 모듈에 연결 확인 메서드가 있다면 호출
      // 없으면 모듈만 사용 가능한 것으로 표시
      if (WayToEarthWear && typeof WayToEarthWear.checkWatchConnection === 'function') {
        const result = await WayToEarthWear.checkWatchConnection();
        setStatus({
          isAvailable: true,
          isConnected: result.connected,
          isChecking: false,
          deviceName: result.deviceName,
        });
      } else {
        // 연결 확인 메서드가 없으면 모듈만 체크
        setStatus({
          isAvailable: true,
          isConnected: false, // 실제 연결은 모름
          isChecking: false,
        });
      }
    } catch (error) {
      if (__DEV__) console.log('[WATCH] Connection check failed:', error);
      setStatus({
        isAvailable: true,
        isConnected: false,
        isChecking: false,
      });
    }
  };

  return status;
}

export default useWatchConnection;
