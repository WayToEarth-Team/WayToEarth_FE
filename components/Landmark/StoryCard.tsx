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
      {/* 상단 그라디언트 라인 (hover 효과는 웹 전용이므로 제외) */}
      <LinearGradient
        colors={typeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topLine}
      />

      {/* 카드 내용 */}
      <View style={styles.cardContent}>
        {/* 헤더 */}
        <View style={styles.storyHeader}>
          <LinearGradient
            colors={typeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.typeBadge}
          >
            <Text style={styles.typeBadgeText}>{typeLabel.toUpperCase()}</Text>
          </LinearGradient>
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
                    <LinearGradient
                      colors={['#f8f9fa', '#e9ecef']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.introGradient}
                    >
                      <View style={styles.introLeftBorder} />
                      <Text style={styles.introQuote}>"</Text>
                      <Text style={styles.introText}>{section.text}</Text>
                    </LinearGradient>
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
                      <LinearGradient
                        colors={typeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.sectionTitleBar}
                      />
                      <Text style={styles.sectionTitle}>주요 역사</Text>
                    </View>
                    {section.items.map((item, idx) => (
                      <View key={idx} style={styles.timelineItem}>
                        {/* 점과 라인 */}
                        <View style={styles.timelineLeftColumn}>
                          <View style={styles.timelineDotOuter}>
                            <LinearGradient
                              colors={typeGradient}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.timelineDot}
                            />
                          </View>
                          {idx < section.items.length - 1 && (
                            <LinearGradient
                              colors={[`rgba(102, 126, 234, 0.3)`, 'transparent']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                              style={styles.timelineLine}
                            />
                          )}
                        </View>
                        {/* 내용 */}
                        <View style={styles.timelineRightColumn}>
                          <LinearGradient
                            colors={typeGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.timelineYearBadge}
                          >
                            <Text style={styles.timelineYear}>{item.year}</Text>
                          </LinearGradient>
                          <Text style={styles.timelineEvent}>{item.event}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                );

              case 'tips':
                return (
                  <View key={index} style={styles.tipsSection}>
                    <LinearGradient
                      colors={['#fff7ed', '#fed7aa']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.tipsGradient}
                    >
                      <Text style={styles.tipsWatermark}>💡</Text>
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
                    </LinearGradient>
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
                <LinearGradient
                  colors={['#f8f9fa', '#e9ecef']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.introGradient}
                >
                  <View style={styles.introLeftBorder} />
                  <Text style={styles.introQuote}>"</Text>
                  <Text style={styles.introText}>{(parsedContent as StoryContentLegacy).intro}</Text>
                </LinearGradient>
              </View>
            )}

            {(parsedContent as StoryContentLegacy).timeline && (parsedContent as StoryContentLegacy).timeline!.length > 0 && (
              <View style={styles.timelineSection}>
                <View style={styles.sectionTitleContainer}>
                  <LinearGradient
                    colors={typeGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.sectionTitleBar}
                  />
                  <Text style={styles.sectionTitle}>타임라인</Text>
                </View>
                {(parsedContent as StoryContentLegacy).timeline!.map((item, index) => (
                  <View key={index} style={styles.timelineItem}>
                    <View style={styles.timelineLeftColumn}>
                      <View style={styles.timelineDotOuter}>
                        <LinearGradient
                          colors={typeGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.timelineDot}
                        />
                      </View>
                      {index < (parsedContent as StoryContentLegacy).timeline!.length - 1 && (
                        <LinearGradient
                          colors={[`rgba(102, 126, 234, 0.3)`, 'transparent']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={styles.timelineLine}
                        />
                      )}
                    </View>
                    <View style={styles.timelineRightColumn}>
                      <LinearGradient
                        colors={typeGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.timelineYearBadge}
                      >
                        <Text style={styles.timelineYear}>{item.year}</Text>
                      </LinearGradient>
                      <Text style={styles.timelineEvent}>{item.event}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {(parsedContent as StoryContentLegacy).tips && (parsedContent as StoryContentLegacy).tips!.length > 0 && (
              <View style={styles.tipsSection}>
                <LinearGradient
                  colors={['#fff7ed', '#fed7aa']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tipsGradient}
                >
                  <Text style={styles.tipsWatermark}>💡</Text>
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
                </LinearGradient>
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
  // HTML: .story-card
  storyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginBottom: 32,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },

  // 상단 그라디언트 라인
  topLine: {
    height: 0, // 초기에는 안보임
    width: '100%',
  },

  // HTML: padding: 32px
  cardContent: {
    padding: 32,
  },

  // HTML: .story-header
  storyHeader: {
    marginBottom: 24,
  },

  // HTML: .type-badge
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // HTML: .story-title
  storyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 36.4, // 1.3 * 28
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  // 관리자 버튼
  adminButtons: {
    marginTop: 16,
    marginBottom: 16,
  },
  adminBtnDelete: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  adminBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },

  // HTML: .intro-section
  introSection: {
    marginBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  introGradient: {
    padding: 24,
    paddingLeft: 28, // +4px for border
    position: 'relative',
  },
  introLeftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#6366f1',
  },
  introQuote: {
    position: 'absolute',
    top: -10,
    left: 10,
    fontSize: 80,
    color: 'rgba(99, 102, 241, 0.1)',
    fontFamily: 'Georgia',
    fontWeight: '700',
  },
  introText: {
    fontSize: 16,
    lineHeight: 28.8, // 1.8 * 16
    color: '#4b5563',
  },

  // HTML: .text-section
  textSection: {
    marginBottom: 28,
  },
  textContent: {
    fontSize: 16,
    lineHeight: 30.4, // 1.9 * 16
    color: '#374151',
  },

  // HTML: .timeline-section
  timelineSection: {
    marginVertical: 40,
    paddingLeft: 20,
  },

  // HTML: .section-title
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  sectionTitleBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },

  // HTML: .timeline-item
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 32,
  },

  // 타임라인 왼쪽 (점 + 라인)
  timelineLeftColumn: {
    width: 40,
    alignItems: 'center',
    paddingTop: 8,
  },
  timelineDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(102, 126, 234, 0.2)', // box-shadow 대체
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
  },

  // 타임라인 오른쪽 (내용)
  timelineRightColumn: {
    flex: 1,
    paddingLeft: 0,
  },
  timelineYearBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: 'rgba(102, 126, 234, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  timelineYear: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  timelineEvent: {
    fontSize: 15,
    lineHeight: 25.5, // 1.7 * 15
    color: '#4b5563',
  },

  // HTML: .tips-section
  tipsSection: {
    marginVertical: 32,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fdba74',
    shadowColor: 'rgba(251, 146, 60, 0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
  },
  tipsGradient: {
    padding: 28,
    position: 'relative',
  },
  tipsWatermark: {
    position: 'absolute',
    top: -20,
    right: -20,
    fontSize: 120,
    opacity: 0.1,
    transform: [{ rotate: '15deg' }],
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  tipsIcon: {
    fontSize: 28,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#9a3412',
  },
  tipItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  tipItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154, 52, 18, 0.2)',
    borderStyle: 'dashed',
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f97316',
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 25.5, // 1.7 * 15
    color: '#7c2d12',
  },

  // 단일 이미지
  singleImageSection: {
    marginVertical: 24,
  },
  singleImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  imageCaption: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // 관리자 갤러리
  adminGallerySection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
});