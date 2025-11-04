import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useWatchConnection } from '../src/hooks/useWatchConnection';
import { WatchConnectionBadge } from '../src/components/WatchConnectionBadge';
import { startRunOrchestrated } from '../src/modules/watchSync';

type Props = StackScreenProps<any>;

export default function RunningStartScreen({ navigation }: Props) {
  const watchStatus = useWatchConnection();
  const [isStarting, setIsStarting] = useState(false);

  const goToLiveRunning = (params?: any) => {
    // Navigate to dedicated stack screen that renders the live running UI
    navigation.navigate('LiveRunning', params ?? {});
  };

  const handleStartWithWatch = async () => {
    if (!watchStatus.isConnected) {
      Alert.alert(
        '워치 연결 필요',
        'Galaxy Wearable 앱에서 워치를 먼저 연결해주세요.',
        [{ text: '확인' }]
      );
      return;
    }

    try {
      setIsStarting(true);
      const sessionId = await startRunOrchestrated('SINGLE');
      // After orchestrating on watch, move to live UI (optional: pass sessionId)
      goToLiveRunning({ sessionId, from: 'watch' });
    } catch (error) {
      console.error('[RunningStart] start with watch failed:', error);
      Alert.alert('오류', '러닝 시작에 실패했어요.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartWithPhone = async () => {
    // For phone-only start, simply navigate to the live running UI.
    // LiveRunningScreen handles countdown and t.start().
    goToLiveRunning({ from: 'phone' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>러닝 시작</Text>

      <WatchConnectionBadge />

      <View style={styles.buttonContainer}>
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
                <Text style={styles.buttonSubtext}>GPS + 심박 + 안내</Text>
              )}
              {!watchStatus.isConnected && (
                <Text style={styles.buttonSubtextDisabled}>워치 연결 필요</Text>
              )}
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleStartWithPhone}
          disabled={isStarting}
        >
          <Text style={styles.buttonIcon}>📱</Text>
          <View style={styles.buttonTextContainer}>
            <Text style={styles.buttonTextSecondary}>휴대폰으로 시작</Text>
            <Text style={styles.buttonSubtextSecondary}>휴대폰 GPS만 사용</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          워치로 시작하면 심박, 안내 등 기능을 함께 사용할 수 있어요.
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
    color: '#333',
  },
});

