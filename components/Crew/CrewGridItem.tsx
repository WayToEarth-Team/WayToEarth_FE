import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  progress?: string; // e.g., "3/30"
  imageUrl?: string | null;
  onPress?: () => void;
};

export default function CrewGridItem({ name, progress, imageUrl, onPress }: Props) {
  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.9}>
      <View style={s.avatarWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={s.avatar} resizeMode="cover" />
        ) : (
          <View style={s.avatarPlaceholder}>
            <Ionicons name="people" size={28} color="#94A3B8" />
          </View>
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>
        {name}
      </Text>
      {progress ? (
        <View style={s.countRow}>
          <Ionicons name="people" size={12} color="#6B7280" />
          <Text style={s.countText}>인원 {progress}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  item: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  avatarWrap: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  countText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
});

