// utils/api/client.ts
import axios, { AxiosResponse } from "axios";
import { getAccessToken, refreshAccessToken, ensureAccessToken } from "../auth/tokenManager";
import { getApiBaseUrl } from "../config/api";
import { showToast } from "../toast";

// 목데이터 사용 중단: 항상 실서버 연동

const BASE_URL = getApiBaseUrl();

export const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// 요청: 액세스 토큰 자동 주입
client.interceptors.request.use(async (config) => {
  let t = getAccessToken();
  if (!t) {
    const baseURL = client.defaults.baseURL || BASE_URL;
    t = await ensureAccessToken(baseURL);
  }
  if (t) {
    config.headers = {
      ...(config.headers as any),
      Authorization: `Bearer ${t}`,
    } as any;
  }
  if (__DEV__) {
    try {
      const fullUrl = config.baseURL ? config.baseURL + (config.url || "") : config.url;
      // eslint-disable-next-line no-console
      console.log("[API REQ]", config.method, fullUrl, "Has Auth:", t ? "YES" : "NO");
    } catch {}
  }
  return config;
});

// 응답: {success,data,message} 래퍼면 data로 언래핑
client.interceptors.response.use(
  (res: AxiosResponse) => {
    const d = res.data;
    if (
      d &&
      typeof d === "object" &&
      "data" in d &&
      ("success" in d || "message" in d)
    ) {
      res.data = (d as any).data; // ← 이후 .data가 실제 페이로드
    }
    return res;
  },
  async (err) => {
    const status = err?.response?.status;
    const cfg = err?.config || {};

    // 401 처리: 토큰 재발급 시도 (무한루프 방지용 플래그)
    if ((status === 401 || status === 403) && !(cfg as any)._retry) {
      (cfg as any)._retry = true;
      try {
        const baseURL = client.defaults.baseURL || BASE_URL;
        const newAccess = await refreshAccessToken(baseURL);
        if (newAccess) {
          cfg.headers = {
            ...(cfg.headers as any),
            Authorization: `Bearer ${newAccess}`,
          } as any;
          return client(cfg);
        }
      } catch (e) {
        // fallthrough to reject below after cleanup
      }
    }

    // 429 Too Many Requests: 사용자 알림 후 단회 지연 재시도
    if (status === 429 && !(cfg as any)._retry429) {
      (cfg as any)._retry429 = true;
      try {
        showToast("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
      } catch {}
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(client(cfg));
        }, 30_000);
      });
    }

    // 로깅 (디버깅용)
    try {
      const body = err?.response?.data;
      const hasAuth = cfg.headers?.Authorization;
      console.log(
        "[API ERR]",
        status,
        "method=",
        cfg.method,
        "url=",
        cfg.baseURL ? cfg.baseURL + (cfg.url || "") : cfg.url
      );
      console.log("[API ERR] Response Body:", JSON.stringify(body, null, 2));
      console.log("[API ERR] Has Auth Header:", hasAuth ? "YES" : "NO");
      if (status === 403) {
        console.log("[API ERR] 403 Forbidden - Check Admin Role or Token");
      }
    } catch {}

    return Promise.reject(err);
  }
);
// token refresh logic centralized in tokenManager
