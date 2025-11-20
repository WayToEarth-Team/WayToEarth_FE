// Pages/LandmarkStoryScreen.tsx
// 랜드마크 스토리 상세 페이지 - 프리미엄 디자인 (HTML 완전 동일)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  TextInput,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import StoryCard from '@features/landmark/components/StoryCard';
import StoryTypeTabs from '@features/landmark/components/StoryTypeTabs';
import GuestbookCreateModal from '@features/guestbook/components/GuestbookCreateModal';
import LandmarkStatistics from '@features/guestbook/components/LandmarkStatistics';
import GalleryManager from '@features/landmark/components/GalleryManager';
import { getLandmarkDetail } from '@utils/api/landmarks';
import { getMyProfile } from '@utils/api/users';
import { presignLandmarkImage, presignStoryImage, updateLandmarkImage, updateStoryImage, uploadToS3, guessImageMime, createStoryCard, updateStoryCard, deleteStoryCard } from '@utils/api/admin';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import type { LandmarkDetail, StoryType } from '@types/landmark';

type RouteParams = {
  route?: {
    params?: {
      landmarkId: number;
      userId?: number;
      distanceM?: number;
    };
  };
  navigation?: any;
};

const { width, height } = Dimensions.get('window');

export default function LandmarkStoryScreen({ route, navigation }: RouteParams = {}) {
  const params = route?.params || {};
  const landmarkId = params.landmarkId;
  const userId = params.userId;
  const distanceFromParam = params.distanceM;

  const [loading, setLoading] = useState(true);
  const [landmark, setLandmark] = useState<LandmarkDetail | null>(null);
  const [selectedType, setSelectedType] = useState<StoryType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guestbookModalVisible, setGuestbookModalVisible] = useState(false);
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [forceUserView, setForceUserView] = useState(false);
  const [journeyIdInput, setJourneyIdInput] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryContent, setNewStoryContent] = useState('');
  const [newStoryType, setNewStoryType] = useState<StoryType>('HISTORY');

  // HTML fadeInUp 애니메이션 (순차적 등장)
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const heroSlideAnim = useRef(new Animated.Value(30)).current;
  const tabsFadeAnim = useRef(new Animated.Value(0)).current;
  const tabsSlideAnim = useRef(new Animated.Value(20)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(20)).current;

  // landmarkId 변경 시 즉시 로딩 상태로 전환 + 애니메이션 리셋
  useEffect(() => {
    setLoading(true);
    setLandmark(null);
    setError(null);

    // 페이드 애니메이션 값 리셋
    heroFadeAnim.setValue(0);
    heroSlideAnim.setValue(30);
    tabsFadeAnim.setValue(0);
    tabsSlideAnim.setValue(20);
    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(20);

    loadLandmarkDetail();
  }, [landmarkId, userId]);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMyProfile();
        const adminCheck = String(me?.role || '').toUpperCase() === 'ADMIN';
        setIsAdmin(adminCheck);
      } catch (error) {
        setIsAdmin(false);
      }
    })();
  }, []);

  // 위에서 아래로 순차적 애니메이션 (자연스러운 등장)
  useEffect(() => {
    if (landmark) {
      // 1. Hero (즉시 시작)
      Animated.parallel([
        Animated.timing(heroFadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(heroSlideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Tabs (150ms 후)
      Animated.parallel([
        Animated.timing(tabsFadeAnim, {
          toValue: 1,
          duration: 500,
          delay: 150,
          useNativeDriver: true,
        }),
        Animated.timing(tabsSlideAnim, {
          toValue: 0,
          duration: 500,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // 3. Content (300ms 후)
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 500,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 500,
          delay: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [landmark]);

  const loadLandmarkDetail = async () => {
    if (!landmarkId) {
      setError('랜드마크 ID가 없습니다.');
      setLoading(false);
      return;
    }

    const startTime = Date.now();
    const MIN_LOADING_TIME = 2000; // 최소 2초 로딩

    try {
      setLoading(true);
      setError(null);
      const data = await getLandmarkDetail(landmarkId, userId);

      console.log('[LandmarkStoryScreen] 백엔드 응답 원본:', JSON.stringify({
        landmarkImages: data.images,
        firstStoryImages: data.storyCards?.[0]?.images
      }, null, 2));

      if (data.images && Array.isArray(data.images)) {
        data.images = data.images.map((img: any, idx: number) => {
          if (typeof img === 'string') {
            console.warn('[LandmarkStoryScreen] ⚠️ 랜드마크 이미지가 문자열로 옴:', img);
            return { id: -(idx + 1), imageUrl: img, orderIndex: idx };
          }
          console.log('[LandmarkStoryScreen] ✅ 랜드마크 이미지 객체:', img);
          return img;
        });
      }

      if (data.storyCards && Array.isArray(data.storyCards)) {
        data.storyCards = data.storyCards.map((story: any) => {
          if (story.images && Array.isArray(story.images)) {
            story.images = story.images.map((img: any, idx: number) => {
              if (typeof img === 'string') {
                console.warn(`[LandmarkStoryScreen] ⚠️ 스토리 ${story.id} 이미지가 문자열로 옴:`, img);
                return { id: -(idx + 1), imageUrl: img, orderIndex: idx };
              }
              console.log(`[LandmarkStoryScreen] ✅ 스토리 ${story.id} 이미지 객체:`, img);
              return img;
            });
          }
          return story;
        });
      }

      // 최소 로딩 시간 보장 (부드러운 UX)
      const elapsedTime = Date.now() - startTime;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setLandmark(data);
    } catch (err: any) {
      console.error('[LandmarkStoryScreen] 랜드마크 로드 실패:', err);

      // 에러 시에도 최소 로딩 시간 보장
      const elapsedTime = Date.now() - startTime;
      const remainingTime = MIN_LOADING_TIME - elapsedTime;
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setError(err?.response?.data?.message || '랜드마크 정보를 불러올 수 없습니다.');
      Alert.alert('오류', '랜드마크 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const showAdminView = isAdmin && !forceUserView;

  const filteredStories = landmark?.storyCards.filter((story) => {
    if (selectedType === null) return true;
    return story.type === selectedType;
  }) || [];

  const pickImage = async (): Promise<{ uri: string; mime: string; size: number } | null> => {
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      quality: 0.9 
    });
    if (res.canceled) return null;
    const asset = res.assets[0];
    const uri = asset.uri;
    const info = await FileSystem.getInfoAsync(uri);
    const size = (info as any).size ?? 0;
    const mime = guessImageMime(uri);
    return { uri, mime, size };
  };

  const ensureJourneyId = (): number | null => {
    const n = Number(journeyIdInput);
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert('여정 ID 필요', '관리자 업로드를 위해 여정 ID를 입력해주세요.');
      return null;
    }
    return n;
  };

  const handleUploadLandmarkImage = async () => {
    try {
      if (!isAdmin) return Alert.alert('권한 없음', '관리자만 업로드할 수 있습니다.');
      const jid = ensureJourneyId();
      if (!jid) return;
      const sel = await pickImage();
      if (!sel) return;
      setUploading(true);
      const presign = await presignLandmarkImage({ journeyId: jid, landmarkId, contentType: sel.mime, size: sel.size });
      await uploadToS3(presign.upload_url, sel.uri, sel.mime);
      await updateLandmarkImage(landmarkId, presign.download_url);
      Alert.alert('완료', '랜드마크 이미지가 업데이트되었습니다.');
      await loadLandmarkDetail();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '업로드에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadStoryImage = async (storyId: number) => {
    try {
      if (!isAdmin) return Alert.alert('권한 없음', '관리자만 업로드할 수 있습니다.');
      const jid = ensureJourneyId();
      if (!jid) return;

      const currentStory = landmark?.storyCards.find(s => s.id === storyId);
      if (!currentStory) {
        return Alert.alert('오류', '스토리를 찾을 수 없습니다.');
      }

      const sel = await pickImage();
      if (!sel) return;
      setUploading(true);
      const presign = await presignStoryImage({ journeyId: jid, landmarkId, storyId, contentType: sel.mime, size: sel.size });
      await uploadToS3(presign.upload_url, sel.uri, sel.mime);

      await updateStoryCard(storyId, {
        title: currentStory.title,
        content: currentStory.content,
        type: currentStory.type as any,
        orderIndex: currentStory.orderIndex || 0,
        imageUrl: presign.download_url,
      });

      Alert.alert('완료', '스토리 이미지가 업데이트되었습니다.');
      await loadLandmarkDetail();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '업로드에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateStory = async () => {
    try {
      if (!newStoryTitle.trim() || !newStoryContent.trim()) {
        return Alert.alert('입력 필요', '제목과 내용을 모두 입력해주세요.');
      }
      setUploading(true);
      const orderIndex = landmark?.storyCards.length || 0;
      await createStoryCard({
        landmarkId,
        title: newStoryTitle.trim(),
        content: newStoryContent.trim(),
        type: newStoryType,
        orderIndex,
      });
      Alert.alert('완료', '스토리가 생성되었습니다.');
      setCreateModalVisible(false);
      setNewStoryTitle('');
      setNewStoryContent('');
      setNewStoryType('HISTORY');
      await loadLandmarkDetail();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '스토리 생성에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStory = async (storyId: number) => {
    Alert.alert(
      '스토리 삭제',
      '정말 이 스토리를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              await deleteStoryCard(storyId);
              Alert.alert('완료', '스토리가 삭제되었습니다.');
              await loadLandmarkDetail();
            } catch (e: any) {
              const msg = e?.response?.data?.message || e?.message || '삭제에 실패했습니다.';
              Alert.alert('오류', msg);
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  // 깔끔한 로딩 스크린 (iOS 스타일)
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>로딩 중</Text>
      </View>
    );
  }

  if (error || !landmark) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#a0522d" style={{ marginBottom: 8 }} />
          <Text style={styles.errorText}>{error || '랜드마크를 찾을 수 없습니다.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLandmarkDetail}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleOpenGuestbook = () => {
    setBottomSheetVisible(false);
    setGuestbookModalVisible(true);
  };

  const handleViewGuestbooks = () => {
    setBottomSheetVisible(false);
    navigation.navigate('LandmarkGuestbookScreen', {
      landmarkId: landmarkId,
      landmarkName: landmark?.name || '',
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* HTML: .hero-header */}
        <View style={styles.heroHeader}>
          {landmark.imageUrl ? (
            <Image
              source={{ uri: landmark.imageUrl }}
              style={styles.heroBg}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            >
              <Ionicons name="business-outline" size={80} color="#FFFFFF" style={{ alignSelf: 'center', marginTop: 170 }} />
            </LinearGradient>
          )}

          {/* HTML: .hero-overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.heroOverlay}
          />

          {/* 뒤로가기 버튼 */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* 메뉴 버튼 */}
          <TouchableOpacity style={styles.menuButton} onPress={() => setBottomSheetVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* HTML: .hero-content */}
          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: heroFadeAnim,
                transform: [{ translateY: heroSlideAnim }]
              }
            ]}
          >
            {landmark.hasStamp && (
              <View style={styles.stampBadge}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.stampBadgeText}>스탬프 획득</Text>
                </View>
              </View>
            )}
            <Text style={styles.heroTitle}>{landmark.name}</Text>
            <Text style={styles.heroDescription}>{landmark.description}</Text>
            <Text style={styles.heroDistance}>
              {(((distanceFromParam ?? landmark.distanceFromStart) || 0) / 1000).toFixed(1)}km 지점
            </Text>
          </Animated.View>
        </View>

        {/* HTML: .tabs-container */}
        <Animated.View
          style={[
            styles.tabsContainer,
            {
              opacity: tabsFadeAnim,
              transform: [{ translateY: tabsSlideAnim }]
            }
          ]}
        >
          <StoryTypeTabs
            selectedType={selectedType}
            onSelectType={setSelectedType}
          />
        </Animated.View>

        {/* 콘텐츠 영역 전체 (순차적 등장) */}
        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }]
          }}
        >
          {/* 관리자 뷰 전환 버튼 */}
          {isAdmin && (
            <View style={styles.viewToggleContainer}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, !forceUserView && styles.viewToggleBtnActive]}
                onPress={() => setForceUserView(false)}
              >
                <Text style={[styles.viewToggleText, !forceUserView && styles.viewToggleTextActive]}>
                  관리자
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, forceUserView && styles.viewToggleBtnActive]}
                onPress={() => setForceUserView(true)}
              >
                <Text style={[styles.viewToggleText, forceUserView && styles.viewToggleTextActive]}>
                  사용자
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 관리자 패널 */}
          {showAdminView && (
            <View style={styles.adminPanel}>
              <Text style={styles.adminTitle}>관리자 이미지 업로드</Text>
              <TextInput
                style={styles.adminInput}
                placeholder="여정 ID"
                keyboardType="number-pad"
                value={journeyIdInput}
                onChangeText={setJourneyIdInput}
                placeholderTextColor="#92400E"
              />
              <TouchableOpacity
                style={[styles.adminBtn, uploading && { opacity: 0.6 }]}
                disabled={uploading}
                onPress={handleUploadLandmarkImage}
              >
                <Text style={styles.adminBtnText}>
                  {uploading ? '업로드 중…' : '랜드마크 커버 이미지 업로드'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.adminHelp}>커버 이미지는 랜드마크 대표 이미지입니다.</Text>

              {journeyIdInput && Number(journeyIdInput) > 0 && (
                <GalleryManager
                  type="landmark"
                  targetId={landmarkId}
                  journeyId={Number(journeyIdInput)}
                  landmarkId={landmarkId}
                  images={landmark?.images || []}
                  onRefresh={loadLandmarkDetail}
                  isAdmin={showAdminView}
                />
              )}
            </View>
          )}

          {/* HTML: .content-section */}
          <View style={styles.contentSection}>
          {showAdminView && (
            <TouchableOpacity
              style={styles.createStoryBtn}
              onPress={() => setCreateModalVisible(true)}
              disabled={uploading}
            >
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.createStoryGradient}
              >
                <Text style={styles.createStoryText}>+ 새 스토리 추가</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {filteredStories.length > 0 ? (
            <>
              {filteredStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  isAdmin={showAdminView}
                  journeyId={journeyIdInput ? Number(journeyIdInput) : undefined}
                  landmarkId={landmarkId}
                  onUploadImage={handleUploadStoryImage}
                  onDelete={handleDeleteStory}
                  onRefresh={loadLandmarkDetail}
                />
              ))}
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>
                {selectedType ? '해당 타입의 스토리가 없습니다.' : '스토리가 없습니다.'}
              </Text>
            </View>
          )}
        </View>
        </Animated.View>
      </ScrollView>

      {/* 방명록 버튼 */}
      <View style={styles.floatingActions}>
        <TouchableOpacity
          style={styles.guestbookBtn}
          onPress={() => setGuestbookModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.guestbookText}>방명록 작성</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={handleViewGuestbooks}
          activeOpacity={0.8}
        >
          <Text style={styles.viewAllText}>전체 보기</Text>
        </TouchableOpacity>
      </View>

      {/* 방명록 모달 */}
      {landmark && (
        <GuestbookCreateModal
          visible={guestbookModalVisible}
          onClose={() => setGuestbookModalVisible(false)}
          landmark={{
            id: landmark.id,
            name: landmark.name,
            cityName: landmark.cityName,
            countryCode: landmark.countryCode,
            imageUrl: landmark.imageUrl || '',
          }}
          userId={userId || 1}
          onSuccess={() => {
            setGuestbookModalVisible(false);
          }}
        />
      )}

      {/* 바텀시트 */}
      <Modal
        visible={bottomSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBottomSheetVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBottomSheetVisible(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />

            {landmark && (
              <>
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>{landmark.name}</Text>
                  <Text style={styles.bottomSheetSubtitle}>
                    {(landmark.distanceFromStart / 1000).toFixed(1)}km 지점
                  </Text>
                </View>

                <View style={styles.statisticsContainer}>
                  <LandmarkStatistics landmarkId={landmark.id} />
                </View>

                <View style={styles.menuOptions}>
                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={handleOpenGuestbook}
                  >
                    <Ionicons name="create-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.menuOptionText}>방명록 작성</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.menuOption}
                    onPress={handleViewGuestbooks}
                  >
                    <Ionicons name="book-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                    <Text style={styles.menuOptionText}>방명록 보기</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.menuOption, styles.menuOptionCancel]}
                    onPress={() => setBottomSheetVisible(false)}
                  >
                    <Text style={styles.menuOptionText}>닫기</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* 스토리 생성 모달 */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCreateModalVisible(false)}
        >
          <Pressable style={styles.createModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>새 스토리 추가</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.createModalContent}>
              <Text style={styles.createModalLabel}>제목</Text>
              <TextInput
                style={styles.createModalInput}
                placeholder="스토리 제목을 입력하세요"
                value={newStoryTitle}
                onChangeText={setNewStoryTitle}
                maxLength={100}
              />

              <Text style={styles.createModalLabel}>타입</Text>
              <View style={styles.typeButtons}>
                {(['HISTORY', 'CULTURE', 'NATURE'] as StoryType[]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newStoryType === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setNewStoryType(type)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name={type === 'HISTORY' ? 'book-outline' : type === 'CULTURE' ? 'color-palette-outline' : 'leaf-outline'}
                        size={16}
                        color={newStoryType === type ? '#FFFFFF' : '#6B7280'}
                      />
                      <Text
                        style={[
                          styles.typeButtonText,
                          newStoryType === type && styles.typeButtonTextActive,
                        ]}
                      >
                        {type === 'HISTORY' ? '역사' : type === 'CULTURE' ? '문화' : '자연'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.createModalLabel}>내용</Text>
              <TextInput
                style={[styles.createModalInput, styles.createModalTextArea]}
                placeholder="스토리 내용을 입력하세요"
                value={newStoryContent}
                onChangeText={setNewStoryContent}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={2000}
              />

              <TouchableOpacity
                style={[styles.createModalSubmit, uploading && { opacity: 0.6 }]}
                onPress={handleCreateStory}
                disabled={uploading}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.createModalSubmitGradient}
                >
                  <Text style={styles.createModalSubmitText}>
                    {uploading ? '생성 중…' : '스토리 생성'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // HTML: body background
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa', // HTML gradient start color approximation
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  // 깔끔한 로딩 스크린
  loadingScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    letterSpacing: 0.5,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // HTML: .hero-header
  heroHeader: {
    position: 'relative',
    height: 420,
    shadowColor: 'rgba(102, 126, 234, 0.3)',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 10,
  },

  // HTML: .hero-bg
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  heroPlaceholderText: {
    fontSize: 80,
    alignSelf: 'center',
    marginTop: 170,
  },

  // HTML: .hero-overlay
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },

  // 버튼들
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backButtonText: {
    fontSize: 38,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -6,
  },
  menuButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  menuButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // HTML: .hero-content
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
    zIndex: 2,
  },

  // HTML: .stamp-badge
  stampBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: 'rgba(16, 185, 129, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  stampBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // HTML: .hero-title
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
    letterSpacing: -0.5,
  },

  // HTML: .hero-description
  heroDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 8,
    lineHeight: 25.6, // 1.6 * 16
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // HTML: .hero-distance
  heroDistance: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // HTML: .tabs-container
  tabsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },

  // 뷰 전환 토글
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewToggleBtnActive: {
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // 관리자 패널
  adminPanel: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 0,
    marginBottom: 16,
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 12,
  },
  adminInput: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    fontSize: 14,
    color: '#92400E',
  },
  adminBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    marginBottom: 8,
  },
  adminBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  adminHelp: {
    marginTop: 4,
    fontSize: 12,
    color: '#92400E',
  },

  // HTML: .content-section
  contentSection: {
    paddingTop: 32,
    paddingBottom: 100,
  },

  // 스토리 생성 버튼
  createStoryBtn: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createStoryGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  createStoryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },

  // 깔끔한 방명록 버튼
  floatingActions: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 10,
    zIndex: 100,
  },

  // 방명록 작성 버튼
  guestbookBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  guestbookText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // 전체 보기 버튼
  viewAllBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  viewAllText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  // 모달들
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    minHeight: 400,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  bottomSheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  bottomSheetSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statisticsContainer: {
    marginBottom: 20,
  },
  menuOptions: {
    gap: 12,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  menuOptionCancel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
  },

  // 생성 모달
  createModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    width: '100%',
    marginTop: 'auto',
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  createModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  createModalClose: {
    fontSize: 24,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  createModalContent: {
    padding: 20,
  },
  createModalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  createModalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  createModalTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  createModalSubmit: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  createModalSubmitGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  createModalSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
