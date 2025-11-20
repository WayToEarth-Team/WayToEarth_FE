import React from "react";
import { View, Text, Pressable } from "react-native";
import Modal from "react-native-modal";

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

export default function Dialog({
  visible,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  showCancel = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      backdropTransitionOutTiming={0}
    >
      <View className="rounded-2xl bg-white p-5 dark:bg-neutral-900">
        {title ? (
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text className="mt-2 text-neutral-600 dark:text-neutral-300">
            {message}
          </Text>
        ) : null}
        <View className="mt-4 flex-row justify-end gap-3">
          {showCancel && (
            <Pressable
              onPress={onClose}
              className="h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <Text className="text-neutral-800 dark:text-neutral-100">
                {cancelText}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              onConfirm?.();
              onClose();
            }}
            className="h-11 items-center justify-center rounded-xl bg-black px-4"
          >
            <Text className="font-semibold text-white">{confirmText}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
