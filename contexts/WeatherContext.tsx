// contexts/WeatherContext.tsx
import React, { createContext, useContext, ReactNode, useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentWeather } from "../utils/api/weather";
import { ensureAccessToken, onAuthTokenChange } from "../utils/auth/tokenManager";

export interface WeatherData {
  condition: string;
  iconCode: string;
  emoji: string;
  fetchedAt: string;
  recommendation: string;
  temperature?: number;
}

interface WeatherContextType {
  weather: WeatherData | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  enable: () => void; // 날씨 조회 활성화(위치 사용 허용)
  disable: () => void; // 비활성화(선택)
  enabled: boolean;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  // 기본적으로 비활성화: 메인/러닝 화면에서만 활성화하도록
  const [enabled, setEnabled] = useState(false);

  const fetcher = useCallback(async () => {
    const token = await ensureAccessToken();
    if (!token) {
      throw new Error("인증이 필요합니다");
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("위치 권한이 필요합니다");
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const data = await getCurrentWeather(
      location.coords.latitude,
      location.coords.longitude
    );
    return data as WeatherData;
  }, []);

  const query = useQuery<WeatherData, Error>({
    queryKey: ["weather"],
    queryFn: fetcher,
    staleTime: 30 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled, // 활성화된 화면에서만 조회
    refetchOnReconnect: enabled,
    refetchOnWindowFocus: false,
    retry: (count, err: any) => {
      if ((err as any)?.response?.status === 429) return false;
      return count < 2;
    },
  });

  // 토큰 상태 변경 시 캐시 무효화 → 다음 포커스/요청 때 재조회
  useEffect(() => {
    const off = onAuthTokenChange(() => {
      if (enabled) {
        client.invalidateQueries({ queryKey: ["weather"] }).catch(() => {});
      }
    });
    return off;
  }, [client, enabled]);

  return (
    <WeatherContext.Provider
      value={{
        weather: query.data,
        loading: query.isLoading,
        error: query.error ? (query.error.message || "오류가 발생했습니다") : null,
        refetch: async () => { await query.refetch(); },
        enable: () => setEnabled(true),
        disable: () => setEnabled(false),
        enabled,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error("useWeather must be used within a WeatherProvider");
  }
  return context;
}
