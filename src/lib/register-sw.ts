// Guarded service worker registration wrapper.
// Registers ONLY in production, non-preview, non-iframe contexts.
export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const swUrl = "/sw.js";
  const host = window.location.hostname;
  const isPreviewHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  const inIframe = window.self !== window.top;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
  // Also refuse inside the Capacitor native webview — the native shell already
  // bundles the assets, and a SW inside the webview causes stale-content bugs.
  const inCapacitor =
    // @ts-expect-error - Capacitor injects this global at runtime on native.
    typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();
  const refuse =
    !import.meta.env.PROD || inIframe || isPreviewHost || killSwitch || inCapacitor;

  if (refuse) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs
          .filter((r) => r.active?.scriptURL.endsWith(swUrl))
          .map((r) => r.unregister()),
      );
    } catch {
      // ignore
    }
    return;
  }

  try {
    await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
  } catch (err) {
    console.warn("[sw] registration failed", err);
  }
}
