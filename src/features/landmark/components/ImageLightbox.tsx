// src/features/landmark/components/ImageLightbox.tsx
// 이미지 라이트박스 - 전체화면 뷰어

import React, { useRef, useState } from 'react';
import { 
  View, 
  Modal, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  Text,
  StatusBar,
} from 'react-native';

type Props = {
  images: string[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
};

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ImageLightbox({ 
  images, 
  visible, 
  initialIndex = 0, 
  onClose 
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);

  // visible이 변경되면 initialIndex로 스크롤
  React.useEffect(() => {
    if (visible && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: initialIndex * screenWidth,
        animated: false,
      });
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" hidden />
        
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeText}>닫기</Text>
          </TouchableOpacity>
          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* 이미지 스크롤 */}
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
            <View key={`${uri}-${index}`} style={styles.slide}>
              <Image
                source={{ uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  closeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
  },
  closeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  counter: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  slide: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
});