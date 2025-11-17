// components/Landmark/StoryCard.tsx
// 랜드마크 스토리 카드 컴포넌트 - 프리미엄 디자인 (HTML 완전 동일)

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryCard as StoryCardType } from '../../types/landmark';
import { STORY_TYPE_LABELS, STORY_TYPE_COLORS } from '../../types/landmark';
import GalleryManager from './GalleryManager';
import DynamicImageGrid from './DynamicImageGrid';
import ImageLightbox from './ImageLightbox';

type Props = {
  story: StoryCardType;
  isAdmin?: boolean;
  journeyId?: number;
  landmarkId?: number;
  onUploadImage?: (storyId: number) => void;
  onDelete?: (storyId: number) => void;
  onRefresh?: () => void;
};

type StoryContentLegacy = {
  intro?: string;
  timeline?: Array<{ year: string; event: string }>;
  tips?: string[];
  description?: string;
};

type Section =
  | { type: 'intro'; text: string }
  | { type: 'text'; content: string }
  | { type: 'timeline'; items: Array<{ year: string; event: string }> }
  | { type: 'tips'; items: string[] }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'images'; urls: string[] }
  | { type: 'gallery_images'; from: number; count: number };

type StoryContentNew = {
  sections: Section[];
};

type StoryContent = StoryContentLegacy | StoryContentNew;

const { width } = Dimensions.get('window');

// HTML과 동일한 타입별 그라디언트
const TYPE_GRADIENTS = {
  HISTORY: ['#667eea', '#764ba2'],
  CULTURE: ['#f093fb', '#f5576c'],
  NATURE: ['#4facfe', '#00f2fe'],
};

export default function StoryCard({
  story,
  isAdmin,
  journeyId,
  landmarkId,
  onUploadImage,
  onDelete,
  onRefresh,
}: Props) {
  const typeLabel = STORY_TYPE_LABELS[story.type];
  const typeGradient = TYPE_GRADIENTS[story.type] || TYPE_GRADIENTS.HISTORY;
  const typeLower = story.type.toLowerCase();

  const galleryImages = story.images || [];

  // 라이트박스 상태
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // HTML fadeInUp 애니메이션 (스크롤 시 나타나는 효과)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const parsedContent = useMemo((): StoryContent => {
    try {
      if (typeof story.content === 'object' && story.content !== null) {
        return story.content as StoryContent;
      }

      let contentStr = String(story.content).trim();

      if (contentStr.startsWith('{')) {
        const openBraces = (contentStr.match(/\{/g) || []).length;
        const closeBraces = (contentStr.match(/\}/g) || []).length;

        if (openBraces !== closeBraces) {
          return { sections: [{ type: 'text', content: story.content }] };
        }

        contentStr = contentStr
          .replace(/[\n\r]/g, ' ')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ');

        const parsed = JSON.parse(contentStr);
        return parsed;
      }
    } catch (e) {
      console.log('[StoryCard] ❌ JSON parse failed');
    }

    return { sections: [{ type: 'text', content: story.content }] };
  }, [story.content]);

  const isNewFormat = 'sections' in parsedContent;

  const extractImageUrls = (images: Array<{imageUrl?: string} | string>): string[] => {
    return images.map(img => typeof img === 'string' ? img : img.imageUrl || '').filter(Boolean);
  };

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  return (
    <Animated.View
      style={[
        styles.storyCard,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* 상단 라인 */}
      <View style={styles.topLine} />

      {/* 카드 내용 */}
      <View style={styles.cardContent}>
        {/* 헤더 */}
        <View style={styles.storyHeader}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.storyTitle}>{story.title}</Text>

        {/* 관리자 버튼 */}
        {isAdmin && (
          <View style={styles.adminButtons}>
            <TouchableOpacity
              style={styles.adminBtnDelete}
              onPress={() => onDelete?.(story.id)}
            >
              <Text style={styles.adminBtnText}>🗑️ 삭제</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 컨텐츠 */}
        {isNewFormat ? (
          (parsedContent as StoryContentNew).sections.map((section, index) => {
            switch (section.type) {
              case 'intro':
                return (
                  <View key={index} style={styles.introSection}>
                    <View style={styles.introGradient}>
                      <View style={styles.introLeftBorder} />
                      <Text style={styles.introText}>{section.text}</Text>
                    </View>
                  </View>
                );

              case 'text':
                return (
                  <View key={index} style={styles.textSection}>
                    <Text style={styles.textContent}>{section.content}</Text>
                  </View>
                );

              case 'timeline':
                return (
                  <View key={index} style={styles.timelineSection}>
                    <View style={styles.sectionTitleContainer}>
                      <View style={styles.sectionTitleBar} />
                      <Text style={styles.sectionTitle}>주요 역사</Text>
                    </View>
                    {section.items.map((item, idx) => (
                      <View key={idx} style={styles.timelineItem}>
                        {/* 점과 라인 */}
                        <View style={styles.timelineLeftColumn}>
                          <View style={styles.timelineDotOuter} />
                          {idx < section.items.length - 1 && (
                            <View style={styles.timelineLine} />
                          )}
                        </View>
                        {/* 내용 */}
                        <View style={styles.timelineRightColumn}>
                          <View style={styles.timelineYearBadge}>
                            <Text style={styles.timelineYear}>{item.year}</Text>
                          </View>
                          <Text style={styles.timelineEvent}>{item.event}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'tips':
                return (
                  <View key={index} style={styles.tipsSection}>
                    <View style={styles.tipsGradient}>
                      <View style={styles.tipsHeader}>
                        <Text style={styles.tipsIcon}>💡</Text>
                        <Text style={styles.tipsTitle}>알고 계셨나요?</Text>
                      </View>
                      {section.items.map((tip, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.tipItem,
                            idx < section.items.length - 1 && styles.tipItemBorder
                          ]}
                        >
                          <View style={styles.tipBullet} />
                          <Text style={styles.tipText}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );

              case 'image':
                return (
                  <View key={index} style={styles.singleImageSection}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => openLightbox([section.url], 0)}
                    >
                      <Image
                        source={{ uri: section.url }}
                        style={styles.singleImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    {section.caption && (
                      <Text style={styles.imageCaption}>{section.caption}</Text>
                    )}
                  </View>
                );

              case 'images':
                return (
                  <DynamicImageGrid
                    key={index}
                    images={section.urls}
                    onPressImage={(imgIndex) => openLightbox(section.urls, imgIndex)}
                  />
                );

              case 'gallery_images':
                const selectedImages = galleryImages.slice(
                  section.from,
                  section.from + section.count
                );
                const imageUrls = extractImageUrls(selectedImages);
                return (
                  <DynamicImageGrid
                    key={index}
                    images={imageUrls}
                    onPressImage={(imgIndex) => openLightbox(imageUrls, imgIndex)}
                  />
                );

              default:
                return null;
            }
          })
        ) : (
          <>
            {(parsedContent as StoryContentLegacy).intro && (
              <View style={styles.introSection}>
                <View style={styles.introGradient}>
                  <View style={styles.introLeftBorder} />
                  <Text style={styles.introText}>{(parsedContent as StoryContentLegacy).intro}</Text>
                </View>
              </View>
            )}

            {(parsedContent as StoryContentLegacy).timeline && (parsedContent as StoryContentLegacy).timeline!.length > 0 && (
              <View style={styles.timelineSection}>
                <View style={styles.sectionTitleContainer}>
                  <View style={styles.sectionTitleBar} />
                  <Text style={styles.sectionTitle}>타임라인</Text>
                </View>
                {(parsedContent as StoryContentLegacy).timeline!.map((item, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <View style={styles.timelineLeftColumn}>
                      <View style={styles.timelineDotOuter} />
                      {index < (parsedContent as StoryContentLegacy).timeline!.length - 1 && (
                        <View style={styles.timelineLine} />
                      )}
                    </View>
                    <View style={styles.timelineRightColumn}>
                      <View style={styles.timelineYearBadge}>
                        <Text style={styles.timelineYear}>{item.year}</Text>
                      </View>
                      <Text style={styles.timelineEvent}>{item.event}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {(parsedContent as StoryContentLegacy).tips && (parsedContent as StoryContentLegacy).tips!.length > 0 && (
              <View style={styles.tipsSection}>
                <View style={styles.tipsGradient}>
                  <View style={styles.tipsHeader}>
                    <Text style={styles.tipsIcon}>💡</Text>
                    <Text style={styles.tipsTitle}>알고 계셨나요?</Text>
                  </View>
                  {(parsedContent as StoryContentLegacy).tips!.map((tip, index) => (
                    <View
                      key={index}
                      style={[
                        styles.tipItem,
                        index < (parsedContent as StoryContentLegacy).tips!.length - 1 && styles.tipItemBorder
                      ]}
                    >
                      <View style={styles.tipBullet} />
                      <Text style={styles.tipText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(parsedContent as StoryContentLegacy).description && (
              <View style={styles.textSection}>
                <Text style={styles.textContent}>{(parsedContent as StoryContentLegacy).description}</Text>
              </View>
            )}

            {galleryImages.length > 0 && (
              <DynamicImageGrid
                images={extractImageUrls(galleryImages)}
                onPressImage={(imgIndex) => openLightbox(extractImageUrls(galleryImages), imgIndex)}
              />
            )}
          </>
        )}
      </View>

      {/* 관리자 갤러리 */}
      {isAdmin && journeyId && landmarkId && (
        <View style={styles.adminGallerySection}>
          <GalleryManager
            type="story"
            targetId={story.id}
            journeyId={journeyId}
            landmarkId={landmarkId}
            images={story.images || []}
            onRefresh={() => onRefresh?.()}
            isAdmin={isAdmin}
            storyTitle={story.title}
            storyContent={story.content}
            storyType={story.type}
            storyOrderIndex={story.orderIndex}
          />
        </View>
      )}

      {/* 라이트박스 */}
      <ImageLightbox
        visible={lightboxVisible}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // 깔끔한 무채색 스토리 카드
  storyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },

  // 상단 라인
  topLine: {
    height: 2,
    width: '100%',
    backgroundColor: '#E5E7EB',
  },

  // 카드 내용
  cardContent: {
    padding: 24,
  },

  // 헤더
  storyHeader: {
    marginBottom: 16,
  },

  // 강조된 타입 뱃지
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // 모던한 제목
  storyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 35,
    letterSpacing: -0.3,
    marginBottom: 8,
    marginTop: 12,
  },

  // 관리자 버튼
  adminButtons: {
    marginTop: 12,
    marginBottom: 12,
  },
  adminBtnDelete: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  adminBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },

  // 깔끔한 intro 섹션
  introSection: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  introGradient: {
    padding: 18,
    paddingLeft: 22,
    position: 'relative',
    backgroundColor: '#F9FAFB',
  },
  introLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#374151',
  },
  introQuote: {
    display: 'none',
  },
  introText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#4B5563',
    fontWeight: '400',
  },

  // 텍스트 섹션
  textSection: {
    marginBottom: 20,
  },
  textContent: {
    fontSize: 15,
    lineHeight: 26,
    color: '#374151',
    fontWeight: '400',
  },

  // 깔끔한 타임라인 섹션
  timelineSection: {
    marginVertical: 24,
    paddingLeft: 4,
  },

  // 섹션 타이틀
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  sectionTitleBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },

  // 타임라인 아이템
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 20,
  },

  // 타임라인 왼쪽 (점 + 라인)
  timelineLeftColumn: {
    width: 28,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDotOuter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: {
    width: 0,
    height: 0,
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
    backgroundColor: '#D1D5DB',
  },

  // 타임라인 오른쪽 (내용)
  timelineRightColumn: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineYearBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: '#374151',
  },
  timelineYear: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timelineEvent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    fontWeight: '400',
  },

  // 깔끔한 Tips 섹션
  tipsSection: {
    marginVertical: 20,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tipsGradient: {
    padding: 18,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  tipsWatermark: {
    display: 'none',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  tipsIcon: {
    fontSize: 18,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: -0.2,
  },
  tipItem: {
    flexDirection: 'row',
    paddingVertical: 9,
    gap: 10,
  },
  tipItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tipBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B7280',
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    fontWeight: '400',
  },

  // 단일 이미지
  singleImageSection: {
    marginVertical: 20,
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // 관리자 갤러리
  adminGallerySection: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 8,
  },
});