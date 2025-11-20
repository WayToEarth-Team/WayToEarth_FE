import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  name: string;
  description?: string;
  progress?: string; // e.g., "3/30"
  imageUrl?: string | null;
  onPress?: () => void;
};

export default function CrewCard({ name, description, progress, imageUrl, onPress }: Props) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.mainRow}>
        {/* 프로필 이미지 */}
        <View style={s.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={s.image} resizeMode="cover" />
          ) : (
            <View style={s.imagePlaceholder}>
              <Ionicons name="people" size={28} color="#9CA3AF" />
            </View>
          )}
        </View>

        {/* 콘텐츠 */}
        <View style={s.content}>
          <View style={s.headerRow}>
            <Text style={s.title} numberOfLines={1}>{name}</Text>
            {progress ? (
              <View style={s.progressBadge}>
                <Ionicons name="people" size={12} color="#6B7280" />
                <Text style={s.progress}>{progress}</Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text style={s.desc} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <View style={s.footer}>
            <Text style={s.joinText}>크루 보기</Text>
            <Ionicons name="arrow-forward" size={14} color="#3B82F6" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mainRow: {
    flexDirection: "row",
    gap: 12,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: 60,
    height: 60,
  },
  imagePlaceholder: {
    width: 60,
    height: 60,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  progressBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  progress: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "700",
  },
  desc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  joinText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3B82F6",
  },
});

