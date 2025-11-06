import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";

type Props = {
  weekly: any | null;
  weeklyGoal: string;
  setWeeklyGoal: (v: string) => void;
  isEditingGoal: boolean;
  setIsEditingGoal: (v: boolean) => void;
  savingGoal: boolean;
  onSave: () => void;
};

export default function GoalCard({
  weekly,
  weeklyGoal,
  setWeeklyGoal,
  isEditingGoal,
  setIsEditingGoal,
  savingGoal,
  onSave,
}: Props) {
  const total = Number(weekly?.totalDistance ?? 0);
  const goalNum = Number(weeklyGoal || 0);
  const percent = goalNum > 0 ? Math.min(100, Math.round((total / goalNum) * 100)) : 0;

  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#111" }}>주간 목표</Text>
          <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600", marginTop: 4 }}>주간 목표 거리 (km)</Text>
        </View>
        {!isEditingGoal ? (
          <TouchableOpacity style={{ backgroundColor: "#111", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }} onPress={() => setIsEditingGoal(true)}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>편집</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!isEditingGoal ? (
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#111" }}>{goalNum > 0 ? goalNum : "-"}</Text>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#111" }}>목표 거리 입력</Text>
          <View style={{ backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, height: 48, justifyContent: "center", paddingHorizontal: 16 }}>
            <TextInput
              value={weeklyGoal}
              onChangeText={setWeeklyGoal}
              placeholder="예: 20"
              keyboardType="numeric"
              style={{ fontSize: 16 }}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: "#111", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: "center" }} onPress={onSave} disabled={savingGoal}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{savingGoal ? "저장 중..." : "저장"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: "#E5E7EB", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: "center" }} onPress={() => setIsEditingGoal(false)}>
              <Text style={{ color: "#6B7280", fontSize: 14, fontWeight: "600" }}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ height: 10, backgroundColor: "#E5E7EB", borderRadius: 5, overflow: "hidden", marginTop: 16, marginBottom: 12 }}>
        <View style={{ height: "100%", backgroundColor: "#10b981", borderRadius: 5, width: `${percent}%` }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 14, color: "#6B7280", fontWeight: "600" }}>진행도</Text>
        <Text style={{ fontSize: 14, color: "#10b981", fontWeight: "700" }}>{percent}%</Text>
      </View>
    </View>
  );
}

