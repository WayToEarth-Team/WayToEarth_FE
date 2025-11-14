import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
};

export default function JoinIntroInput({ value, onChange, onSubmit, submitting }: Props) {
  return (
    <View>
      <View style={s.inputWrap}>
        <Text style={s.inputLabel}>가입 인사 (선택)</Text>
        <TextInput
          style={s.input}
          placeholder="간단한 소개를 남겨보세요"
          value={value}
          onChangeText={onChange}
          multiline
        />
      </View>
      <TouchableOpacity style={[s.applyBtn, submitting && { opacity: 0.6 }]} onPress={onSubmit} disabled={submitting}>
        <Text style={s.applyText}>{submitting ? "신청 중…" : "신청"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  inputWrap: { marginTop: 4 },
  inputLabel: { fontSize: 12, color: "#6B7280", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    minHeight: 84,
    textAlignVertical: "top",
  },
  applyBtn: {
    marginTop: 12,
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  applyText: { color: "#fff", fontWeight: "800" },
});

