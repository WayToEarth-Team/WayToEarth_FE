import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function JourneyGuideScreen({ navigation }: { navigation: any }) {
  const onStart = async () => {
    await AsyncStorage.setItem('journeyGuideSeen', '1');
    navigation.replace('JourneyRouteList');
  };
  const onSkip = async () => {
    await AsyncStorage.setItem('journeyGuideSeen', '1');
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };
  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>여정 러닝 안내</Text>
        <Text style={s.desc}>
          가상러닝(여정 러닝)은 실제 위치 기반 러닝에 목표 거리를 더해
          특정 코스를 가상으로 완주하는 기능입니다.{"\n\n"}
          - 여정을 선택하고{` `}목표 거리로 자동 완료{` `}됩니다.{"\n"}
          - 여정의 랜드마크를 따라 진행 상황을 확인할 수 있어요.{"\n"}
          - 기존 러닝 로직과 동일하게 페이스, 거리, 칼로리를 기록합니다.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>어떻게 사용하나요?</Text>
          <Text style={s.cardItem}>1) 여정 선택 → 상세에서 '여정 계속하기'</Text>
          <Text style={s.cardItem}>2) 러닝 시작 → 목표 거리 도달 시 자동 완료</Text>
          <Text style={s.cardItem}>3) 요약 화면에서 공유/기록 확인</Text>
        </View>

        <View style={s.btnWrap}>
          <TouchableOpacity style={s.primary} onPress={onStart}>
            <Text style={s.primaryText}>시작하기</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondary} onPress={onSkip}>
            <Text style={s.secondaryText}>다시 보지 않기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 16 },
  desc: { color: '#4B5563', lineHeight: 22, marginBottom: 20 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8, color: '#1F2937' },
  cardItem: { color: '#374151', marginTop: 4 },
  btnWrap: { gap: 12 },
  primary: { backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: '#D1D5DB', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#6B7280', fontWeight: '700' },
});

