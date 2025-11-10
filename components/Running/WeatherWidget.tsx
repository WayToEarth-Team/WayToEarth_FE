// components/Running/WeatherWidget.tsx
import React, { useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface WeatherWidgetProps {
  emoji?: string;
  condition?: string;
  temperature?: number;
  recommendation?: string;
  loading?: boolean;
}

export default function WeatherWidget({
  emoji,
  condition,
  temperature,
  recommendation,
  loading,
}: WeatherWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const animWidth = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;

  const animBgOpacity = useRef(new Animated.Value(0)).current;

  const toggleExpand = () => {
    const toExpanded = !expanded;
    setExpanded(toExpanded);

    Animated.parallel([
      Animated.spring(animWidth, {
        toValue: toExpanded ? 1 : 0,
        useNativeDriver: false,
        friction: 8,
        tension: 40,
      }),
      Animated.timing(animOpacity, {
        toValue: toExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animBgOpacity, {
        toValue: toExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const containerWidth = animWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [48, 220], // 축소: 48 (높이와 동일), 확장: 220
  });

  const backgroundColor = animBgOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ["transparent", "rgba(100, 116, 139, 0.75)"], // 축소: 완전 투명, 확장: 더 진한 회색
  });

  const shadowOpacity = animBgOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.15], // 축소: 그림자 없음, 확장: 그림자 있음
  });

  if (loading) {
    return (
      <View style={[styles.iconContainer, { backgroundColor: "rgba(100, 116, 139, 0.75)", borderRadius: 999, padding: 8 }]}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  const pickIcon = (): { name: any; color: string } => {
    const c = (condition || "").toLowerCase();
    const e = emoji || "";
    if (/sun|clear|맑|화창/.test(c) || /☀️|🌞/.test(e)) return { name: "weather-sunny", color: "#FDB813" };
    if (/partly|cloud|구름/.test(c) || /⛅️|☁️/.test(e)) return { name: "weather-partly-cloudy", color: "#e5e7eb" };
    if (/rain|비/.test(c) || /🌧️|🌦️/.test(e)) return { name: "weather-rainy", color: "#60A5FA" };
    if (/snow|눈/.test(c) || /❄️/.test(e)) return { name: "weather-snowy", color: "#93C5FD" };
    if (/storm|thunder|번개/.test(c) || /⛈️|⚡️/.test(e)) return { name: "weather-lightning", color: "#F59E0B" };
    if (/fog|mist|안개/.test(c) || /🌫️/.test(e)) return { name: "weather-fog", color: "#CBD5E1" };
    if (/night|밤/.test(c) || /🌙/.test(e)) return { name: "weather-night", color: "#64748B" };
    return { name: "weather-cloudy", color: "#e5e7eb" };
  };
  const icon = pickIcon();

  return (
    <Pressable onPress={toggleExpand}>
      <Animated.View
        style={[
          styles.container,
          {
            width: containerWidth,
            backgroundColor: backgroundColor,
            shadowOpacity: shadowOpacity,
          },
        ]}
      >
        {/* 왼쪽: 날씨 아이콘 (항상 표시) */}
        <View style={{ opacity: 1 }}>
          <MaterialCommunityIcons name={icon.name} size={30} color={icon.color} />
        </View>

        {/* 오른쪽: 온도 & 추천 메시지 (확장 시에만 표시) */}
        <Animated.View
          style={[
            styles.infoContainer,
            {
              opacity: animOpacity,
            },
          ]}
          pointerEvents={expanded ? "auto" : "none"}
        >
          {temperature !== undefined && temperature !== null && (
            <Text style={styles.temperature}>{Math.round(temperature)}°</Text>
          )}
          {recommendation && (
            <Text style={styles.recommendation} numberOfLines={2}>
              {recommendation}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // backgroundColor, shadowOpacity는 동적으로 적용됨
    borderRadius: 999, // 완전히 둥근 모서리
    paddingHorizontal: 4,
    paddingVertical: 4,
    height: 48,
    // 그림자 설정 (opacity만 애니메이션)
    shadowColor: "#000",
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 0, // 안드로이드 그림자 비활성화 (팔각형 방지)
  },
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  
  infoContainer: {
    marginLeft: 8,
    flex: 1,
    justifyContent: "center",
    height: 40, // infoContainer도 증가
  },
  temperature: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff", // 흰색 (어두운 배경에 맞춤)
    lineHeight: 20,
  },
  recommendation: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)", // 약간 투명한 흰색
    lineHeight: 12,
  },
});
