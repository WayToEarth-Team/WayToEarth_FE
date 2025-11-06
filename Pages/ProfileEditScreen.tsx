// screens/ProfileEditScreen.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { client } from "../utils/api/client";
import { checkNickname, getMyProfile } from "../utils/api/users";
// import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileEditScreen({ navigation }: { navigation: any }) {
  // form state
  const [nickname, setNickname] = useState("");
  const [originalNickname, setOriginalNickname] = useState(""); // ✅ 원래 닉네임 보관
  const [residence, setResidence] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState(""); // 문자열로 관리 후 전송 시 숫자화
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [profileImageKey, setProfileImageKey] = useState<string | null>(null);
  const [imageCacheBuster, setImageCacheBuster] = useState(Date.now());

  // ui state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 닉네임 중복 체크 (별도 저장 플로우)
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [nicknameSaving, setNicknameSaving] = useState(false); // ✅ 닉네임만 저장 상태
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기값 로드
  const loadMe = useCallback(async () => {
    try {
      setLoading(true);
      const me = await getMyProfile();
      const nk = (me as any)?.nickname ?? "";
      setNickname(nk);
      setOriginalNickname(nk); // ✅ 원본 셋
      setResidence((me as any)?.residence ?? "");
      setWeeklyGoal(
        (me as any)?.weekly_goal_distance != null
          ? String((me as any).weekly_goal_distance)
          : ""
      );
      setProfileImageUrl(
        (me as any)?.profileImageUrl ?? (me as any)?.profile_image_url ?? ""
      );
      setProfileImageKey((me as any)?.profile_image_key ?? null);
      setNicknameError(null);
    } catch (e) {
      console.warn(e);
      Alert.alert("오류", "내 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // 닉네임 중복 확인 (디바운스 400ms) — ✅ 원래 닉네임과 다를 때만 검사
  useEffect(() => {
    const trimmed = nickname?.trim() || "";
    if (!trimmed || trimmed === originalNickname) {
      // 비어있거나 변경 없음 → 오류 초기화 & 검사 안 함
      setNicknameError(null);
      setNicknameChecking(false);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setNicknameChecking(true);

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await checkNickname(trimmed);
        setNicknameError(
          res.isDuplicate ? "이미 사용 중인 닉네임입니다." : null
        );
      } catch {
        // API 실패 시 저장을 막지 않도록 오류표시는 하지 않음
        setNicknameError(null);
      } finally {
        setNicknameChecking(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [nickname, originalNickname]);

  // 저장 가능 여부 (✅ 닉네임 오류와 무관 — 닉네임은 별도 버튼으로 저장)
  const canSaveProfile = useMemo(() => {
    if (loading || saving || uploading) return false;
    return true;
  }, [loading, saving, uploading]);

  // 닉네임 변경 버튼 활성 조건
  const canChangeNickname = useMemo(() => {
    const trimmed = nickname?.trim() || "";
    if (nicknameSaving || nicknameChecking) return false;
    if (!trimmed) return false;
    if (trimmed === originalNickname) return false; // 변경 없음
    if (nicknameError) return false; // 중복/오류 시 비활성
    return true;
  }, [
    nickname,
    originalNickname,
    nicknameError,
    nicknameSaving,
    nicknameChecking,
  ]);

  // S3 업로드용: MIME 추론
  const guessMime = (nameOrUri: string) => {
    const ext = (nameOrUri?.split(".").pop() || "").toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
  };

  // 프로필 사진 변경 (선택 → presign → S3 PUT → DB 저장)
  const onChangePhoto = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "사진 접근 권한이 필요합니다.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (picked.canceled) return;

      const asset = picked.assets[0];
      const fileUri = asset.uri; // file://...
      const fileName = fileUri.split("/").pop() || "profile.jpg";
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || info.isDirectory) {
        Alert.alert("오류", "파일을 찾을 수 없거나 폴더입니다.");
        return;
      }
      const size =
        typeof (info as any).size === "number" ? (info as any).size : 0;
      const contentType = guessMime(fileName);

      if (size <= 0) {
        Alert.alert("오류", "파일 크기를 확인할 수 없습니다.");
        return;
      }
      if (size > 5 * 1024 * 1024) {
        Alert.alert("용량 초과", "최대 5MB까지 업로드할 수 있습니다.");
        return;
      }

      // presign 요청
      const { data } = await client.post("/v1/files/presign/profile", {
        fileName,
        contentType,
        size,
      });
      console.log("[presign response]", data);

      // 서버 응답: upload_url / download_url(public_url 호환) 대응
      const signedUrl =
        data?.upload_url ??
        data?.signed_url ??
        data?.signedUrl ??
        data?.uploadUrl;
      const downloadUrl =
        data?.download_url ??
        data?.public_url ??
        data?.downloadUrl ??
        data?.publicUrl;
      const key = data?.key ?? data?.file_key ?? data?.fileKey;

      if (!signedUrl || !downloadUrl) {
        Alert.alert("오류", "업로드 URL 발급에 실패했습니다.");
        return;
      }

      setUploading(true);

      // S3 업로드 (PUT) - Cache-Control 헤더 필수!
      const resUpload = await FileSystem.uploadAsync(signedUrl, fileUri, {
        httpMethod: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(size),
          "Cache-Control": "no-cache, no-store, must-revalidate", // 백엔드 서명에 포함된 헤더
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });
      if (!(resUpload.status === 200 || resUpload.status === 204)) {
        throw new Error(`S3 업로드 실패: ${resUpload.status}`);
      }

      // DB 저장 (key만 전달 - 가이드 권장사항)
      console.log("[ProfileEdit] DB 저장 요청:", {
        profile_image_key: key || null,
      });

      const updateRes = await client.put("/v1/users/me", {
        profile_image_key: key,
      });

      console.log("[ProfileEdit] DB 저장 응답:", updateRes.data);

      // Cache-Control 헤더로 캐시 문제 해결 + 로컬 state 업데이트
      setProfileImageUrl(downloadUrl);
      if (key) setProfileImageKey(key);
      setImageCacheBuster(Date.now()); // UI 강제 리렌더링
      Alert.alert("완료", "프로필 사진이 변경되었습니다.");
    } catch (e: any) {
      console.warn(e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "이미지 업로드에 실패했습니다.";
      Alert.alert("오류", msg);
    } finally {
      setUploading(false);
    }
  }, []);

  // 닉네임만 별도로 저장
  const onChangeNickname = useCallback(async () => {
    try {
      if (!canChangeNickname) return;
      setNicknameSaving(true);
      const trimmed = nickname.trim();
      if (trimmed.length < 2) {
        Alert.alert("오류", "닉네임은 2자 이상이어야 합니다.");
        return;
      }
      console.log("PUT /v1/users/me (nickname)", { nickname: trimmed });
      await client.put("/v1/users/me", { nickname: trimmed });
      setOriginalNickname(trimmed); // ✅ 원본 갱신
      setNicknameError(null);
      Alert.alert("완료", "닉네임이 변경되었습니다.");
    } catch (e: any) {
      console.warn(e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "닉네임 변경에 실패했습니다.";
      Alert.alert("오류", msg);
    } finally {
      setNicknameSaving(false);
    }
  }, [canChangeNickname, nickname]);

  // 나머지 필드 저장 (닉네임 제외)
  const onSaveProfile = useCallback(async () => {
    if (!canSaveProfile) return;
    try {
      setSaving(true);
      const weeklyGoalNumberRaw =
        weeklyGoal?.trim() === "" ? undefined : Number(weeklyGoal);
      const weeklySanitized =
        typeof weeklyGoalNumberRaw === "number" &&
        !Number.isNaN(weeklyGoalNumberRaw)
          ? Math.max(0.01, weeklyGoalNumberRaw)
          : undefined;

      const urlOk = Boolean(
        profileImageUrl && /^https?:\/\//i.test(profileImageUrl)
      );

      const payload = {
        // nickname 제외 ✅ (닉네임은 onChangeNickname 경로)
        residence: residence?.trim() || undefined,
        // 서버 스펙: snake_case 사용
        profile_image_url: urlOk ? profileImageUrl!.trim() : undefined,
        ...(profileImageKey ? { profile_image_key: profileImageKey } : {}),
        weekly_goal_distance: weeklySanitized,
      };
      console.log("PUT /v1/users/me", payload);
      await client.put("/v1/users/me", payload);
      Alert.alert("완료", "프로필이 수정되었습니다.");
      await loadMe();
      // 저장 후 이전 화면으로 복귀하면 focus에서 재조회
      navigation?.goBack?.();
    } catch (e: any) {
      console.warn(e);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "프로필 수정에 실패했습니다.";
      Alert.alert("오류", msg);
    } finally {
      setSaving(false);
    }
  }, [canSaveProfile, residence, profileImageUrl, weeklyGoal, loadMe]);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { flex: 1, justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>불러오는 중…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 상단 제목 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>기본 정보 관리</Text>
      </View>

      {/* 본문 */}
      <View style={styles.main}>
        <Text style={styles.title}>프로필 정보를 수정하세요!</Text>
        <Text style={styles.subtitle}>
          러닝을 시작하기 위한{"\n"}기본 정보를 업데이트해주세요
        </Text>

        {/* 프로필 사진 */}
        <View style={styles.profileImage}>
          {profileImageUrl ? (
            <Image
              key={imageCacheBuster}
              source={{
                uri:
                  profileImageUrl +
                  (profileImageUrl.includes("?") ? "&" : "?") +
                  `_cache=${imageCacheBuster}`,
              }}
              style={{ width: 100, height: 100, borderRadius: 50 }}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={40} color="#666" />
          )}
        </View>
        <TouchableOpacity onPress={onChangePhoto} disabled={uploading}>
          <Text style={[styles.changePhoto, uploading && { opacity: 0.6 }]}>
            {uploading ? "업로드 중…" : "프로필 사진 변경"}
          </Text>
        </TouchableOpacity>

        {/* 닉네임 (별도 변경 버튼) */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>닉네임</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View
              style={[
                styles.input,
                { flex: 1, flexDirection: "row", alignItems: "center" },
              ]}
            >
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="닉네임을 입력하세요"
                placeholderTextColor="rgba(68,68,68,0.27)"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                maxLength={20}
              />
              {nicknameChecking && (
                <ActivityIndicator style={{ marginLeft: 8 }} />
              )}
            </View>

            <TouchableOpacity
              onPress={onChangeNickname}
              disabled={!canChangeNickname}
              style={[
                styles.nickChangeBtn,
                { opacity: canChangeNickname ? 1 : 0.5 },
              ]}
            >
              {nicknameSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nickChangeBtnText}>변경</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 입력 오른쪽 배지 제거, 필요 시 하단 안내만 */}
          {!!nicknameError && (
            <Text style={{ color: "#d00", marginTop: 6 }}>{nicknameError}</Text>
          )}
        </View>

        {/* 거주 지역 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>거주 지역</Text>
          <View style={styles.input}>
            <TextInput
              style={styles.textInput}
              placeholder="예) 강원도 춘천시"
              placeholderTextColor="rgba(68,68,68,0.27)"
              value={residence}
              onChangeText={setResidence}
            />
          </View>
        </View>

        {/* 주간 목표 거리 */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>주간 목표 거리 (km)</Text>
          <View style={styles.input}>
            <TextInput
              style={styles.textInput}
              placeholder="예) 25"
              placeholderTextColor="rgba(68,68,68,0.27)"
              value={weeklyGoal}
              onChangeText={(v) => setWeeklyGoal(v.replace(/[^\d]/g, ""))} // 숫자만
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={4}
            />
          </View>
        </View>

        {/* 저장 버튼 (닉네임 제외) */}
        <TouchableOpacity
          style={[styles.saveButton, { opacity: canSaveProfile ? 1 : 0.5 }]}
          disabled={!canSaveProfile}
          onPress={onSaveProfile}
        >
          {saving || uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>변경사항 저장</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#fff", paddingBottom: 30, flex: 1 },
  statusBar: {
    backgroundColor: "#fff",
    paddingTop: 21,
    height: 51,
    alignItems: "center",
  },
  statusFrame: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 268,
  },
  time: { paddingHorizontal: 16 },
  timeText: { fontSize: 17, fontWeight: "600", color: "#000" },
  dynamicIsland: { width: 124, height: 10 },
  levels: { flexDirection: "row", gap: 7, paddingHorizontal: 6 },
  icon: { width: 20, height: 13, resizeMode: "contain" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 70,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2dddd",
  },
  backButton: { fontSize: 24, color: "#333" },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 20,
    color: "#333",
  },

  main: { padding: 20 },
  title: { fontSize: 21, fontWeight: "700", color: "#333" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 5, lineHeight: 20 },

  profileImage: {
    backgroundColor: "#e8ecf0",
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 30,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  profileIcon: { fontSize: 28, color: "#666" },
  changePhoto: {
    fontSize: 14,
    color: "#4A6CF7",
    textDecorationLine: "underline",
    textAlign: "center",
    marginTop: 10,
  },

  formGroup: { marginTop: 20 },
  label: { fontSize: 14, fontWeight: "500", color: "#333", marginBottom: 5 },
  input: {
    backgroundColor: "#e8ecf0",
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 54,
    justifyContent: "center",
  },
  textInput: { fontSize: 16, color: "#222", paddingVertical: 8 },

  // 닉네임 변경 버튼
  nickChangeBtn: {
    backgroundColor: "#070708",
    borderRadius: 12,
    height: 54,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  nickChangeBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  saveButton: {
    backgroundColor: "#070708",
    borderRadius: 12,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  saveButtonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
