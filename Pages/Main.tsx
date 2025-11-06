import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapRoute from "../components/Running/MapRoute";
import WeatherWidget from "../components/Running/WeatherWidget";
import { useWeather } from "../contexts/WeatherContext";
import { InteractionManager } from "react-native";

export default function Main() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const wasFocused = useRef(true); // 초기엔 focused 상태

  // 페이지가 focus될 때만 (다른 페이지에서 돌아올 때만) 지도 리프레시
  useFocusEffect(
    React.useCallback(() => {
      // focus될 때
      if (!wasFocused.current) {
        // 이전에 unfocus 상태였다면 (= 다른 페이지 갔다가 돌아온 경우)
        console.log('[Main] Returned from another page, refreshing map');
        setMapKey(prev => prev + 1);
      }
      wasFocused.current = true;

      // unfocus될 때 (다른 페이지로 갈 때)
      return () => {
        console.log('[Main] Leaving page');
        wasFocused.current = false;
      };
    }, [])
  );

  // 날씨 정보
  const { weather, loading: weatherLoading, enable: enableWeather, disable: disableWeather } = useWeather();
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      try { enableWeather(); } catch {}
    });
    return () => {
      try { disableWeather(); } catch {}
      task.cancel?.();
    };
  }, []);

  // 메인 페이지 진입 시 위치 권한 미리 요청
  useEffect(() => {
    const requestLocationPermissions = async () => {
      try {
        // 포어그라운드 권한
        const fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          await Location.requestForegroundPermissionsAsync();
        }

        // 백그라운드 권한 (안드로이드 10+)
        const bg = await Location.getBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          await Location.requestBackgroundPermissionsAsync();
        }

        console.log('[Main] 위치 권한 미리 요청 완료');
      } catch (e) {
        console.warn('[Main] 위치 권한 요청 실패:', e);
      }
    };

    requestLocationPermissions();
  }, []);

  // 애니메이션 값
  const fade = useRef(new Animated.Value(0)).current;
  const scaleMain = useRef(new Animated.Value(1)).current;
  const scaleRun = useRef(new Animated.Value(0.8)).current;
  const scaleVirtual = useRef(new Animated.Value(0.8)).current;
  const transRunY = useRef(new Animated.Value(0)).current;
  const transVirtualY = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleMain, { toValue: 1.05, useNativeDriver: true }),
      Animated.stagger(60, [
        Animated.parallel([
          Animated.spring(scaleRun, { toValue: 1, useNativeDriver: true }),
          Animated.timing(transRunY, {
            toValue: -90,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleVirtual, { toValue: 1, useNativeDriver: true }),
          Animated.timing(transVirtualY, {
            toValue: -90,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(scaleMain, { toValue: 1, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(scaleRun, { toValue: 0.8, useNativeDriver: true }),
        Animated.timing(transRunY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleVirtual, { toValue: 0.8, useNativeDriver: true }),
        Animated.timing(transVirtualY, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => setMenuOpen(false));
  };

  const handleStartPress = () => {
    if (menuOpen) closeMenu();
    else openMenu();
  };

  const goLiveRun = () => {
    closeMenu();
    // Tab 내의 LiveRunningScreen으로 이동
    nav.navigate("MainTabs", { screen: "LiveRunningScreen" });
  };

  const goVirtualRun = () => {
    closeMenu();
    nav.navigate("JourneyLoading");
  };

  return (
    <View style={s.container}>
      {/* 배경 지도 표시: 현재 위치 기준 (터치 비활성화) */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <MapRoute
          key={mapKey}
          route={[]}
          last={null}
          useCurrentLocationOnMount={false}
          liveMode={false}
          showUserLocation={false}
          showMyLocationButton={false}
        />
      </View>

      {/* 날씨 위젯 */}
      <View
        style={{
          position: "absolute",
          top: Math.max(insets.top, 12) + 12,
          left: 16,
          zIndex: 10,
        }}
      >
        <WeatherWidget
          emoji={weather?.emoji}
          condition={weather?.condition}
          temperature={weather?.temperature}
          recommendation={weather?.recommendation}
          loading={weatherLoading}
        />
      </View>

      {/* 반투명 오버레이 (메뉴 열렸을 때만) */}
      {menuOpen && (
        <Animated.View
          pointerEvents="none"
          style={[s.overlay, { opacity: fade }]}
        />
      )}

      {/* 하단 중앙 시작 버튼 + 메뉴 */}
      <View style={s.bottomWrap}>
        {/* 왼쪽: 러닝 */}
        <Animated.View
          style={[
            s.smallFab,
            {
              transform: [
                { translateX: -90 },
                { translateY: transRunY },
                { scale: scaleRun },
              ],
            },
            !menuOpen && { opacity: 0, pointerEvents: "none" },
          ]}
        >
          <Pressable style={s.smallFabBtn} onPress={goLiveRun}>
            <Text style={s.smallFabText}>러닝</Text>
          </Pressable>
        </Animated.View>

        {/* 오른쪽: 여정 러닝 */}
        <Animated.View
          style={[
            s.smallFab,
            {
              transform: [
                { translateX: 90 },
                { translateY: transVirtualY },
                { scale: scaleVirtual },
              ],
            },
            !menuOpen && { opacity: 0, pointerEvents: "none" },
          ]}
        >
          <Pressable style={s.smallFabBtn} onPress={goVirtualRun}>
            <Text style={s.smallFabText}>여정 러닝</Text>
          </Pressable>
        </Animated.View>

        {/* 중앙: 시작 */}
        <Animated.View style={{ transform: [{ scale: scaleMain }] }}>
          <Pressable style={s.mainFab} onPress={handleStartPress}>
            <Text style={s.mainFabText}>시작</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.06)",
    zIndex: 5,
  },
  bottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
  },
  mainFab: {
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "#93C5FD",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  mainFabText: { fontSize: 24, fontWeight: "900", color: "#0F172A" },
  smallFab: {
    position: "absolute",
    bottom: 70,
  },
  smallFabBtn: {
    width: 96,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallFabText: { fontSize: 16, fontWeight: "800", color: "#111" },
});
