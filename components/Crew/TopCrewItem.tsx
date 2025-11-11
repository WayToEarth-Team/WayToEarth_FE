import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  rank: string;
  distance: string;
  name?: string; // 실제 크루명 표시
  image?: ImageSourcePropType;
  highlight?: boolean; // deprecated: size로 대체
  size?: "lg" | "md" | "sm";
  onPress?: () => void;
};

export default function TopCrewItem({
  rank,
  distance,
  name,
  image,
  highlight,
  size = highlight ? "lg" : "md",
  onPress,
}: Props) {
  const dim = size === "lg" ? 90 : size === "md" ? 75 : 62;

  // 등수별 색상 (1등: 금, 2등: 은, 3등: 동)
  const rankNum = parseInt(rank);
  const borderColor = rankNum === 1 ? "#FFD700" : rankNum === 2 ? "#C0C0C0" : "#CD7F32";
  const shadowColor = rankNum === 1 ? "#FFD700" : rankNum === 2 ? "#C0C0C0" : "#CD7F32";

  return (
    <TouchableOpacity style={s.wrap} onPress={onPress} activeOpacity={0.8}>
      {/* 등수 뱃지 */}
      <View style={[s.rankBadge, { backgroundColor: borderColor }]}>
        <Ionicons
          name={rankNum === 1 ? "trophy" : "medal"}
          size={16}
          color="#fff"
        />
      </View>

      {/* 프로필 이미지 */}
      <View
        style={[
          s.imgWrap,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            borderWidth: size === "lg" ? 4 : 3,
            borderColor: borderColor,
            shadowColor: shadowColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      >
        {image ? (
          <Image
            source={image}
            style={{ width: dim, height: dim, borderRadius: dim / 2 }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name="people"
            size={dim * 0.5}
            color="#4A90E2"
          />
        )}
      </View>

      {/* 크루명 */}
      {name ? (
        <Text style={[s.name, size === "lg" && s.nameLarge]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}

      {/* 거리 */}
      <View style={[s.distanceBadge, { backgroundColor: borderColor }]}>
        <Text style={s.distanceText}>{distance}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", position: "relative" },
  imgWrap: {
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  rankBadge: {
    position: "absolute",
    top: -12,
    alignSelf: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderWidth: 2,
    borderColor: "#fff",
  },
  rankBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  name: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 92,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 4,
  },
  nameLarge: {
    fontSize: 14,
    fontWeight: "800",
  },
  distanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 0,
  },
  distanceText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
