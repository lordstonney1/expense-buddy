
## Goal

Ship a real Android app (installable via APK / Google Play) using Capacitor, while keeping the existing PWA working for iOS, desktop, and Android browser users.

## Approach

Capacitor is the right choice here — it wraps the existing web build in a native Android shell, so we keep one codebase. The PWA (manifest + service worker) stays untouched and continues to serve iOS/desktop/Android browsers.

Important constraint: **Lovable's cloud sandbox cannot build an actual `.apk` / `.aab`** — that requires Android Studio + JDK + Android SDK on your local machine (or a CI service like EAS/Codemagic/GitHub Actions). What I *can* do here is scaffold the Capacitor project, configure it correctly, and give you a clean set of local commands to produce the APK.

## What I'll set up

1. **Install Capacitor**
   - `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`
   - A couple of quality-of-life plugins: `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/app` (back-button handling), `@capacitor/preferences`

2. **`capacitor.config.ts`** at project root
   - `appId: "app.lovable.ceditrack"` (change if you want your own)
   - `appName: "CediTrack"`
   - `webDir: "dist"` (TanStack Start's client build output)
   - Splash screen + status bar colors matched to the existing theme (`#1e3a8a`)
   - **Dev-mode server URL** pointing at the Lovable preview so you can hot-reload on a real device without rebuilding

3. **Auth redirect fix for native**
   - Supabase Google OAuth currently uses `window.location.origin`, which inside a Capacitor webview is `http://localhost` or `capacitor://localhost` — Google will reject it.
   - I'll detect Capacitor at runtime and, on native, use a deep-link scheme (`app.lovable.ceditrack://auth/callback`) plus the `@capacitor/browser` plugin to open the OAuth flow in a system browser tab and return to the app.
   - Email/password + password reset already work as-is.

4. **Service worker guard**
   - `register-sw.ts` will also refuse to register when running inside Capacitor (native shell handles caching via the bundled assets, and a SW inside a webview causes stale-content bugs).

5. **Build script** in `package.json`
   - `"android:sync": "vite build && cap sync android"`
   - `"android:open": "cap open android"`

6. **Docs** — a short `ANDROID.md` with the exact local steps:
   ```
   git clone <repo>
   bun install
   bunx cap add android      # first time only
   bun run android:sync
   bun run android:open      # opens Android Studio → Build > Generate Signed Bundle/APK
   ```

## What stays the same

- PWA manifest, icons, install prompts on iOS/desktop/Android browsers
- Service worker + offline behavior in the published web app
- All Supabase auth, RLS, expenses, receipts, reports code

## What you'll do locally (one-time)

- Install Android Studio + JDK 17
- Run `bunx cap add android` (creates the `/android` folder — this can't run in the Lovable sandbox)
- Generate a signing key and build the release APK/AAB in Android Studio

## Technical notes

- `webDir` must match the Vite client output. TanStack Start builds to `dist/` — I'll verify and adjust if needed.
- The dev-server URL in `capacitor.config.ts` will be commented out by default so production builds bundle the static assets. Uncomment for live-reload against the preview.
- Google OAuth on native needs its redirect URI whitelisted in Supabase Auth settings — I'll list the exact URI to add.

## Open questions before I build

1. **App ID** — is `app.lovable.ceditrack` fine, or do you want your own (e.g. `com.yourschool.ceditrack`)? This is baked into the APK and hard to change later.
2. **Google sign-in on Android** — keep it (needs the deep-link work above), or Android app = email/password only for now?
