// components/Landmark/StoryTypeTabs.tsx
// 스토리 타입 필터 탭 - 프리미엄 디자인

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StoryType } from '../../types/landmark';

type Props = {
  selectedType: StoryType | null;
  onSelectType: (type: StoryType | null) => void;
};

const TABS = [
  { type: null, label: '전체', emoji: '' },
  { type: 'HISTORY' as StoryType, label: '역사', emoji: '📘' },
  { type: 'CULTURE' as StoryType, label: '문화', emoji: '🎭' },
  { type: 'NATURE' as StoryType, label: '자연', emoji: '🌿' },
];

const GRADIENTS = {
  HISTORY: ['#667eea', '#764ba2'],
  CULTURE: ['#f093fb', '#f5576c'],
  NATURE: ['#4facfe', '#00f2fe'],
};

export default function StoryTypeTabs({ selectedType, onSelectType }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TABS.map((tab) => {
        const isActive = selectedType === tab.type;
        const gradient = tab.type ? GRADIENTS[tab.type] : ['#667eea', '#764ba2'];

        return (
          <TouchableOpacity
            key={tab.type || 'all'}
            onPress={() => onSelectType(tab.type)}
            style={styles.tabWrapper}
            activeOpacity={0.7}
          >
            {isActive ? (
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeTab}
              >
                <Text style={styles.activeTabText}>
                  {tab.emoji} {tab.label}
                </Text>
              </LinearGradient>
            ) : (
              <View style={styles.inactiveTab}>
                <Text style={styles.inactiveTabText}>
                  {tab.emoji} {tab.label}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 4,
  },
  tabWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  activeTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inactiveTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 20,
  },
  inactiveTabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});