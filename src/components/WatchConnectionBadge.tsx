// src/components/WatchConnectionBadge.tsx
// 워치 연결 상태를 보여주는 배지 + 연결 유도 버튼

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform, Alert } from 'react-native';
import { useWatchConnection } from '../hooks/useWatchConnection';
import { openWatchConnectionUI } from '../modules/watchSync';

export function WatchConnectionBadge() {
  const watchStatus = useWatchConnection();

  if (watchStatus.isChecking) {
    return (
      <View style={styles.badge}>
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.text}>워치 상태 확인 중…</Text>
      </View>
    );
  }

  if (!watchStatus.isAvailable) {
    return (
      <View style={[styles.badge, styles.unavailable]}>
        <Text style={styles.icon}>📵</Text>
        <Text style={styles.text}>폰 GPS만 사용 가능</Text>
        {Platform.OS === 'android' && (
          <TouchableOpacity
            onPress={async () => {
              const ok = await openWatchConnectionUI();
              if (!ok) {
                Alert.alert(
                  '연결 앱을 열 수 없어요',
                  'Galaxy Wearable 또는 Wear OS 앱을 설치/업데이트한 뒤 다시 시도해주세요.'
                );
              }
            }}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>워치 연결하기</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (watchStatus.isConnected) {
    return (
      <View style={[styles.badge, styles.connected]}>
        <Text style={styles.icon}>⌚</Text>
        <Text style={styles.text}>
          워치 연결됨{watchStatus.deviceName ? ` - ${watchStatus.deviceName}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.disconnected]}>
      <Text style={styles.icon}>⌚</Text>
      <Text style={styles.text}>워치 연결 필요</Text>
      <Text style={styles.subtext}>Galaxy Wearable 앱에서 연결하세요</Text>
      <TouchableOpacity
        onPress={async () => {
          const ok = await openWatchConnectionUI();
          if (!ok) {
            Alert.alert(
              '연결 앱을 열 수 없어요',
              'Galaxy Wearable 또는 Wear OS 앱을 설치/업데이트한 뒤 다시 시도해주세요.'
            );
          }
        }}
        style={styles.linkBtn}
      >
        <Text style={styles.linkText}>워치 연결하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
    gap: 8,
  },
  connected: {
    backgroundColor: '#e8f5e9',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  disconnected: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: '#ff9800',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  unavailable: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#9e9e9e',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  subtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  linkBtn: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  linkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});

export default WatchConnectionBadge;
