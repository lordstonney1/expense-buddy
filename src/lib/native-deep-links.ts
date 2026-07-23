// Handles the Capacitor deep-link return from Google OAuth on Android.
// When the system browser redirects to app.lovable.ceditrack://auth/callback?code=...
// we exchange the code for a Supabase session and close the in-app browser.
import { isNative } from "./native";
import { supabase } from "@/integrations/supabase/client";

export function initNativeDeepLinks(onAuthed: () => void) {
  if (!isNative()) return () => {};

  let cleanup = () => {};

  (async () => {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");

    const handle = await App.addListener("appUrlOpen", async ({ url }) => {
      try {
        if (!url.includes("auth/callback")) return;
        const parsed = new URL(url);
        const code = parsed.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        await Browser.close().catch(() => {});
        onAuthed();
      } catch (err) {
        console.error("[native] deep link auth failed", err);
      }
    });

    cleanup = () => {
      void handle.remove();
    };
  })();

  return () => cleanup();
}
