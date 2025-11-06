import { StyleSheet } from "react-native";
import { colors } from "./colors";

export const commonStyles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray700,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.gray500,
    lineHeight: 20,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: colors.indigoLight,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.indigo,
    fontWeight: "500",
  },
});
