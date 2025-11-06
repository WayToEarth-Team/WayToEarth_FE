import React from "react";
import { View, Text, Dimensions } from "react-native";

type Daily = { day: string; distance: number };
type Props = { weekly?: { dailyDistances?: Daily[] } };

export default function WeeklyChart({ weekly }: Props) {
  const width = Dimensions.get("window").width;
  const dailyDistances: Daily[] = weekly?.dailyDistances || [];
  const chartHeight = 120;
  const barWidth = Math.floor((width - 80) / 7);
  if (!dailyDistances.length)
    return (
      <View style={{ padding: 16, alignItems: "center" }}>
        <Text style={{ color: "#9CA3AF" }}>주간 데이터가 없습니다</Text>
      </View>
    );

  const distances = dailyDistances.map((d) => d?.distance ?? 0);
  const weekMax = Math.max(...distances, 0.1);
  const maxDistance = Math.max(weekMax * 1.05, 1);
  const dayLabel = (d: string) =>
    (({
      MONDAY: "월",
      TUESDAY: "화",
      WEDNESDAY: "수",
      THURSDAY: "목",
      FRIDAY: "금",
      SATURDAY: "토",
      SUNDAY: "일",
    } as any)[d] ?? d?.slice?.(0, 1) ?? "");
  const todayIndex = new Date().getDay(); // 0(일)~6(토)

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: chartHeight,
          marginTop: 12,
        }}
      >
        {dailyDistances.map((item, idx) => {
          const distance = typeof item?.distance === "number" ? item.distance : 0;
          const h = Math.max((distance / maxDistance) * chartHeight, 2);
          const isToday = (idx + 1) % 7 === todayIndex; // 월(0)->1 ... 일(6)->0
          const isFull = distance >= weekMax * 0.95 && distance > 0;
          return (
            <View key={idx} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ justifyContent: "flex-end", height: chartHeight, marginBottom: 8 }}>
                <View
                  style={{
                    height: h,
                    width: barWidth - 10,
                    borderRadius: 6,
                    backgroundColor: isFull
                      ? "#059669"
                      : isToday
                      ? "#22c55e"
                      : distance > 0
                      ? "#10b981"
                      : "#e5e7eb",
                  }}
                />
              </View>
              <Text style={{ fontSize: 12, color: isToday ? "#22c55e" : "#666", fontWeight: isToday ? "700" : "400" }}>
                {dayLabel(item?.day || "")}
              </Text>
              <Text style={{ fontSize: 11, color: distance > 0 ? "#333" : "#b3b3b3" }}>
                {distance > 0 ? distance.toFixed(1) : "0"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

