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

