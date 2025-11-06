// hooks/useWeather.ts
import { useState, useEffect, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { getCurrentWeather } from "../utils/api/weather";

export interface WeatherData {
  condition: string;
  iconCode: string;
  emoji: string;
  fetchedAt: string;
  recommendation: string;
  temperature?: number; // 온도 (섭씨)
}

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30분마다 갱신 (백엔드 캐시 TTL 매칭)

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true); // 초기 로딩만 true
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFocused = useIsFocused();

  const fetchWeather = async (isBackground = false) => {
    try {
      // 백그라운드 갱신 시 로딩 상태 변경 안 함
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);

      // 위치 권한 확인
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("위치 권한이 필요합니다");
        return;
      }

      // 현재 위치 가져오기
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // 날씨 API 호출
      const weatherData = await getCurrentWeather(
        location.coords.latitude,
        location.coords.longitude
      );

      console.log("[useWeather] 날씨 데이터 갱신:", isBackground ? "(백그라운드)" : "(초기)", JSON.stringify(weatherData, null, 2));
      setWeather(weatherData);
    } catch (err: any) {
      console.error("[useWeather] 날씨 조회 실패:", err);
      // 백그라운드 갱신 실패 시 이전 데이터 유지, 에러만 로그
      if (!isBackground) {
        setError(err?.message || "날씨 정보를 가져올 수 없습니다");
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // 화면 포커스 시에만 주기 갱신 + 초기 1회 호출
  useEffect(() => {
    if (!isFocused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 포커스된 경우: 초기 1회 호출
    fetchWeather();

    // 30분마다 백그라운드로 갱신
    intervalRef.current = setInterval(() => {
      fetchWeather(true);
    }, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isFocused]);

  return {
    weather,
    loading,
    error,
    refetch: fetchWeather,
  };
}
