// src/features/landmark/components/ImageCarousel.tsx
// 이미지 캐러셀 - HTML 완전 동일 디자인

import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DynamicImageGrid from '@features/landmark/components/DynamicImageGrid';
import ImageLightbox from '@features/landmark/components/ImageLightbox';

type Props = {
  images: string[];
  layout?: 'swipe' | 'grid';
  autoplay?: boolean;
  autoplayInterval?: number;
};

const { width: screenWidth } = Dimensions.get('window');

export default function ImageCarousel({ 
  images, 
  layout = 'swipe', 
  autoplay = true, 
  autoplayInterval = 3000 
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [initialIndex, setInitialIndex] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // 자동 스와이프
  useEffect(() => {
    if (layout !== 'swipe' || images.length <= 1 || lightboxOpen || !autoplay) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % images.length;
        scrollViewRef.current?.scrollTo({
          x: next * screenWidth,
          animated: true,
        });
        return next;
      });
    }, autoplayInterval);

    return () => clearInterval(timer);
  }, [layout, images.length, lightboxOpen, autoplay, autoplayInterval]);

  if (!images || images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setInitialIndex(index);
    setLightboxOpen(true);
  };

  // 그리드 레이아웃
  if (layout === 'grid') {
    return (
      <View style={styles.imageCarousel}>
        <DynamicImageGrid images={images} onPressImage={openLightbox} />
        <ImageLightbox 
          images={images} 
          visible={lightboxOpen} 
          initialIndex={initialIndex} 
          onClose={() => setLightboxOpen(false)} 
        />
      </View>
    );
  }

  // 캐러셀 레이아웃
  return (
    <View style={styles.imageCarousel}>
      {/* HTML: .carousel-container */}
      <View style={styles.carouselContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(newIndex);
          }}
        >
          {images.map((uri, index) => (
            <TouchableOpacity
              key={`${uri}-${index}`}
              activeOpacity={0.9}
              onPress={() => openLightbox(index)}
              style={styles.carouselSlide}
            >
              <Image
                source={{ uri }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* HTML: .carousel-indicators */}
      <View style={styles.carouselIndicators}>
        {images.map((_, idx) => (
          <View key={idx}>
            {idx === currentIndex ? (
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.indicatorActive}
              />
            ) : (
              <View style={styles.indicator} />
            )}
          </View>
        ))}
      </View>

      <ImageLightbox 
        images={images} 
        visible={lightboxOpen} 
        initialIndex={initialIndex} 
        onClose={() => setLightboxOpen(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // HTML: .image-carousel
  imageCarousel: {
    marginVertical: 32,
    position: 'relative',
  },

  // HTML: .carousel-container
  carouselContainer: {
    overflow: 'hidden',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
  },

  // HTML: .carousel-slide
  carouselSlide: {
    width: screenWidth,
    aspectRatio: 16 / 9,
  },

  carouselImage: {
    width: '100%',
    height: '100%',
  },

  // HTML: .carousel-indicators
  carouselIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },

  // HTML: .indicator
  indicator: {
    width: 8,
    height: 8,
    backgroundColor: '#cbd5e1',
    borderRadius: 4,
  },

  // HTML: .indicator.active
  indicatorActive: {
    width: 28,
    height: 8,
    borderRadius: 4,
  },
});