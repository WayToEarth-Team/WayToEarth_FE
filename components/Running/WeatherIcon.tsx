// components/Running/WeatherIcon.tsx
import React from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface WeatherIconProps {
  emoji?: string;
  condition?: string;
  loading?: boolean;
  onPress?: () => void;
}

function pickIcon(emoji?: string, condition?: string): { name: any; color: string } {
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
}

export default function WeatherIcon({ emoji, condition, loading, onPress }: WeatherIconProps) {
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  const { name, color } = pickIcon(emoji, condition);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <MaterialCommunityIcons name={name} size={28} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pressed: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    transform: [{ scale: 0.95 }],
  },
});
