import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import MapView, { Polyline } from "react-native-maps";

type Coord = { latitude: number; longitude: number };

type Props = {
  record: any;
  preview?: { coords: Coord[] } | undefined;
  onPress?: () => void;
};

const formatDuration = (seconds?: number) => {
  if (!seconds || isNaN(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
};

export default function RecordItem({ record: r, preview, onPress }: Props) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
      }}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={{ width: 72, height: 72, marginRight: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#F3F4F6" }}>
        {preview?.coords?.length ? (
          <MapView
            pointerEvents="none"
            style={{ flex: 1 }}
            initialRegion={{
              latitude: preview.coords[0].latitude,
              longitude: preview.coords[0].longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Polyline coordinates={preview.coords} strokeColor="#2563eb" strokeWidth={3} />
          </MapView>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>{r.title || "러닝 기록"}</Text>
          {r?.runningType && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: r.runningType === "JOURNEY" ? "#7c3aed" : "#10b981",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                {r.runningType === "JOURNEY" ? "여정" : "일반"}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
          {(r.distanceKm ?? 0).toFixed(2)}km · {formatDuration(r.durationSeconds)} · {r.calories ?? 0}kcal
        </Text>
      </View>
      <Text style={{ fontSize: 20, color: "#D1D5DB", marginLeft: 8 }}>›</Text>
    </TouchableOpacity>
  );
}

