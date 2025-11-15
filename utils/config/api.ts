import Constants from "expo-constants";

/**
 * Resolve API base URL at runtime with the following priority:
 * 1) `process.env.EXPO_PUBLIC_API_BASE_URL` (Expo public env at build-time)
 * 2) `Constants.expoConfig?.extra?.apiBaseUrl` (from app.config.js)
 * 3) hardcoded fallback to production cloud URL
 *
 * Use this from anywhere instead of hardcoding URLs or branching on __DEV__.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }
  const fromExtra = (Constants as any)?.expoConfig?.extra?.apiBaseUrl;
  if (fromExtra && typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }
  return "https://api.waytoearth.cloud";
}

/** Trim and ensure no double slashes when joining path to base URL */
export function joinApiUrl(base: string, path: string): string {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

/** Convert http(s) base URL to ws(s) for WebSocket usage */
export function toWebSocketBaseUrl(httpBase: string): string {
  const trimmed = (httpBase || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return trimmed.replace(/^https:\/\//, "wss://");
  if (trimmed.startsWith("http://")) return trimmed.replace(/^http:\/\//, "ws://");
  // No scheme -> assume wss
  return `wss://${trimmed.replace(/^\/+/, "")}`;
}
