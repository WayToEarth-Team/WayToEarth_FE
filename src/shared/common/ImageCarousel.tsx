// src/shared/common/ImageCarousel.tsx
// 부드러운 이미지 캐러셀 컴포넌트 (자동 슬라이드, 스와이프, 인디케이터)

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ImageCarouselProps = {
  images: string[]; // 이미지 URL 배열
  height?: number; // 캐러셀 높이 (기본: 200)
  autoPlayInterval?: number; // 자동 슬라이드 간격(ms) (기본: 4000)
  showGradient?: boolean; // 그라데이션 오버레이 표시 여부 (기본: true)
  showIndicators?: boolean; // 인디케이터 dots 표시 여부 (기본: true)
  borderRadius?: number; // 모서리 둥글기 (기본: 0)
  style?: ViewStyle; // 추가 스타일
  showPlaceholder?: boolean; // 로딩/이미지 없음 플레이스홀더 표시 여부 (기본: true)
};

export default function ImageCarousel({
  images,
  height = 200,
  autoPlayInterval = 4000,
  showGradient = true,
  showIndicators = true,
  borderRadius = 0,
  style,
  showPlaceholder = true,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 유효한 이미지만 필터링
  const validImages = images.filter((img) => img && typeof img === 'string' && img.trim() !== '');

  // 첫 이미지 로드 시 페이드인
  useEffect(() => {
    if (imageLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [imageLoaded, fadeAnim]);

  // 자동 슬라이드
  useEffect(() => {
    if (validImages.length <= 1) return; // 이미지가 1개 이하면 자동 슬라이드 비활성화

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % validImages.length;
      setCurrentIndex(nextIndex);

      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, validImages.length, autoPlayInterval]);

  // 이미지가 없으면 플레이스홀더 표시
  if (validImages.length === 0) {
    return (
      <View style={[styles.container, { height, borderRadius }, style]}>
        {showPlaceholder ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🏞️</Text>
          </View>
        ) : (
          <View style={[styles.placeholder, { backgroundColor: '#F3F4F6' }]} />
        )}
      </View>
    );
  }

  // 스크롤 이벤트 핸들러
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollX.current = offsetX;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < validImages.length) {
      setCurrentIndex(index);
    }
  };

  // 이미지 렌더링
  const renderItem = ({ item, index }: { item: string; index: number }) => (
    <View style={[styles.imageContainer, { width: SCREEN_WIDTH }]}>
      <Image
        source={{ uri: item }}
        style={[styles.image, { height, borderRadius }]}
        resizeMode="cover"
        onLoad={() => {
          if (index === 0 && !imageLoaded) {
            setImageLoaded(true);
          }
        }}
      />
      {showGradient && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)']}
          style={[styles.gradient, { borderRadius }]}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { height, borderRadius }, style]}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={validImages}
          renderItem={renderItem}
          keyExtractor={(item, index) => `carousel-${index}-${item.substring(0, 20)}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* 인디케이터 Dots */}
        {showIndicators && validImages.length > 1 && (
          <View style={styles.indicatorContainer}>
            {validImages.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>

      {/* 로딩 중 플레이스홀더 */}
      {!imageLoaded && showPlaceholder && (
        <View style={[StyleSheet.absoluteFill, styles.loadingPlaceholder]}>
          <Text style={styles.placeholderIcon}>🏞️</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  placeholderIcon: {
    fontSize: 48,
    opacity: 0.5,
  },
  loadingPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 24,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
