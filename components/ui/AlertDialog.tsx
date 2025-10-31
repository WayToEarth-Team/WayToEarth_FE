import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Modal from "react-native-modal";
import { Ionicons } from "@expo/vector-icons";

type Variant = "positive" | "negative" | "message" | "confirm" | "warning";

type BaseProps = {
  visible: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

type AlertProps = BaseProps & {
  variant: Variant;
  confirmText?: string;
};

type ConfirmProps = BaseProps & {
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

function VariantStyles(variant: Variant) {
  switch (variant) {
    case "positive":
      return {
        icon: "checkmark-circle" as const,
        color: "#16a34a",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
      };
    case "negative":
      return {
        icon: "close-circle" as const,
        color: "#dc2626",
        bgColor: "#fef2f2",
        borderColor: "#fecaca",
      };
    case "warning":
      return {
        icon: "warning" as const,
        color: "#ea580c",
        bgColor: "#fff7ed",
        borderColor: "#fed7aa",
      };
    case "confirm":
      return {
        icon: "help-circle" as const,
        color: "#7c3aed",
        bgColor: "#faf5ff",
        borderColor: "#e9d5ff",
      };
    case "message":
    default:
      return {
        icon: "information-circle" as const,
        color: "#2563eb",
        bgColor: "#eff6ff",
        borderColor: "#bfdbfe",
      };
  }
}

// 기본 Alert 컴포넌트
export function AlertDialog({
  visible,
  title,
  message,
  confirmText = "확인",
  onClose,
  variant,
}: AlertProps) {
  const variantStyle = VariantStyles(variant);

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      backdropTransitionOutTiming={0}
    >
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: variantStyle.bgColor,
              borderColor: variantStyle.borderColor,
            },
          ]}
        >
          <Ionicons
            name={variantStyle.icon}
            size={24}
            color={variantStyle.color}
          />
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.confirmButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.confirmButtonText}>{confirmText}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Confirm 다이얼로그 (확인/취소 버튼)
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  onClose,
  onConfirm,
  onCancel,
}: ConfirmProps & { variant: Variant }) {
  const variantStyle = VariantStyles("confirm");

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      backdropTransitionOutTiming={0}
    >
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: variantStyle.bgColor,
              borderColor: variantStyle.borderColor,
            },
          ]}
        >
          <Ionicons
            name={variantStyle.icon}
            size={24}
            color={variantStyle.color}
          />
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.twoButtonContainer}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.cancelButtonText}>{cancelText}</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.confirmButtonPurple,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.confirmButtonText}>{confirmText}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// 편의 컴포넌트들
export function PositiveAlert(props: BaseProps & { confirmText?: string }) {
  return <AlertDialog {...props} variant="positive" />;
}

export function NegativeAlert(props: BaseProps & { confirmText?: string }) {
  return <AlertDialog {...props} variant="negative" />;
}

export function MessageAlert(props: BaseProps & { confirmText?: string }) {
  return <AlertDialog {...props} variant="message" />;
}

export function WarningAlert(props: BaseProps & { confirmText?: string }) {
  return <AlertDialog {...props} variant="warning" />;
}

export function ConfirmAlert(props: ConfirmProps) {
  return <ConfirmDialog {...props} variant="confirm" />;
}

// Destructive Confirm (삭제 등 위험한 동작용)
export function DestructiveConfirm(props: ConfirmProps) {
  const variantStyle = VariantStyles("negative");

  const handleConfirm = () => {
    props.onConfirm();
    props.onClose();
  };

  const handleCancel = () => {
    props.onCancel?.();
    props.onClose();
  };

  return (
    <Modal
      isVisible={props.visible}
      onBackdropPress={props.onClose}
      backdropTransitionOutTiming={0}
    >
      <View style={styles.modalContainer}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: variantStyle.bgColor,
              borderColor: variantStyle.borderColor,
            },
          ]}
        >
          <Ionicons
            name={variantStyle.icon}
            size={24}
            color={variantStyle.color}
          />
          {props.title ? <Text style={styles.title}>{props.title}</Text> : null}
        </View>
        {props.message ? (
          <Text style={styles.message}>{props.message}</Text>
        ) : null}
        <View style={styles.twoButtonContainer}>
          <Pressable
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.cancelButtonText}>
              {props.cancelText || "취소"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [
              styles.destructiveButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.confirmButtonText}>
              {props.confirmText || "삭제"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 12,
    flex: 1,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4b5563",
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  twoButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  confirmButton: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButtonPurple: {
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  destructiveButton: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButtonText: {
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "600",
  },
});
