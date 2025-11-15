// utils/api/client.ts
import axios, { AxiosResponse } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "./config/api";

const BASE_URL = getApiBaseUrl();

export const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// 요청: JWT 자동 주입
client.interceptors.request.use(async (config) => {
  try {
    const t = await AsyncStorage.getItem("jwtToken");
    if (t) {
      (config.headers ||= {})["Authorization"] = `Bearer ${t}`;
    }
  } catch {}
  return config;
});

// 응답: {success,data,message} 래퍼면 data로 언래핑
client.interceptors.response.use(
  (res: AxiosResponse) => {
    const d = res.data.data;
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
  (err) => {
    const status = err?.response?.status;
    const body = err?.response?.data;
    console.log("[API ERR]", status, body);
    return Promise.reject(err);
  }
);
