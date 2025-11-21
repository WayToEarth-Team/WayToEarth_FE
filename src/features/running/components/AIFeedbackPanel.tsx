import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type Props = {
  singleCount: number;
  recentSingleRecordIds: number[];
  onOpenFeedback: () => void;
};

export default function AIFeedbackPanel({ singleCount, recentSingleRecordIds, onOpenFeedback }: Props) {
  const eligible = singleCount >= 5 && recentSingleRecordIds.length > 0;

  return (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={s.title}>AI Coaching</Text>
        {eligible ? (
          <TouchableOpacity onPress={onOpenFeedback} style={s.ctaPrimary}>
            <Text style={s.ctaPrimaryText}>View Details</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {eligible ? (
        <>
          <Text style={s.desc}>Coaching summary based on your latest 10 runs.</Text>
          <View style={{ marginTop: 10 }}>
            <View style={s.rowBetween}>
              <Text style={s.k}>Single runs</Text>
              <Text style={s.v}>{singleCount}</Text>
            </View>
            <View style={s.rowBetween}>
              <Text style={s.k}>Analyzed records</Text>
              <Text style={s.v}>{Math.min(10, recentSingleRecordIds.length)}</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={s.desc}>AI analysis unlocks after 5 single runs.</Text>
          <View style={s.progressRow}>
            <Text style={s.progressText}>Progress</Text>
            <Text style={s.progressValue}>{Math.min(5, singleCount)} / 5</Text>
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: "800", color: "#111" },
  desc: { marginTop: 8, color: "#374151" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  k: { color: "#6B7280" },
  v: { color: "#111", fontWeight: "700" },
  ctaPrimary: { backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  ctaPrimaryText: { color: "#fff", fontWeight: "700" },
  progressRow: { flexDirection: "row", marginTop: 10, justifyContent: "space-between" },
  progressText: { color: "#6B7280" },
  progressValue: { color: "#111", fontWeight: "800" },
});
