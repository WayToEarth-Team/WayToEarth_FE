import { DeviceEventEmitter, EmitterSubscription } from 'react-native';

const EVENT = 'RUNNING_SESSION_CHANGED';

export function emitRunningSession(isRunning: boolean) {
  try {
    DeviceEventEmitter.emit(EVENT, { isRunning });
  } catch {}
}

export function addRunningSessionListener(cb: (isRunning: boolean) => void): EmitterSubscription {
  // @ts-ignore RN type mismatch for DeviceEventEmitter
  return DeviceEventEmitter.addListener(EVENT, (payload?: any) => {
    try {
      cb(!!payload?.isRunning);
    } catch {}
  });
}

// 스탬프 수집 이벤트: UI들이 즉시 반영할 수 있도록 브로드캐스트
const STAMP_EVENT = 'STAMP_COLLECTED';

export type StampCollectedPayload = { stamp?: any; landmarkId?: number };

export function emitStampCollected(payload: StampCollectedPayload) {
  try {
    DeviceEventEmitter.emit(STAMP_EVENT, payload);
  } catch {}
}

export function addStampCollectedListener(cb: (payload: StampCollectedPayload) => void): EmitterSubscription {
  // @ts-ignore RN type mismatch for DeviceEventEmitter
  return DeviceEventEmitter.addListener(STAMP_EVENT, (payload?: any) => {
    try { cb(payload || {}); } catch {}
  });
}

