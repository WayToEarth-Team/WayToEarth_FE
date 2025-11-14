import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  progress?: string | null; // e.g. "12/50"
  profileImageUrl?: string | null;
  ownerNickname?: string | null;
  isActive?: boolean | null;
};

export default function CrewHeaderCard({ name, progress, profileImageUrl, ownerNickname, isActive }: Props) {
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <View style={s.avatarWrap}>
          {profileImageUrl ? (
            <Image source={{ uri: profileImageUrl }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarFallback}>
              <Ionicons name="people" size={24} color="#6B7280" />
            </View>
          )}
        </View>
        {progress ? <Text style={s.progress}>{progress}</Text> : null}
      </View>
      <Text style={s.name}>{name}</Text>
      {ownerNickname ? <Text style={s.subInfo}>리더 {ownerNickname}</Text> : null}
      {isActive === false ? <Text style={s.inactive}>비활성 크루</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatarWrap: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 56, height: 56, resizeMode: "cover" },
  avatarFallback: { width: 56, height: 56, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 8 },
  subInfo: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  progress: { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  inactive: { marginTop: 4, fontSize: 12, color: "#ef4444", fontWeight: "700" },
});

