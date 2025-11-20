import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function CrewDescription({
  description,
}: {
  description?: string | null;
}) {
  if (!description) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.desc} numberOfLines={5}>
        {description}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 12 },
  desc: { marginTop: 4, fontSize: 13, color: "#374151", lineHeight: 18 },
});
