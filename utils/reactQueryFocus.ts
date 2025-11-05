import { AppState, AppStateStatus } from "react-native";
import { focusManager } from "@tanstack/react-query";

let initialized = false;

export function setupReactQueryFocus() {
  if (initialized) return;
  initialized = true;
  focusManager.setEventListener((handleFocus) => {
    const onAppStateChange = (status: AppStateStatus) => {
      handleFocus(status === "active");
    };
    const sub = AppState.addEventListener("change", onAppStateChange);
    return () => sub.remove();
  });
}

