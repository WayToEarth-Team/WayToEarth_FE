// utils/backgroundLocation.ts
// Registers a background location task for Android/iOS using Expo TaskManager.
// The task runs even when the app is in background to keep the foreground service alive
// and to persist last known locations.

import { Platform } from 'react-native';
let TaskManager: any = null;
try {
  // Lazy-require to avoid crashes when native module isn't available (Expo Go/web)
  // Background tasks require a Dev Client or a prebuilt app.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager');
} catch {}
// expo-location types are only needed in task body; lazy require inside
import AsyncStorage from '@react-native-async-storage/async-storage';

export const WAY_LOCATION_TASK = 'WAY_BACKGROUND_LOCATION';

// Define task only when native TaskManager is available (native dev build / prebuilt app)
if (TaskManager?.defineTask && Platform.OS !== 'web') {
  // Lazy import Location inside task body to avoid static require on unsupported platforms
  const define = TaskManager.defineTask?.bind(TaskManager) || TaskManager.defineTask;
  define(WAY_LOCATION_TASK, async ({ data, error }: any) => {
    try {
      if (error) {
        if (__DEV__) console.warn('[BG-LOC] task error:', error);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Location = require('expo-location');
      type LocationObject = any;
      const locations = (data as { locations?: LocationObject[] } | undefined)?.locations || [];
      if (!locations?.length) return;
      const last: any = locations[locations.length - 1];
      const payload = {
        t: Date.now(),
        latitude: last.coords?.latitude,
        longitude: last.coords?.longitude,
        accuracy: last.coords?.accuracy,
        speed: last.coords?.speed,
      };
      await AsyncStorage.setItem('@last_bg_location', JSON.stringify(payload));
    } catch (e) {
      if (__DEV__) console.warn('[BG-LOC] persist error:', e);
    }
  });
} else {
  if (__DEV__) console.log('[BG-LOC] TaskManager not available (Expo Go/web). Background task not registered.');
}
