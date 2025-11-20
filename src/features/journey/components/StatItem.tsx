import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { colors } from "@assets/styles/colors";

export default function StatItem({
  value,
  color = colors.gray700,
}: {
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statItem: {
    marginRight: 16,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
  },
});
