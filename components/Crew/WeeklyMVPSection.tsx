import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import CrewRecord from "./CrewRecord";
import { useCrewWeeklyMVP } from "../../hooks/useCrewWeeklyMVP";
import CrewMVPCard from "./CrewMVPCard";

type Props = { crewId: string };

export default function WeeklyMVPSection({ crewId }: Props) {
  const { loading, error, weeklyData, rankingData, totalDistance, percentChange } = useCrewWeeklyMVP(crewId);

  const periodLabel = useMemo(() => {
    const now = new Date();
    // 주 시작(월)과 종료(일) 날짜 계산
    const day = now.getDay(); // 0:Sun..6:Sat
    const diffToMon = (day + 6) % 7; // Mon=0
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMon);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${fmt(start)} - ${fmt(end)}`;
  }, []);

  return (
    <View style={s.wrap}>
      <Text style={s.title}>이번주 MVP</Text>
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#4A90E2" />
          <Text style={s.meta}>불러오는 중…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={[s.meta, { color: "#ef4444" }]}>{error}</Text>
        </View>
      ) : (
        <>
          {/* MVP Card: 랭킹 1위 기준 */}
          {rankingData && rankingData.length > 0 ? (
            <CrewMVPCard
              mvp={{
                name: rankingData[0].name,
                distanceKm: Number(rankingData[0].distance) || 0,
                profileImage: undefined, // 서버에서 이미지가 오면 연결하세요
                periodLabel,
              }}
            />
          ) : null}
          {/* CrewRecord: 주간 차트 + 랭킹 */}
          <CrewRecord
            embedded
            title="지난주 러닝"
            weeklyData={weeklyData}
            rankingData={rankingData}
            totalDistance={totalDistance}
            percentChange={percentChange}
          />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { fontSize: 14, fontWeight: "800", color: "#111827", marginBottom: 8 },
  center: { alignItems: "center", paddingVertical: 12 },
  meta: { marginTop: 6, fontSize: 12, color: "#6B7280" },
});
