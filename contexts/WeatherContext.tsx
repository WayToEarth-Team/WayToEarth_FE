// contexts/WeatherContext.tsx
import React, { createContext, useContext, ReactNode, useCallback, useEffect } from "react";
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
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function WeatherProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();

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
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: (count, err: any) => {
      if ((err as any)?.response?.status === 429) return false;
      return count < 2;
    },
  });

  // 토큰 상태 변경 시 캐시 무효화 → 다음 포커스/요청 때 재조회
  useEffect(() => {
    const off = onAuthTokenChange(() => {
      client.invalidateQueries({ queryKey: ["weather"] }).catch(() => {});
    });
    return off;
  }, [client]);

  return (
    <WeatherContext.Provider
      value={{
        weather: query.data,
        loading: query.isLoading,
        error: query.error ? (query.error.message || "오류가 발생했습니다") : null,
        refetch: async () => { await query.refetch(); },
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
