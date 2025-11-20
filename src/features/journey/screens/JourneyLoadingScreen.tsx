import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function JourneyLoadingScreen({ navigation }: { navigation: any }) {
  const [progress] = useState(new Animated.Value(0));
  const [loadingText, setLoadingText] = useState('앱을 로딩하고 있습니다..');

  useEffect(() => {
    const loadingTexts = ['앱을 로딩하고 있습니다.', '앱을 로딩하고 있습니다..', '앱을 로딩하고 있습니다...'];

    let textIndex = 0;
    const textInterval = setInterval(() => {
      textIndex = (textIndex + 1) % loadingTexts.length;
      setLoadingText(loadingTexts[textIndex]);
    }, 500);

    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start(async () => {
      clearInterval(textInterval);
      try {
        const seen = await AsyncStorage.getItem('journeyGuideSeen');
        if (seen === '1') navigation.replace('JourneyRouteList');
        else navigation.replace('JourneyGuide');
      } catch {
        navigation.replace('JourneyGuide');
      }
    });

    return () => clearInterval(textInterval);
  }, [navigation, progress]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#6366F1" />
      <LinearGradient colors={['#8B5CF6', '#6366F1']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.content}>
          <Text style={styles.logo}>로그</Text>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>주제목</Text>
            <Text style={styles.subtitle}>
              달리며 떠나는 특별한 여행{"\n"}
              세계 곳곳의 아름다운 여정을 경험하세요
            </Text>
          </View>

          <View style={styles.loadingContainer}>
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                ]}
              />
            </View>
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: height * 0.15,
    paddingBottom: height * 0.1,
  },
  logo: { fontSize: 18, color: '#FFFFFF', fontWeight: '600', letterSpacing: 1 },
  titleContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#E0E7FF', textAlign: 'center', lineHeight: 24, opacity: 0.9 },
  loadingContainer: { alignItems: 'center', width: '100%' },
  progressBarContainer: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  loadingText: { fontSize: 14, color: '#E0E7FF', opacity: 0.8 },
});
