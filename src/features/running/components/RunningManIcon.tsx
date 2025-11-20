// components/RunningManIcon.tsx
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RunningManIcon() {
  const bounceValue = useRef(new Animated.Value(0)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 상하 바운스 애니메이션
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    // 미세한 회전 애니메이션
    const rotateAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(rotateValue, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );

    // 스케일 펄스 애니메이션
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    bounceAnimation.start();
    rotateAnimation.start();
    scaleAnimation.start();

    return () => {
      bounceAnimation.stop();
      rotateAnimation.stop();
      scaleAnimation.stop();
    };
  }, []);

  const translateY = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const rotate = rotateValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-3deg", "3deg", "-3deg"],
  });

  const shadowOpacity = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.05],
  });

  const shadowScale = bounceValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.8],
  });

  return (
    <View style={styles.iconContainer}>
      {/* 메인 러닝 아이콘 */}
      <Animated.View
        style={[
          styles.runningMan,
          {
            transform: [{ translateY }, { rotate }, { scale: scaleValue }],
          },
        ]}
      >
        <MaterialCommunityIcons name="run-fast" size={64} color="#667eea" />
      </Animated.View>

      {/* 그림자 */}
      <Animated.View
        style={[
          styles.shadow,
          {
            opacity: shadowOpacity,
            transform: [{ scaleX: shadowScale }],
          },
        ]}
      />

      {/* 장식 요소들 */}
      <View style={styles.decorationContainer}>
        {/* 먼지 효과 1 */}
        <Animated.View
          style={[
            styles.dust,
            styles.dust1,
            {
              opacity: bounceValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.3, 0.6, 0.3],
              }),
              transform: [
                {
                  translateX: bounceValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
              ],
            },
          ]}
        />

        {/* 먼지 효과 2 */}
        <Animated.View
          style={[
            styles.dust,
            styles.dust2,
            {
              opacity: bounceValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.2, 0.5, 0.2],
              }),
              transform: [
                {
                  translateX: bounceValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -12],
                  }),
                },
              ],
            },
          ]}
        />

        {/* 속도선 효과 */}
        <Animated.View
          style={[
            styles.speedLine,
            {
              opacity: bounceValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.4, 0.8, 0.4],
              }),
              transform: [
                {
                  scaleX: bounceValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.3],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 120,
    height: 120,
    position: "relative",
  },
  runningMan: {
    zIndex: 2,
  },
  shadow: {
    position: "absolute",
    bottom: 8,
    width: 70,
    height: 10,
    backgroundColor: "#000",
    borderRadius: 35,
    zIndex: 1,
  },
  decorationContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  dust: {
    position: "absolute",
    backgroundColor: "#cbd5e1",
    borderRadius: 10,
  },
  dust1: {
    width: 12,
    height: 12,
    bottom: 25,
    right: 15,
  },
  dust2: {
    width: 8,
    height: 8,
    bottom: 30,
    right: 25,
  },
  speedLine: {
    position: "absolute",
    width: 30,
    height: 3,
    backgroundColor: "#a5b4fc",
    borderRadius: 2,
    bottom: 45,
    left: 10,
  },
});
