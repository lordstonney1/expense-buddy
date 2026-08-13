// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// ANDROID_BUILD=1 targets the Node preset so we can boot the built server
// locally and snapshot the rendered HTML into dist/client/index.html — the
// static shell the Capacitor Android app loads inside its WebView.
const androidBuild = process.env.ANDROID_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  ...(androidBuild ? { nitro: { preset: "node-server" } } : {}),

  vite: {
    plugins: [




      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "html-nav",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ sameOrigin, url }) =>
                sameOrigin && /\.[0-9a-f]{8,}\.(js|css|woff2|png|svg|jpg|jpeg|webp)$/i.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "assets-hashed",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        manifest: false,
      }),
    ],
  },
});
