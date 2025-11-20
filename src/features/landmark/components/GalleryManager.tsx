// src/features/landmark/components/GalleryManager.tsx
// 갤러리 이미지 관리 + JSON 자동 삽입 기능 (위치 선택 가능)

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { GalleryImage } from '@types/landmark';
import {
  presignLandmarkImage,
  presignStoryImage,
  uploadToS3,
  guessImageMime,
  addLandmarkGalleryImage,
  deleteLandmarkGalleryImage,
  reorderLandmarkGalleryImages,
  addStoryGalleryImage,
  deleteStoryGalleryImage,
  reorderStoryGalleryImages,
  updateStoryCard,
} from '@utils/api/admin';

type GalleryManagerProps = {
  type: 'landmark' | 'story';
  targetId: number;
  journeyId: number;
  landmarkId: number;
  images: GalleryImage[];
  onRefresh: () => void;
  isAdmin: boolean;
  // 스토리 카드용 (JSON 업데이트)
  storyTitle?: string;
  storyContent?: string;
  storyType?: string;
  storyOrderIndex?: number;
};

export default function GalleryManager({
  type,
  targetId,
  journeyId,
  landmarkId,
  images,
  onRefresh,
  isAdmin,
  storyTitle,
  storyContent,
  storyType,
  storyOrderIndex,
}: GalleryManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [reordering, setReordering] = useState(false);
  
  // JSON 삽입 모드
  const [insertMode, setInsertMode] = useState(false);
  const [insertFrom, setInsertFrom] = useState('0');
  const [insertCount, setInsertCount] = useState('3');
  const [insertPosition, setInsertPosition] = useState<'end' | number>('end');
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [showSectionPreview, setShowSectionPreview] = useState(false);

  if (!isAdmin) {
    return null;
  }

  const safeImages = (images || []).filter(
    (img) => img && img.imageUrl && typeof img.imageUrl === 'string'
  );

  const pickImage = async (): Promise<{ uri: string; mime: string; size: number } | null> => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });
    if (res.canceled) return null;
    const asset = res.assets[0];
    const uri = asset.uri;
    const info = await FileSystem.getInfoAsync(uri);
    const size = (info as any).size ?? 0;
    const mime = guessImageMime(uri);
    return { uri, mime, size };
  };

  const handleAddImage = async () => {
    try {
      setUploading(true);
      const picked = await pickImage();
      if (!picked) return;

      const { uri, mime, size } = picked;

      // presign 요청
      let presign: { upload_url: string; download_url: string; key: string };
      if (type === 'landmark') {
        presign = await presignLandmarkImage({
          journeyId,
          landmarkId,
          contentType: mime,
          size,
        });
      } else {
        presign = await presignStoryImage({
          journeyId,
          landmarkId,
          storyId: targetId,
          contentType: mime,
          size,
        });
      }

      await uploadToS3(presign.upload_url, uri, mime);

      const addFunc = type === 'landmark' ? addLandmarkGalleryImage : addStoryGalleryImage;
      const addResult = await addFunc(targetId, presign.download_url);

      console.log('[GalleryManager] 이미지 추가 응답:', addResult);

      Alert.alert('성공', '이미지가 추가되었습니다.\n페이지를 새로고침 중입니다...');
      onRefresh();
    } catch (err: any) {
      Alert.alert('오류', err?.message || '이미지 추가 실패');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    // 음수 ID는 백엔드에서 제대로 반환하지 않은 임시 ID
    if (imageId < 0) {
      Alert.alert(
        '삭제 불가',
        '이 이미지는 백엔드에서 ID를 제대로 반환하지 않았습니다.\n\n해결 방법:\n1. 백엔드 API가 GalleryImage 객체(id 포함)를 반환하도록 수정\n2. 또는 페이지를 완전히 새로고침한 후 다시 시도'
      );
      return;
    }

    Alert.alert('삭제 확인', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            const deleteFunc =
              type === 'landmark' ? deleteLandmarkGalleryImage : deleteStoryGalleryImage;
            await deleteFunc(imageId);
            Alert.alert('성공', '이미지가 삭제되었습니다.');
            onRefresh();
          } catch (err: any) {
            Alert.alert('오류', err?.message || '삭제 실패');
          }
        },
      },
    ]);
  };

  const handleReorder = async () => {
    Alert.alert(
      '순서 변경',
      `현재 이미지 순서:\n${safeImages.map((img, idx) => `${idx}: 이미지 ID ${img.id}`).join('\n')}\n\n새 순서를 입력하세요 (인덱스 번호를 쉼표로 구분, 예: 2,0,1)`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '확인',
          onPress: () => {
            // React Native는 prompt를 지원하지 않으므로 실제로는 TextInput 모달이 필요합니다
            // 임시로 주석 처리하고 개선된 UI 필요
            Alert.alert('알림', 'React Native에서는 순서 변경을 위한 별도 UI가 필요합니다.');
          },
        },
      ]
    );
  };

  // JSON 삽입 기능
  const handleInsertToJson = async () => {
    if (type !== 'story') {
      Alert.alert('알림', 'JSON 삽입은 스토리 카드에서만 사용 가능합니다.');
      return;
    }

    const from = parseInt(insertFrom);
    const count = parseInt(insertCount);

    if (isNaN(from) || isNaN(count) || from < 0 || count <= 0) {
      Alert.alert('오류', '올바른 숫자를 입력하세요.');
      return;
    }

    if (from + count > safeImages.length) {
      Alert.alert('오류', `이미지가 부족합니다. (현재: ${safeImages.length}장)`);
      return;
    }

    try {
      // 현재 content JSON 파싱
      let parsedContent: any = {};
      try {
        parsedContent = storyContent ? JSON.parse(storyContent) : {};
      } catch {
        parsedContent = {};
      }

      // sections 배열 확인
      if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
        parsedContent.sections = [];
      }

      // gallery_images 섹션 생성
      const newSection = {
        type: 'gallery_images',
        from: from,
        count: count,
      };

      // 삽입 위치 결정
      if (insertPosition === 'end') {
        // 맨 뒤에 추가
        parsedContent.sections.push(newSection);
      } else {
        // 특정 위치에 삽입
        const pos = insertPosition as number;
        if (pos >= 0 && pos <= parsedContent.sections.length) {
          parsedContent.sections.splice(pos, 0, newSection);
        } else {
          // 잘못된 위치면 맨 뒤에
          parsedContent.sections.push(newSection);
        }
      }

      // JSON 문자열로 변환
      const newContent = JSON.stringify(parsedContent, null, 2);

      // 백엔드에 업데이트
      await updateStoryCard(targetId, {
        title: storyTitle,
        content: newContent,
        type: storyType,
        orderIndex: storyOrderIndex,
      });

      const posText = insertPosition === 'end' ? '맨 뒤' : `${insertPosition}번 위치`;
      Alert.alert(
        '완료',
        `갤러리 이미지 ${from}~${from + count - 1}번이 JSON에 추가되었습니다.\n\n삽입 위치: ${posText}\n\n스토리를 새로고침하여 확인하세요!`
      );
      
      setInsertMode(false);
      setInsertFrom('0');
      setInsertCount('3');
      setInsertPosition('end');
      onRefresh();
    } catch (err: any) {
      Alert.alert('오류', err?.message || 'JSON 삽입 실패');
    }
  };

  // 위치 선택 모달
  const PositionModal = () => {
    const [posInput, setPosInput] = useState('');
    
    // 현재 sections 개수 계산
    let sectionCount = 0;
    try {
      const parsed = storyContent ? JSON.parse(storyContent) : {};
      sectionCount = parsed.sections?.length || 0;
    } catch {}

    return (
      <Modal visible={showPositionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>삽입 위치 선택</Text>
            
            <Text style={styles.modalDesc}>
              현재 섹션 개수: {sectionCount}개{'\n'}
              (0번부터 {sectionCount}번까지 입력 가능)
            </Text>

            <View style={styles.positionButtons}>
              <TouchableOpacity
                style={[styles.posButton, insertPosition === 'end' && styles.posButtonActive]}
                onPress={() => setInsertPosition('end')}
              >
                <Text style={styles.posButtonText}>맨 뒤</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.posButton, insertPosition === 0 && styles.posButtonActive]}
                onPress={() => setInsertPosition(0)}
              >
                <Text style={styles.posButtonText}>맨 앞 (0)</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>직접 입력:</Text>
              <TextInput
                style={styles.posInput}
                value={posInput}
                onChangeText={setPosInput}
                placeholder="위치 번호"
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.setButton}
                onPress={() => {
                  const num = parseInt(posInput);
                  if (!isNaN(num) && num >= 0 && num <= sectionCount) {
                    setInsertPosition(num);
                  } else {
                    Alert.alert('오류', `0~${sectionCount} 사이의 숫자를 입력하세요.`);
                  }
                }}
              >
                <Text style={styles.setButtonText}>설정</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.currentPos}>
              현재 선택: {insertPosition === 'end' ? '맨 뒤' : `${insertPosition}번`}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPositionModal(false)}
              >
                <Text style={styles.modalButtonText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // 섹션 미리보기 모달
  const SectionPreviewModal = () => {
    let sections: any[] = [];
    try {
      const parsed = storyContent ? JSON.parse(storyContent) : {};
      sections = parsed.sections || [];
    } catch {}

    const getSectionLabel = (section: any) => {
      switch (section.type) {
        case 'intro':
          return `📝 인트로 - "${section.text?.substring(0, 30)}..."`;
        case 'text':
          return `📄 본문 - "${section.content?.substring(0, 30)}..."`;
        case 'timeline':
          return `📅 타임라인 - ${section.items?.length || 0}개 항목`;
        case 'tips':
          return `💡 팁 - ${section.items?.length || 0}개 항목`;
        case 'image':
          return `🖼️ 단일 이미지`;
        case 'images':
          return `🖼️ 이미지 캐러셀 - ${section.urls?.length || 0}장`;
        case 'gallery_images':
          return `📸 갤러리 이미지 - ${section.from}~${section.from + section.count - 1}번 (${section.count}장)`;
        default:
          return `❓ 알 수 없는 타입: ${section.type}`;
      }
    };

    return (
      <Modal visible={showSectionPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📋 현재 섹션 구조</Text>
            
            <Text style={styles.modalDesc}>
              총 {sections.length}개 섹션{'\n'}
              (삽입 위치 선택 시 참고하세요)
            </Text>

            <ScrollView style={styles.sectionList}>
              {sections.length === 0 ? (
                <Text style={styles.emptySectionText}>섹션이 없습니다.</Text>
              ) : (
                sections.map((section, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.sectionItem,
                      insertPosition === idx && styles.sectionItemSelected
                    ]}
                    onPress={() => {
                      setInsertPosition(idx);
                      setShowSectionPreview(false);
                    }}
                  >
                    <View style={styles.sectionItemHeader}>
                      <Text style={styles.sectionIndex}>#{idx}</Text>
                      {insertPosition === idx && (
                        <Text style={styles.selectedBadge}>선택됨</Text>
                      )}
                    </View>
                    <Text style={styles.sectionLabel}>
                      {getSectionLabel(section)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              
              {/* 맨 뒤에 추가 옵션 */}
              <TouchableOpacity
                style={[
                  styles.sectionItem,
                  styles.endSection,
                  insertPosition === 'end' && styles.sectionItemSelected
                ]}
                onPress={() => {
                  setInsertPosition('end');
                  setShowSectionPreview(false);
                }}
              >
                <View style={styles.sectionItemHeader}>
                  <Text style={styles.sectionIndex}>맨 뒤</Text>
                  {insertPosition === 'end' && (
                    <Text style={styles.selectedBadge}>선택됨</Text>
                  )}
                </View>
                <Text style={styles.sectionLabel}>
                  ⬇️ 여기에 새 섹션 추가
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSectionPreview(false)}
              >
                <Text style={styles.modalButtonText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          갤러리 이미지 ({safeImages.length})
        </Text>
        <View style={styles.headerButtons}>
          {type === 'story' && (
            <TouchableOpacity
              style={[styles.headerButton, insertMode && styles.headerButtonActive]}
              onPress={() => setInsertMode(!insertMode)}
            >
              <Text style={styles.headerButtonText}>📋 JSON 삽입</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleAddImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.headerButtonText}>+ 추가</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {insertMode && (
        <View style={styles.insertPanel}>
          <Text style={styles.insertTitle}>📋 JSON에 갤러리 섹션 삽입</Text>
          
          <View style={styles.insertRow}>
            <Text style={styles.insertLabel}>시작 번호:</Text>
            <TextInput
              style={styles.insertInput}
              value={insertFrom}
              onChangeText={setInsertFrom}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>

          <View style={styles.insertRow}>
            <Text style={styles.insertLabel}>개수:</Text>
            <TextInput
              style={styles.insertInput}
              value={insertCount}
              onChangeText={setInsertCount}
              keyboardType="number-pad"
              placeholder="3"
            />
          </View>

          <TouchableOpacity
            style={styles.positionButton}
            onPress={() => setShowPositionModal(true)}
          >
            <Text style={styles.positionButtonText}>
              📍 삽입 위치: {insertPosition === 'end' ? '맨 뒤' : `${insertPosition}번`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.previewSectionButton}
            onPress={() => setShowSectionPreview(true)}
          >
            <Text style={styles.previewSectionButtonText}>
              👁️ 현재 섹션 구조 보기
            </Text>
          </TouchableOpacity>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>미리보기:</Text>
            <Text style={styles.previewText}>
              갤러리 {insertFrom}~{parseInt(insertFrom) + parseInt(insertCount) - 1}번
            </Text>
            {(() => {
              const from = parseInt(insertFrom);
              const count = parseInt(insertCount);
              if (!isNaN(from) && !isNaN(count) && from >= 0 && count > 0) {
                const previewImages = safeImages.slice(from, from + count);
                return (
                  <ScrollView horizontal style={styles.previewImages}>
                    {previewImages.map((img, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: img.imageUrl }}
                        style={styles.previewImage}
                      />
                    ))}
                  </ScrollView>
                );
              }
              return null;
            })()}
          </View>

          <View style={styles.insertActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setInsertMode(false);
                setInsertFrom('0');
                setInsertCount('3');
                setInsertPosition('end');
              }}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleInsertToJson}>
              <Text style={styles.confirmButtonText}>JSON에 추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
        {safeImages.map((img, idx) => (
          <View key={img.id} style={styles.imageCard}>
            <Image source={{ uri: img.imageUrl }} style={styles.thumbnail} />
            <Text style={styles.imageIndex}>{idx}</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(img.id)}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {safeImages.length > 1 && (
        <TouchableOpacity
          style={styles.reorderButton}
          onPress={handleReorder}
          disabled={reordering}
        >
          {reordering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.reorderButtonText}>순서 변경</Text>
          )}
        </TouchableOpacity>
      )}

      <PositionModal />
      <SectionPreviewModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  headerButtonActive: {
    backgroundColor: '#2196F3',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  insertPanel: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  insertTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 12,
  },
  insertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insertLabel: {
    width: 80,
    fontSize: 14,
    color: '#666',
  },
  insertInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
  },
  positionButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
  },
  positionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  previewSectionButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
  },
  previewSectionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  previewBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 8,
  },
  previewImages: {
    flexDirection: 'row',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 6,
  },
  insertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#999',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gallery: {
    flexDirection: 'row',
  },
  imageCard: {
    marginRight: 12,
    position: 'relative',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  imageIndex: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,0,0,0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 12,
  },
  reorderButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  reorderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  positionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  posButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  posButtonActive: {
    backgroundColor: '#2196F3',
  },
  posButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  posInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  setButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  setButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  currentPos: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
    marginVertical: 12,
  },
  modalButtons: {
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // 섹션 미리보기 스타일
  sectionList: {
    maxHeight: 400,
    marginBottom: 12,
  },
  emptySectionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    paddingVertical: 20,
  },
  sectionItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sectionItemSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  sectionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2196F3',
  },
  selectedBadge: {
    backgroundColor: '#2196F3',
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  endSection: {
    backgroundColor: '#fff7ed',
    borderStyle: 'dashed',
  },
});