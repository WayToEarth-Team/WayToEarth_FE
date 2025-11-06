import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  onSearch?: () => void;
};

export default function SearchBar({ value, onChangeText, onSearch }: Props) {
  return (
    <View style={s.container}>
      <View style={s.inputWrapper}>
        <Ionicons
          name="search"
          size={20}
          color="#9CA3AF"
          style={s.searchIcon}
        />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="크루 이름으로 검색"
          placeholderTextColor="#9CA3AF"
          style={s.input}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText("")} style={s.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    padding: 0,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
});
