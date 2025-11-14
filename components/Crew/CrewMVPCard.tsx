import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type MVPMember = {
  name: string;
  distanceKm: number;
  profileImage?: string | null;
  periodLabel?: string; // e.g. "3월 18일 - 3월 24일"
};

export default function CrewMVPCard({ mvp }: { mvp: MVPMember }) {
  return (
    <View style={s.section}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="trophy-outline" size={18} color="#111827" style={{ marginRight: 6 }} />
          <Text style={s.title}>이번 주 MVP</Text>
        </View>
        <Text style={s.date}>{mvp.periodLabel ?? ""}</Text>
      </View>
      <View style={s.card}>
        <View style={s.avatarContainer}>
          {mvp.profileImage ? (
            <Image
              source={{ uri: mvp.profileImage as string, cache: "force-cache" }}
              style={s.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )}
        </View>
        <View style={s.info}>
          <Text style={s.name}>{mvp.name}</Text>
          <Text style={s.distance}>주간 거리: {mvp.distanceKm.toFixed(2)} km</Text>
        </View>
        <View style={s.badge}>
          <Text style={s.badgeText}>MVP</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 14, fontWeight: "800", color: "#111827" },
  date: { fontSize: 12, color: "#6B7280" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#9CA3AF", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#111827" },
  distance: { marginTop: 4, fontSize: 12, color: "#374151" },
  badge: { backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
