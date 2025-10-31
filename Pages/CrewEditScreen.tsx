import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getCrewById } from "../utils/api/crews";
import { client } from "../utils/api/client";
import { PositiveAlert, NegativeAlert, MessageAlert, DestructiveConfirm } from "../components/ui/AlertDialog";

export default function CrewEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const crewId = route.params?.crewId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 폼 데이터
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(50);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [dialog, setDialog] = useState<{ open:boolean; title?:string; message?:string; kind?:'positive'|'negative'|'message' }>({ open:false, kind:'message' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    loadCrewData();
  }, []);

  const loadCrewData = async () => {
    console.log("[CrewEdit] ===== 크루 데이터 로드 시작 =====");
    console.log("[CrewEdit] crewId:", crewId);

    if (!crewId) {
      console.log("[CrewEdit] crewId 없음");
      setDialog({ open:true, kind:'negative', title:'오류', message:'크루 정보를 불러올 수 없습니다.' });
      setTimeout(() => navigation.goBack(), 300);
      return;
    }

    setLoading(true);
    try {
      console.log("[CrewEdit] API 호출: getCrewById");
      const crew = await getCrewById(crewId);
      console.log("[CrewEdit] 크루 데이터 로드 성공:", {
        id: crew.id,
        name: crew.name,
        maxMembers: crew.maxMembers,
        hasImage: !!crew.profileImageUrl,
        imageUrl: crew.profileImageUrl,
      });

      setName(crew.name);
      setDescription(crew.description);
      setMaxMembers(crew.maxMembers);
      setProfileImageUrl(crew.profileImageUrl || null);

      console.log("[CrewEdit] State 업데이트 완료");
    } catch (error: any) {
      console.error("[CrewEdit] 크루 데이터 로드 실패:", error);
      console.error("[CrewEdit] 에러 상세:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });
      setDialog({ open:true, kind:'negative', title:'오류', message:'크루 정보를 불러오는데 실패했습니다.' });
    } finally {
      setLoading(false);
      console.log("[CrewEdit] 로딩 완료");
    }
  };

  // 이미지 선택
  const pickImage = async () => {
    console.log("[CrewEdit] 이미지 선택 시작");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("[CrewEdit] 권한 상태:", status);

    if (status !== "granted") {
      console.log("[CrewEdit] 권한 거부됨");
      setDialog({ open:true, kind:'message', title:'권한 필요', message:'사진 라이브러리 접근 권한이 필요합니다.' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    console.log("[CrewEdit] 이미지 선택 결과:", {
      canceled: result.canceled,
      hasAssets: result.assets?.length > 0,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      console.log("[CrewEdit] 선택된 이미지 정보:", {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
      });
      setNewImage(asset);
    }
  };

  // 이미지 삭제
  const deleteImage = async () => {
    setConfirmDelete(true);
  };

  // 이미지 업로드
  const uploadImage = async (): Promise<string | null> => {
    if (!newImage) {
      console.log("[CrewEdit] 업로드할 새 이미지 없음");
      return profileImageUrl;
    }

    console.log("[CrewEdit] ===== 이미지 업로드 시작 =====");
    console.log("[CrewEdit] crewId:", crewId);
    console.log("[CrewEdit] 이미지 정보:", {
      uri: newImage.uri,
      mimeType: newImage.mimeType,
      fileSize: newImage.fileSize,
    });

    try {
      // 1. Presigned URL 발급
      console.log("[CrewEdit] Step 1: Presigned URL 발급 요청");
      const presignPayload = {
        contentType: newImage.mimeType || "image/jpeg",
        size: newImage.fileSize || 0,
      };
      console.log("[CrewEdit] Presign payload:", presignPayload);

      const presignResponse = await client.post(`/v1/files/presign/crew/${crewId}`, presignPayload);

      console.log("[CrewEdit] Presign 응답 받음:", {
        status: presignResponse.status,
        hasData: !!presignResponse.data,
        hasUploadUrl: !!presignResponse.data?.upload_url,
        hasDownloadUrl: !!presignResponse.data?.download_url,
      });

      const { upload_url, download_url } = presignResponse.data;

      if (!upload_url) {
        console.error("[CrewEdit] upload_url이 없음:", presignResponse.data);
        throw new Error("업로드 URL을 받지 못했습니다.");
      }
      if (!download_url) {
        console.error("[CrewEdit] download_url이 없음:", presignResponse.data);
        throw new Error("다운로드 URL을 받지 못했습니다.");
      }

      console.log("[CrewEdit] Upload URL (첫 100자):", upload_url.substring(0, 100));
      console.log("[CrewEdit] Download URL:", download_url);

      // 2. S3에 이미지 업로드
      console.log("[CrewEdit] Step 2: 이미지 Blob 변환 시작");
      const imageBlob = await fetch(newImage.uri).then((r) => r.blob());
      console.log("[CrewEdit] Blob 변환 완료:", {
        size: imageBlob.size,
        type: imageBlob.type,
      });

      console.log("[CrewEdit] Step 3: S3 업로드 시작");
      const uploadResult = await fetch(upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": newImage.mimeType || "image/jpeg",
        },
        body: imageBlob,
      });

      console.log("[CrewEdit] S3 업로드 응답:", {
        ok: uploadResult.ok,
        status: uploadResult.status,
        statusText: uploadResult.statusText,
      });

      if (!uploadResult.ok) {
        const errorText = await uploadResult.text().catch(() => "응답 텍스트 없음");
        console.error("[CrewEdit] S3 업로드 실패 응답:", errorText);
        throw new Error(`S3 업로드 실패: ${uploadResult.status} ${uploadResult.statusText}`);
      }

      console.log("[CrewEdit] ===== 이미지 업로드 성공 =====");
      console.log("[CrewEdit] 최종 download_url:", download_url);
      return download_url;
    } catch (error: any) {
      console.error("[CrewEdit] ===== 이미지 업로드 실패 =====");
      console.error("[CrewEdit] 에러:", error);
      console.error("[CrewEdit] 에러 메시지:", error?.message);
      console.error("[CrewEdit] 에러 상세:", {
        response: error?.response?.data,
        status: error?.response?.status,
      });
      throw new Error(error?.message || "이미지 업로드에 실패했습니다.");
    }
  };

  // 저장
  const handleSave = async () => {
    console.log("[CrewEdit] ===== 저장 시작 =====");

    // 유효성 검사
    if (!name.trim()) {
      console.log("[CrewEdit] 유효성 검사 실패: 크루 이름 없음");
      setDialog({ open:true, kind:'negative', title:'입력 오류', message:'크루 이름을 입력해주세요.' });
      return;
    }
    if (name.length > 50) {
      console.log("[CrewEdit] 유효성 검사 실패: 크루 이름 길이 초과");
      setDialog({ open:true, kind:'negative', title:'입력 오류', message:'크루 이름은 최대 50자까지 입력 가능합니다.' });
      return;
    }
    if (description.length > 500) {
      console.log("[CrewEdit] 유효성 검사 실패: 크루 소개 길이 초과");
      setDialog({ open:true, kind:'negative', title:'입력 오류', message:'크루 소개는 최대 500자까지 입력 가능합니다.' });
      return;
    }
    if (maxMembers < 2 || maxMembers > 100) {
      console.log("[CrewEdit] 유효성 검사 실패: 최대 인원 범위 초과");
      setDialog({ open:true, kind:'negative', title:'입력 오류', message:'최대 인원은 2명에서 100명 사이로 설정해주세요.' });
      return;
    }

    console.log("[CrewEdit] 유효성 검사 통과");
    console.log("[CrewEdit] 저장할 데이터:", {
      name: name.trim(),
      descriptionLength: description.trim().length,
      maxMembers,
      hasNewImage: !!newImage,
      currentImageUrl: profileImageUrl,
    });

    setSaving(true);
    try {
      // 이미지 업로드 (새 이미지가 있는 경우)
      let finalImageUrl = profileImageUrl;
      if (newImage) {
        console.log("[CrewEdit] 새 이미지 업로드 진행");
        finalImageUrl = await uploadImage();
        console.log("[CrewEdit] 이미지 업로드 완료, URL:", finalImageUrl);
      } else {
        console.log("[CrewEdit] 이미지 변경 없음");
      }

      // 크루 정보 업데이트
      console.log("[CrewEdit] 크루 정보 업데이트 요청");
      const updatePayload = {
        name: name.trim(),
        description: description.trim(),
        maxMembers,
        profileImageUrl: finalImageUrl,
      };
      console.log("[CrewEdit] Update payload:", updatePayload);

      const updateResponse = await client.put(`/v1/crews/${crewId}`, updatePayload);

      console.log("[CrewEdit] 크루 정보 업데이트 성공:", {
        status: updateResponse.status,
        data: updateResponse.data,
      });

      console.log("[CrewEdit] ===== 저장 완료 =====");
      setDialog({ open:true, kind:'positive', title:'완료', message:'크루 정보가 수정되었습니다.' });
    } catch (error: any) {
      console.error("[CrewEdit] ===== 저장 실패 =====");
      console.error("[CrewEdit] 에러:", error);
      console.error("[CrewEdit] 에러 상세:", {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
      });

      const message = error?.response?.data?.message || error?.message || "저장에 실패했습니다.";
      setDialog({ open:true, kind:'negative', title:'오류', message });
    } finally {
      setSaving(false);
      console.log("[CrewEdit] 저장 프로세스 종료");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="light-content" />
        <View style={[s.blueHeader, { paddingTop: insets.top + 8 }]}>
          <View style={s.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>크루 정보 수정</Text>
            <View style={{ width: 24 }} />
          </View>
        </View>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#4A7FE8" />
          <Text style={s.loadingText}>로딩 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {dialog.open && dialog.kind === 'positive' && (
        <PositiveAlert visible title={dialog.title} message={dialog.message} onClose={() => { setDialog({ open:false, kind:'message' }); navigation.goBack(); }} />
      )}
      {dialog.open && dialog.kind === 'negative' && (
        <NegativeAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {dialog.open && dialog.kind === 'message' && (
        <MessageAlert visible title={dialog.title} message={dialog.message} onClose={() => setDialog({ open:false, kind:'message' })} />
      )}
      {confirmDelete && (
        <DestructiveConfirm
          visible
          title="이미지 삭제"
          message="프로필 이미지를 삭제하시겠습니까?"
          onClose={() => setConfirmDelete(false)}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              console.log("[CrewEdit] 이미지 삭제 요청 시작:", crewId);
              await client.delete(`/v1/files/crew/${crewId}/profile`);
              console.log("[CrewEdit] 이미지 삭제 성공");
              setProfileImageUrl(null);
              setNewImage(null);
              setDialog({ open:true, kind:'positive', title:'완료', message:'프로필 이미지가 삭제되었습니다.' });
            } catch (error: any) {
              console.error("[CrewEdit] 이미지 삭제 실패:", error);
              console.error("[CrewEdit] 에러 상세:", {
                status: error?.response?.status,
                message: error?.response?.data?.message,
                data: error?.response?.data,
              });
              setDialog({ open:true, kind:'negative', title:'오류', message: (error?.response?.data?.message || '이미지 삭제에 실패했습니다.') });
            } finally {
              setConfirmDelete(false);
            }
          }}
        />
      )}
      <StatusBar barStyle="light-content" />

      {/* 헤더 */}
      <View style={[s.blueHeader, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>크루 정보 수정</Text>
          <View style={{ width: 24 }} />
        </View>
      </View>

      <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
        {/* 프로필 이미지 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>프로필 이미지</Text>
          <View style={s.imageContainer}>
            {(newImage || profileImageUrl) ? (
              <Image
                source={{ uri: newImage?.uri || profileImageUrl || undefined }}
                style={s.profileImage}
              />
            ) : (
              <View style={s.imagePlaceholder}>
                <Ionicons name="image-outline" size={48} color="#9CA3AF" />
                <Text style={s.placeholderText}>이미지 없음</Text>
              </View>
            )}
          </View>
          <View style={s.imageButtons}>
            <TouchableOpacity style={s.imageBtn} onPress={pickImage}>
              <Ionicons name="camera" size={18} color="#4A7FE8" />
              <Text style={s.imageBtnText}>이미지 변경</Text>
            </TouchableOpacity>
            {(profileImageUrl || newImage) && (
              <TouchableOpacity style={s.deleteBtnOutline} onPress={deleteImage}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={s.deleteBtnText}>삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 크루 이름 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>크루 이름 *</Text>
          <TextInput
            style={s.input}
            placeholder="크루 이름을 입력하세요 (최대 50자)"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <Text style={s.charCount}>{name.length}/50</Text>
        </View>

        {/* 크루 소개 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>크루 소개</Text>
          <TextInput
            style={[s.input, s.textArea]}
            placeholder="크루를 소개해주세요 (최대 500자)"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{description.length}/500</Text>
        </View>

        {/* 최대 인원 */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>최대 인원</Text>
            <Text style={s.maxMemberValue}>{maxMembers}명</Text>
          </View>
          <View style={s.memberControl}>
            <TouchableOpacity
              style={[s.memberBtn, maxMembers <= 2 && s.memberBtnDisabled]}
              onPress={() => maxMembers > 2 && setMaxMembers(maxMembers - 1)}
              disabled={maxMembers <= 2}
            >
              <Ionicons
                name="remove"
                size={20}
                color={maxMembers <= 2 ? "#D1D5DB" : "#4A7FE8"}
              />
            </TouchableOpacity>
            <View style={s.memberRange}>
              <Text style={s.rangeText}>2명</Text>
              <View style={s.rangeBar}>
                <View
                  style={[
                    s.rangeBarFill,
                    { width: `${((maxMembers - 2) / 98) * 100}%` },
                  ]}
                />
              </View>
              <Text style={s.rangeText}>100명</Text>
            </View>
            <TouchableOpacity
              style={[s.memberBtn, maxMembers >= 100 && s.memberBtnDisabled]}
              onPress={() => maxMembers < 100 && setMaxMembers(maxMembers + 1)}
              disabled={maxMembers >= 100}
            >
              <Ionicons
                name="add"
                size={20}
                color={maxMembers >= 100 ? "#D1D5DB" : "#4A7FE8"}
              />
            </TouchableOpacity>
          </View>
          <Text style={s.helpText}>크루의 최대 멤버 수를 설정합니다 (2~100명)</Text>
        </View>

        {/* 저장 버튼 */}
        <View style={s.section}>
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnText}>저장</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  blueHeader: { backgroundColor: "#4A7FE8" },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  scrollView: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { fontSize: 16, color: "#6B7280" },

  // 섹션
  section: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
  },

  // 이미지
  imageContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E5E7EB",
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 4,
  },
  imageButtons: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  imageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  imageBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4A7FE8",
  },
  deleteBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EF4444",
  },

  // 입력
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 6,
  },

  // 최대 인원
  maxMemberValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A7FE8",
  },
  memberControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  memberBtnDisabled: {
    backgroundColor: "#F3F4F6",
  },
  memberRange: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rangeText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },
  rangeBar: {
    flex: 1,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  rangeBarFill: {
    height: "100%",
    backgroundColor: "#4A7FE8",
    borderRadius: 3,
  },

  // 저장 버튼
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#4A7FE8",
    paddingVertical: 14,
    borderRadius: 10,
  },
  saveBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
