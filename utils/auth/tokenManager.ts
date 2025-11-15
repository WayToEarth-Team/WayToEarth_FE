import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getApiBaseUrl, joinApiUrl } from "../config/api";

// Secure storage (Expo SecureStore) is preferred; fallback to AsyncStorage if unavailable
let SecureStore: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SecureStore = require("expo-secure-store");
} catch {}

const ACCESS_KEY = "accessToken"; // kept in-memory primarily
const REFRESH_KEY = "refreshToken"; // stored securely

let accessTokenMemory: string | null = null;
const tokenListeners = new Set<() => void>();

function emitTokenChange() {
  tokenListeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

export function onAuthTokenChange(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => tokenListeners.delete(listener);
}

async function secureGetItem(key: string): Promise<string | null> {
  try {
    if (SecureStore?.getItemAsync) return await SecureStore.getItemAsync(key);
  } catch {}
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function secureSetItem(key: string, value: string): Promise<void> {
  try {
    if (SecureStore?.setItemAsync) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
      if (__DEV__) console.log(`[auth] Saved ${key} in SecureStore`);
      return;
    }
  } catch {}
  try {
    await AsyncStorage.setItem(key, value);
    if (__DEV__) console.log(`[auth] Saved ${key} in AsyncStorage (fallback)`);
  } catch {}
}

async function secureDeleteItem(key: string): Promise<void> {
  try {
    if (SecureStore?.deleteItemAsync) {
      await SecureStore.deleteItemAsync(key);
      if (__DEV__) console.log(`[auth] Deleted ${key} from SecureStore`);
      return;
    }
  } catch {}
  try {
    await AsyncStorage.removeItem(key);
    if (__DEV__) console.log(`[auth] Deleted ${key} from AsyncStorage (fallback)`);
  } catch {}
}

export function getAccessToken(): string | null {
  return accessTokenMemory;
}

export async function setTokens(accessToken: string, refreshToken?: string | null) {
  accessTokenMemory = accessToken || null;
  if (refreshToken) {
    await secureSetItem(REFRESH_KEY, refreshToken);
  }
  emitTokenChange();
}

export async function clearTokens() {
  accessTokenMemory = null;
  await Promise.all([
    secureDeleteItem(REFRESH_KEY),
    // cleanup legacy keys if they exist
    AsyncStorage.removeItem(ACCESS_KEY).catch(() => {}),
    AsyncStorage.removeItem("jwtToken").catch(() => {}),
  ]);
  emitTokenChange();
}

export async function getRefreshToken(): Promise<string | null> {
  return await secureGetItem(REFRESH_KEY);
}

// Attempt to ensure we have an in-memory access token, using refresh token if possible
export async function ensureAccessToken(baseURL = getApiBaseUrl()): Promise<string | null> {
  if (accessTokenMemory) return accessTokenMemory;
  const rt = await getRefreshToken();
  if (rt) {
    const newAccess = await refreshAccessToken(baseURL);
    return newAccess;
  }
  // Legacy fallback: try to hydrate from AsyncStorage once
  try {
    const legacyAccess = (await AsyncStorage.getItem("accessToken")) || (await AsyncStorage.getItem("jwtToken"));
    if (legacyAccess) {
      accessTokenMemory = legacyAccess;
      if (__DEV__) console.log("[auth] Hydrated accessToken from legacy storage");
      return accessTokenMemory;
    }
  } catch {}
  return null;
}

let refreshing: Promise<string | null> | null = null;
export async function refreshAccessToken(baseURL = getApiBaseUrl()): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        return null;
      }
      const url = joinApiUrl(baseURL, "/v1/auth/refresh");
      const res = await axios.post(url, { refreshToken }, { timeout: 10000 });
      const payload = res?.data && typeof res.data === "object" && "data" in res.data ? (res.data as any).data : res?.data;
      const accessToken: string | undefined = payload?.accessToken;
      const newRefresh: string | null | undefined = payload?.refreshToken ?? null;
      if (!accessToken) {
        await clearTokens();
        return null;
      }
      accessTokenMemory = accessToken;
      if (newRefresh) await secureSetItem(REFRESH_KEY, newRefresh);
      emitTokenChange();
      return accessToken;
    } catch (e) {
      await clearTokens();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// For legacy migration: pull from AsyncStorage if present
export async function migrateLegacyTokens() {
  try {
    const legacyAccess = await AsyncStorage.getItem("accessToken");
    const legacyJwt = await AsyncStorage.getItem("jwtToken");
    const legacyRefresh = await AsyncStorage.getItem("refreshToken");
    accessTokenMemory = legacyAccess || legacyJwt || accessTokenMemory;
    if (legacyRefresh) await secureSetItem(REFRESH_KEY, legacyRefresh);
  } catch {}
}

// Diagnostics: check whether SecureStore is available and which backend is used
export async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    if (SecureStore?.isAvailableAsync) return !!(await SecureStore.isAvailableAsync());
    return !!SecureStore?.getItemAsync;
  } catch {
    return false;
  }
}

export async function logStorageBackendOnce() {
  try {
    const available = await isSecureStoreAvailable();
    if (__DEV__) console.log(`[auth] SecureStore available: ${available ? 'YES' : 'NO'}`);
    if (__DEV__) console.log(`[auth] refreshToken backend: ${available ? 'SecureStore' : 'AsyncStorage (fallback)'}`);
  } catch {}
}
