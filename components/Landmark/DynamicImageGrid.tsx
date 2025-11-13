// components/Landmark/DynamicImageGrid.tsx
// 동적 이미지 그리드 - 2장은 캐러셀 형식

import React, { useState, useRef, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity, Text, ScrollView, NativeScrollEvent, NativeSyntheticEvent, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from 'react-native-pager-view';

type Props = {
  images: string[];
  onPressImage?: (index: number) => void;
};

const { width: screenWidth } = Dimensions.get('window');
const CARD_PADDING = 40; // 20px * 2 (좌우)

export default function DynamicImageGrid({ images, onPressImage }: Props) {
  const count = images.length;
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (count === 0) return null;

  // HTML: .grid-1 (1장)
  if (count === 1) {
    return (
      <View style={styles.imageGrid}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => onPressImage?.(0)}
          style={[styles.gridItem, styles.gridItemHover]}
        >
          <Image
            source={{ uri: images[0] }}
            style={styles.gridImageSingle}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // 2장: 스와이프 캐러셀 🔄 (PagerView 사용 - 확실하게 작동)
  if (count === 2) {
    const pagerRef = useRef<PagerView>(null);

    // 이미지 높이 정확히 계산 (16:9 비율)
    const PAGE_PADDING = 8;
    const imageWidth = screenWidth - CARD_PADDING - 64 - PAGE_PADDING * 2; // 카드 패딩(32*2) + 페이지 패딩
    const imageHeight = (imageWidth * 9) / 16;
    const pagerHeight = imageHeight + PAGE_PADDING * 2;

    // 자동 스와이프 (3초마다)
    useEffect(() => {
      const interval = setInterval(() => {
        const nextIndex = (currentIndex + 1) % images.length;
        pagerRef.current?.setPage(nextIndex);
      }, 3000);

      return () => clearInterval(interval);
    }, [currentIndex, images.length]);

    return (
      <View style={styles.imageGrid}>
        <PagerView
          ref={pagerRef}
          style={[styles.pagerView, { height: pagerHeight }]}
          initialPage={0}
          onPageSelected={(e) => setCurrentIndex(e.nativeEvent.position)}
        >
          {images.map((uri, idx) => (
            <View key={idx} style={styles.pagerPage}>
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => onPressImage?.(idx)}
                style={styles.carouselItem}
              >
                <Image
                  source={{ uri }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          ))}
        </PagerView>

        {/* 인디케이터 */}
        <View style={styles.indicatorContainer}>
          {images.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.indicator,
                currentIndex === idx && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  // HTML: .grid-3 (3장) - 좌측 1장 크게, 우측 2장 세로 스택
  if (count === 3) {
    const GAP = 8;
    const TOTAL_WIDTH = screenWidth - CARD_PADDING - 64; // 카드 패딩 고려
    const leftWidth = TOTAL_WIDTH * 0.62;
    const rightWidth = TOTAL_WIDTH * 0.38 - GAP;
    const rightItemHeight = (leftWidth - GAP) / 2; // 비율 맞춤

    return (
      <View style={styles.imageGrid}>
        <View style={[styles.grid3Container, { gap: GAP }]}>
          {/* 좌측 큰 이미지 */}
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => onPressImage?.(0)}
            style={[styles.gridItem, styles.gridItemHover, styles.grid3Left, { width: leftWidth }]}
          >
            <Image
              source={{ uri: images[0] }}
              style={styles.grid3LeftImage}
              resizeMode="cover"
            />
          </TouchableOpacity>

          {/* 우측 2장 세로 스택 */}
          <View style={[styles.grid3Right, { width: rightWidth, gap: GAP }]}>
            {images.slice(1, 3).map((uri, idx) => (
              <TouchableOpacity
                key={idx + 1}
                activeOpacity={0.95}
                onPress={() => onPressImage?.(idx + 1)}
                style={[styles.gridItem, styles.gridItemHover, { height: rightItemHeight }]}
              >
                <Image
                  source={{ uri }}
                  style={styles.gridImageFull}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // HTML: 4장 이상 - 2x2 그리드 + 오버레이 (중앙 정렬, 크기 축소)
  const GAP = 8; // 간격 줄임
  const TOTAL_PADDING = CARD_PADDING + 64; // 카드 내부 패딩(32*2) 고려
  const itemSize = (screenWidth - TOTAL_PADDING - GAP) / 2; // 더 작게
  const visible = images.slice(0, 4);
  const moreCount = count - 4;

  return (
    <View style={styles.imageGrid}>
      <View style={[styles.gridRow, { gap: GAP }]}>
        {visible.slice(0, 2).map((uri, idx) => (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.95}
            onPress={() => onPressImage?.(idx)}
            style={[styles.gridItem, styles.gridItemHover, { width: itemSize, height: itemSize }]}
          >
            <Image
              source={{ uri }}
              style={styles.gridImageFull}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.gridRow, { gap: GAP }]}>
        {visible.slice(2, 4).map((uri, idx) => {
          const realIdx = idx + 2;
          const isLast = realIdx === 3 && moreCount > 0;
          return (
            <TouchableOpacity
              key={realIdx}
              activeOpacity={0.95}
              onPress={() => onPressImage?.(realIdx)}
              style={[styles.gridItem, styles.gridItemHover, { width: itemSize, height: itemSize }]}
            >
              <Image
                source={{ uri }}
                style={styles.gridImageFull}
                resizeMode="cover"
              />
              {/* HTML: .more-overlay with backdrop blur */}
              {isLast && (
                <LinearGradient
                  colors={['rgba(102, 126, 234, 0.85)', 'rgba(118, 75, 162, 0.85)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.moreOverlay}
                >
                  <Text style={styles.moreText}>+{moreCount}</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // HTML: .image-grid
  imageGrid: {
    marginVertical: 32,
  },

  gridRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },

  // HTML: .grid-item with hover effects
  gridItem: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },

  gridItemHover: {
    // 터치 시 시각 피드백 (scale은 애니메이션 필요)
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },

  // 1장일 때 - aspect-ratio: 16/9
  gridImageSingle: {
    width: '100%',
    aspectRatio: 16 / 9,
  },

  // 전체 채우기
  gridImageFull: {
    width: '100%',
    height: '100%',
  },

  // PagerView 스타일
  pagerView: {
    width: '100%',
  },
  pagerPage: {
    padding: 8,
    justifyContent: 'center',
  },

  // 2장 캐러셀 스타일 (HTML 효과)
  carouselContainer: {
    paddingHorizontal: 0,
  },
  carouselItem: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.1)',
    flex: 1,
  },
  carouselImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },

  // 인디케이터 (그라디언트)
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(102, 126, 234, 0.3)',
  },
  indicatorActive: {
    backgroundColor: '#667eea',
    width: 24,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },

  // 3장 레이아웃 (HTML 스타일)
  grid3Container: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  grid3Left: {
    // height는 동적 계산
  },
  grid3LeftImage: {
    width: '100%',
    aspectRatio: 1, // 정사각형
  },
  grid3Right: {
    justifyContent: 'space-between',
  },

  // HTML: .more-overlay with gradient backdrop
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moreText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});