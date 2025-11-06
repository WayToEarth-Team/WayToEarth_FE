import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { UserProfile } from "../utils/api/users";
import { getMyProfile } from "../utils/api/users";
import { useCrewChat, type ChatMessage } from "../hooks/useCrewChat";
import { getRecentCrewMessages } from "../utils/api/crewChat";

type Params = {
  CrewChat: { crewId: string; crewName: string };
};

// UI-only formatting lives here; transport is in useCrewChat

export default function CrewChatScreen() {
  const route = useRoute<RouteProp<Params, "CrewChat">>();
  const navigation = useNavigation<any>();
  const { crewId, crewName } = route.params || { crewId: "0", crewName: "크루" };

  const [me, setMe] = useState<UserProfile | null>(null);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [seed, setSeed] = useState<ChatMessage[] | undefined>(undefined);
  const { messages, send } = useCrewChat(String(crewId), seed);

  useEffect(() => {
    navigation.setOptions?.({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const p = await getMyProfile();
        setMe(p);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const recent = await getRecentCrewMessages(crewId, 30);
        const mapped: ChatMessage[] = (recent || []).map((m) => ({
          id: String(m.messageId),
          text: String(m.message ?? ""),
          createdAt: m.sentAt ? new Date(m.sentAt).getTime() : Date.now(),
          userId: String(m.senderId),
          nickname: String(m.senderName ?? ""),
          role: "MEMBER",
        }));
        setSeed(mapped);
      } catch {
        setSeed(undefined);
      }
    })();
  }, [crewId]);

  // messages state comes from useCrewChat

  const isMe = useCallback(
    (m: ChatMessage) => {
      const myId = me?.id != null ? String(me.id) : "";
      return m.userId === "me" || (myId && m.userId === myId) || m.nickname === "나";
    },
    [me]
  );

  const onSend = useCallback(async () => {
    const profile = me
      ? { id: String(me.id ?? "me"), nickname: "나", role: "MEMBER" as const }
      : { id: "me", nickname: "나", role: "MEMBER" as const };
    await send(profile, input);
    setInput("");
    listRef.current?.scrollToEnd({ animated: true });
  }, [me, input, send]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const mine = isMe(item);
      return (
        <View style={{ marginBottom: 14 }}>
          {/* 이름 색상: ADMIN/매니저는 포인트 컬러 */}
          <Text
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              color: mine ? "#4A7FE8" : item.role === "ADMIN" ? "#3B82F6" : "#6B7280",
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            {mine ? "나" : item.nickname}
          </Text>
          <View
            style={[
              s.bubble,
              mine ? s.bubbleMe : s.bubbleOther,
              { alignSelf: mine ? "flex-end" : "flex-start" },
            ]}
          >
            <Text style={mine ? s.bubbleTextMe : s.bubbleTextOther}>{item.text}</Text>
          </View>
          <Text
            style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              color: "#9CA3AF",
              fontSize: 11,
              marginTop: 6,
            }}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      );
    },
    [isMe]
  );

  const data = useMemo(() => messages.sort((a, b) => a.createdAt - b.createdAt), [messages]);

  return (
    <SafeAreaView edges={["top"]} style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{crewName}</Text>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={10}
      >
        <FlatList
          ref={listRef}
          contentContainerStyle={s.list}
          data={data}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="메시지를 입력하세요..."
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={s.sendBtn} onPress={onSend}>
            <Ionicons name="send-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = `${d.getMinutes()}`.padStart(2, "0");
  const ampm = h >= 12 ? "오후" : "오전";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${hh}:${m}`;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  list: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleMe: { backgroundColor: "#4A7FE8" },
  bubbleOther: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  bubbleTextMe: { color: "#fff", fontSize: 15, lineHeight: 20 },
  bubbleTextOther: { color: "#111", fontSize: 15, lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    color: "#111",
    backgroundColor: "#fff",
  },
  sendBtn: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A7FE8",
    alignItems: "center",
    justifyContent: "center",
  },
});
