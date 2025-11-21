import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number; // ms
  scaleFrom?: number; // e.g., 0.985 ~ 0.999 (작게 → 가볍게)
  translateYFrom?: number; // px, 살짝 아래에서 올라오는 느낌
};

export default function ScreenFade({ children, style, duration = 340, scaleFrom = 0.988, translateYFrom = 10 }: Props) {
  const isFocused = useIsFocused();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(scaleFrom)).current;
  const translateY = useRef(new Animated.Value(translateYFrom)).current;

  useEffect(() => {
    // 좀 더 꾸덕(조금 길게), 그리고 가볍게(작은 움직임 + 부드러운 곡선)
    const ease = Easing.bezier(0.2, 0.8, 0.2, 1);
    if (isFocused) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration, easing: ease, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration, easing: ease, useNativeDriver: true }),
      ]).start();
    } else {
      // Prepare for next entry
      opacity.setValue(0);
      scale.setValue(scaleFrom);
      translateY.setValue(translateYFrom);
    }
  }, [isFocused, opacity, scale, translateY, duration, scaleFrom, translateYFrom]);

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ scale }, { translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
