// hooks/journey/useBackgroundRunning.ts
// Notifee를 사용한 백그라운드 러닝 세션 관리 (여정 러닝 + 일반 러닝 공용)
import { useEffect, useRef } from 'react';
// Lazy-load Notifee to avoid crashes on Expo Go or environments
// without the native module. Use Dev Client/prebuilt for full support.
let notifee: any | null = null;
let AndroidImportance: any | null = null;
let AndroidCategory: any | null = null;
let AuthorizationStatus: any | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('@notifee/react-native');
  notifee = mod?.default ?? mod;
  AndroidImportance = mod?.AndroidImportance ?? null;
  AndroidCategory = mod?.AndroidCategory ?? null;
  AuthorizationStatus = mod?.AuthorizationStatus ?? null;
} catch {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import { WAY_LOCATION_TASK } from '../../utils/backgroundLocation';

const RUNNING_SESSION_KEY = '@running_session';
const ONGOING_CHANNEL_ID = 'running_session_ongoing';
const POPUP_CHANNEL_ID = 'running_session_popup';

export type RunningSessionType = 'journey' | 'general';

export type RunningSessionState = {
  type: RunningSessionType; // 여정 러닝 or 일반 러닝 구분
  journeyId?: string; // 여정 러닝일 경우에만
  journeyTitle?: string; // 여정 러닝일 경우에만
  sessionId: string; // 세션 고유 ID
  startTime: number;
  distanceKm: number;
  durationSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  reachedLandmarks?: string[]; // 여정 러닝일 경우에만
};

export function useBackgroundRunning() {
  const appState = useRef(AppState.currentState);
  const notificationId = useRef<string | null>(null);
  const bgNotiShownRef = useRef<boolean>(false);
  // 1회성 표시만 유지. ticker는 사용하지 않음(레거시 정리만).
  const bgTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSessionRef = useRef<RunningSessionState | null>(null);

  // 알림 권한 요청 (Android 13+)
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      // Android 13+ (API 33+)에서는 POST_NOTIFICATIONS 권한 필요
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.warn('알림 권한이 거부되었습니다.');
          return false;
        }
      }

      // Notifee 권한 확인 (모듈이 없으면 true로 간주: Dev Client 필요)
      if (notifee && AuthorizationStatus) {
        const settings = await notifee.requestPermission();
        return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      }
      return true;
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      return false;
    }
  };

  // 알림 채널 생성 (Android 필수) - 백업 용도로 남겨둠
  const createNotificationChannels = async () => {
    try {
      if (!notifee || !AndroidImportance) return;
      await notifee.createChannel({
        id: ONGOING_CHANNEL_ID,
        name: '러닝 진행(무음)',
        importance: AndroidImportance.DEFAULT,
        vibration: false,
      });
      await notifee.createChannel({
        id: POPUP_CHANNEL_ID,
        name: '러닝 시작 알림',
        importance: AndroidImportance.HIGH,
        vibration: true,
        sound: 'default',
      });
    } catch {}
  };

  // 내부: 진행 중 알림(알림 쉐이드 고정) 표시/갱신
  const renderOngoing = async (session: RunningSessionState, effectiveDurationSec?: number) => {
    try {
      if (!notifee || !AndroidImportance || !AndroidCategory) return;
      const title = session.type === 'journey' && session.journeyTitle
        ? `🏃 ${session.journeyTitle} 러닝 중`
        : `🏃 일반 러닝 중`;
      let dur = session.durationSeconds;
      if (!session.isPaused) {
        dur = Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));
      }
      if (typeof effectiveDurationSec === 'number') dur = effectiveDurationSec;
      const body = session.type === 'journey'
        ? `진행 거리: ${session.distanceKm.toFixed(2)}km | 시간: ${formatDuration(dur)}`
        : `거리: ${session.distanceKm.toFixed(2)}km | 시간: ${formatDuration(dur)}`;
      await createNotificationChannels();
      const notificationIdResult = await notifee.displayNotification({
        id: 'running_session',
        title,
        body,
        android: {
          channelId: ONGOING_CHANNEL_ID,
          importance: AndroidImportance.DEFAULT,
          category: AndroidCategory.WORKOUT,
          ongoing: true,
          autoCancel: false,
          onlyAlertOnce: true,
          showTimestamp: true,
          pressAction: { id: 'default', launchActivity: 'default' },
          // asForegroundService는 기기/설정에 따라 별도 서비스 등록 필요할 수 있어 비활성화
          color: session.isPaused ? '#FFA500' : '#00FF00',
          smallIcon: 'ic_launcher',
        },
      });
      notificationId.current = notificationIdResult;
    } catch (error) {
      console.error('Failed to display ongoing notification:', error);
    }
  };

  // 내부: 백그라운드 지속 알림을 1회 표시하고, 시간만 초단위 갱신
  const showBackgroundOngoing = async (session: RunningSessionState) => {
    lastSessionRef.current = session;
    // 진행 카드는 Expo Location 카드만 유지(중복 방지)
    // renderOngoing(session).catch(() => {});
    // 동시에 헤드업 1회 알림(짧게 표시 후 자동 취소)
    try {
      const title = session.type === 'journey' && session.journeyTitle
        ? `🏃 ${session.journeyTitle} 러닝 시작`
        : `🏃 일반 러닝 시작`;
      const dur = session.isPaused
        ? session.durationSeconds
        : Math.max(0, Math.floor((Date.now() - session.startTime) / 1000));
      const body = session.type === 'journey'
        ? `진행 거리: ${session.distanceKm.toFixed(2)}km | 시간: ${formatDuration(dur)}`
        : `거리: ${session.distanceKm.toFixed(2)}km | 시간: ${formatDuration(dur)}`;

      await notifee.displayNotification({
        id: 'running_popup',
        title,
        body,
        android: {
          channelId: POPUP_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.WORKOUT,
          autoCancel: true,
          onlyAlertOnce: true,
          showTimestamp: true,
          lightUpScreen: true,
          // 짧게 표시 후 자동 종료(일부 기기에서만 동작). 보조로 setTimeout 취소 처리.
          timeoutAfter: 2500,
          smallIcon: 'ic_launcher',
        },
      });
      setTimeout(() => {
        notifee.cancelNotification('running_popup').catch(() => {});
      }, 3000);
    } catch {}
    bgNotiShownRef.current = true;
    // 진행 카드 실시간 갱신(조용히 업데이트)
    // 진행 카드 실시간 갱신 비활성화(Expo Location 카드만 유지)
    if (bgTickerRef.current) {
      clearInterval(bgTickerRef.current);
      bgTickerRef.current = null;
    }
  };

  // Foreground Service 시작 (요청 시점에 앱이 백그라운드일 때만 1회 표시)
  const startForegroundService = async (session: RunningSessionState, isBackground: boolean = false) => {
    // 세션 저장은 비동기로 처리해 표시를 지연시키지 않음
    saveSession(session).catch(() => {});
    if (Platform.OS !== 'android') return;
    // 권한 확인은 러닝 시작 시점에서 수행됨. 여기서는 지연 없이 표시만 시도.
    // 앱이 백그라운드일 때만 표시, 이미 표시했다면 무시
    if ((isBackground || appState.current === 'background') && !bgNotiShownRef.current) {
      showBackgroundOngoing(session);
    }
    // 백그라운드/포그라운드 모두 진행 중 알림을 고정 표시
    await renderOngoing(session);
  };

  // 시간 포맷 헬퍼 함수
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Foreground Service 업데이트
  const updateForegroundService = async (session: RunningSessionState, nextLandmark?: string) => {
    await saveSession(session);
    lastSessionRef.current = session;
    if (Platform.OS === 'android') {
      await renderOngoing(session);
    }
  };

  // Foreground Service 중지
  const stopForegroundService = async () => {
    try {
      await notifee.cancelNotification('running_session');
      await notifee.cancelNotification('running_popup');
      try { await notifee.stopForegroundService(); } catch {}
      notificationId.current = null;
      bgNotiShownRef.current = false;
      if (bgTickerRef.current) {
        clearInterval(bgTickerRef.current);
        bgTickerRef.current = null;
      }
    } catch (error) {
      console.error('Failed to stop foreground service:', error);
    }
  };

  // 세션 상태 저장
  const saveSession = async (session: RunningSessionState) => {
    try {
      await AsyncStorage.setItem(RUNNING_SESSION_KEY, JSON.stringify(session));
      // 과도한 로그 방지: 필요 시 디버깅에서만 활성화
      // console.log('✅ Running session saved:', { isRunning: session.isRunning });
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  // 세션 상태 로드
  const loadSession = async (): Promise<RunningSessionState | null> => {
    try {
      const sessionData = await AsyncStorage.getItem(RUNNING_SESSION_KEY);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        console.log('✅ Running session loaded:', {
          journeyTitle: session.journeyTitle,
          progressM: session.progressM,
          isRunning: session.isRunning,
        });
        return session;
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
    return null;
  };

  // 세션 삭제
  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(RUNNING_SESSION_KEY);
      console.log('✅ Running session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  // 랜드마크 도달 알림
  const showLandmarkNotification = async (landmarkName: string) => {
    try {
      if (!notifee || !AndroidImportance) return;
      await notifee.displayNotification({
        title: `🎉 ${landmarkName} 도착!`,
        body: '랜드마크에 방명록을 남겨보세요.',
        android: {
          channelId: POPUP_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [300, 500, 300],
          color: '#FFD700',
          smallIcon: 'ic_launcher',
        },
      });
    } catch (error) {
      console.error('Failed to show landmark notification:', error);
    }
  };

  // AppState 변경 감지
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // 앱이 백그라운드로 갈 때 최근 세션 정보를 읽어 1회성 알림 표시
        (async () => {
          try {
            const s = await loadSession();
            if (s?.isRunning) {
              await startForegroundService(s, true);
              // 보조: Expo Background Location 업데이트가 확실히 시작되도록 이곳에서도 시도
              /*
               * Expo Background Location은 포그라운드에서만 시작해야 함.
               * 백그라운드 전환 시점에서 시작을 시도하면
               * "Foreground service cannot be started when the application is in the background"
               * 에러가 발생하므로 이 보조 호출은 비활성화합니다.
               * (러닝 시작 시 포그라운드에서만 startLocationUpdatesAsync 호출)
               */
              // try {
              //   const bg = await Location.getBackgroundPermissionsAsync();
              //   if (bg.status !== 'granted') {
              //     const req = await Location.requestBackgroundPermissionsAsync();
              //     console.log('[BG-LOC][AS] request background perm:', req.status);
              //   }
              //   const running = await Location.hasStartedLocationUpdatesAsync(WAY_LOCATION_TASK);
              //   if (!running) {
              //     console.log('[BG-LOC][AS] starting background updates');
              //     await Location.startLocationUpdatesAsync(WAY_LOCATION_TASK, {
              //       accuracy: Location.Accuracy.Highest,
              //       timeInterval: 1000,
              //       distanceInterval: 2,
              //       showsBackgroundLocationIndicator: false,
              //       pausesUpdatesAutomatically: false,
              //       foregroundService: {
              //         notificationTitle: '러닝 진행 중',
              //         notificationBody: '앱을 열어 진행 상태를 확인하세요',
              //       },
              //     } as any);
              //   }
              // } catch (e) {
              //   console.warn('[BG-LOC][AS] start failed:', e);
              // }
            }
          } catch {}
        })();
      }
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // 포그라운드 복귀 시 알림/서비스 정리
        stopForegroundService();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 초기화 시 채널 생성
  useEffect(() => {
    createNotificationChannels();
  }, []);

  return {
    requestNotificationPermission,
    startForegroundService,
    updateForegroundService,
    stopForegroundService,
    saveSession,
    loadSession,
    clearSession,
    showLandmarkNotification,
  };
}
