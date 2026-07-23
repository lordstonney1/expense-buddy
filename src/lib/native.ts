// Small helpers for detecting Capacitor and running native-only logic.
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// Deep-link scheme registered by the Android app (see AndroidManifest.xml).
export const NATIVE_APP_SCHEME = "app.lovable.ceditrack";
export const NATIVE_AUTH_CALLBACK = `${NATIVE_APP_SCHEME}://auth/callback`;
