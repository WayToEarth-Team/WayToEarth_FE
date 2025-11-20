// src/screens/RunningStartScreen.example.tsx
// 러닝 시작 화면 예시 (워치 연동 포함)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useWatchConnection } from '@features/running/hooks/useWatchConnection';
import { WatchConnectionBadge } from '@features/running/components/WatchConnectionBadge';
import { startRunOrchestrated } from '@features/running/lib/watchSync';

export function RunningStartScreen() {
  const watchStatus = useWatchConnection();
  const [isStarting, setIsStarting] = useState(false);

  // 워치로 러닝 시작
  const handleStartWithWatch = async () => {
    if (!watchStatus.isConnected) {
      Alert.alert(
        '워치 연결 필요',
        '갤럭시 워치를 연결해주세요.\n\nGalaxy Wearable 앱에서 워치를 페어링하세요.',
        [{ text: '확인' }]
      );
      return;
    }

    try {
      setIsStarting(true);
      const sessionId = await startRunOrchestrated('SINGLE');
      console.log('워치 러닝 시작:', sessionId);
      // 러닝 진행 화면으로 이동
      // navigation.navigate('LiveRunning', { sessionId });
    } catch (error) {
      console.error('러닝 시작 실패:', error);
      Alert.alert('오류', '러닝을 시작할 수 없습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  // 폰으로 러닝 시작 (워치 없이)
  const handleStartWithPhone = async () => {
    Alert.alert(
      '폰 GPS 사용',
      '워치 없이 폰 GPS로만 러닝하시겠습니까?\n\n심박수 데이터는 수집되지 않습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '시작',
          onPress: async () => {
            try {
              setIsStarting(true);
              // 폰 GPS 러닝 시작 로직
              console.log('폰 GPS 러닝 시작');
              // TODO: 폰 GPS 러닝 구현
            } catch (error) {
              Alert.alert('오류', '러닝을 시작할 수 없습니다.');
            } finally {
              setIsStarting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>러닝 시작</Text>

      {/* 워치 연결 상태 표시 */}
      <WatchConnectionBadge />

      {/* 시작 버튼들 */}
      <View style={styles.buttonContainer}>
        {/* 워치로 시작 (권장) */}
        {watchStatus.isAvailable && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              !watchStatus.isConnected && styles.buttonDisabled,
            ]}
            onPress={handleStartWithWatch}
            disabled={!watchStatus.isConnected || isStarting}
          >
            <Text style={styles.buttonIcon}>⌚</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.buttonText}>워치로 시작</Text>
              {watchStatus.isConnected && (
                <Text style={styles.buttonSubtext}>GPS + 심박수 + 고도</Text>
              )}
              {!watchStatus.isConnected && (
                <Text style={styles.buttonSubtextDisabled}>워치 연결 필요</Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* 폰으로 시작 (백업) */}
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleStartWithPhone}
          disabled={isStarting}
        >
          <Text style={styles.buttonIcon}>📱</Text>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTextSecondary}>폰으로 시작</Text>
            <Text style={styles.buttonSubtextSecondary}>GPS만 사용</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 안내 메시지 */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          💡 워치로 시작하면 심박수, 고도 데이터도 함께 수집됩니다.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  buttonTextSecondary: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  buttonSubtextSecondary: {
    fontSize: 14,
    color: '#666',
  },
  buttonSubtextDisabled: {
    fontSize: 14,
    color: '#999',
  },
  infoContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
});

export default RunningStartScreen;
