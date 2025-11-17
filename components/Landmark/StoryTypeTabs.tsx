// components/Landmark/StoryTypeTabs.tsx
// 스토리 타입 필터 탭 - 모던한 무채색 디자인

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { StoryType } from '../../types/landmark';

type Props = {
  selectedType: StoryType | null;
  onSelectType: (type: StoryType | null) => void;
};

const TABS = [
  { type: null, label: '전체', emoji: '📋' },
  { type: 'HISTORY' as StoryType, label: '역사', emoji: '📘' },
  { type: 'CULTURE' as StoryType, label: '문화', emoji: '🎭' },
  { type: 'NATURE' as StoryType, label: '자연', emoji: '🌿' },
];

export default function StoryTypeTabs({ selectedType, onSelectType }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {TABS.map((tab) => {
        const isActive = selectedType === tab.type;

        return (
          <TouchableOpacity
            key={tab.type || 'all'}
            onPress={() => onSelectType(tab.type)}
            style={styles.tabWrapper}
            activeOpacity={0.7}
          >
            {isActive ? (
              <View style={styles.activeTab}>
                <Text style={styles.activeTabText}>
                  {tab.emoji} {tab.label}
                </Text>
              </View>
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
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 6,
  },
  tabWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  activeTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  inactiveTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  inactiveTabText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});