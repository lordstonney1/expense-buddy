# Building the CediTrack Android app

CediTrack ships as a PWA (iOS, desktop, Android browsers) **and** a real Android
app via [Capacitor](https://capacitorjs.com/). The web code is identical — the
Android app just wraps the built site in a native shell.

> ⚠️ You cannot build the `.apk` / `.aab` inside the Lovable sandbox. You need
> Android Studio + JDK 17 on your local machine. The Lovable project only
> contains the Capacitor configuration.

## Prerequisites (one-time)

1. Install [Android Studio](https://developer.android.com/studio) (bundles the
   Android SDK).
2. Install JDK 17 (Android Studio can install it under _Settings → Build Tools
   → Gradle → Gradle JDK_).
3. Install [Bun](https://bun.sh/) (or use npm / pnpm — the commands below are
   the same, just swap the runner).

## First-time setup

```bash
git clone <your-repo>
cd <your-repo>
bun install

# Creates the /android native project. Only run once.
bunx cap add android
```

Commit the generated `/android` folder to your repo.

## Every time you change web code

```bash
bun run android:sync   # builds the web app and copies it into /android
bun run android:open   # opens the project in Android Studio
```

In Android Studio: **Build → Generate Signed Bundle / APK** to produce a
release build for the Play Store or direct install.

## Live-reload on a physical device

Uncomment the `server` block in `capacitor.config.ts` (it points at your
Lovable preview URL), then run `bun run android:sync` and install the app.
Changes you make in Lovable will hot-reload on the device.

## Google sign-in on Android

Google OAuth opens in the system browser and returns to the app via the
deep link `app.lovable.ceditrack://auth/callback`.

You must whitelist that redirect URL in the Cloud Dashboard:

1. Open the backend → Users → Authentication Settings → URL Configuration
2. Add `app.lovable.ceditrack://auth/callback` to **Redirect URLs**

Email / password sign-in works with no extra configuration.

## Changing the app ID

The default is `app.lovable.ceditrack`. If you change it in
`capacitor.config.ts`, also:

- update `NATIVE_APP_SCHEME` in `src/lib/native.ts`
- update the `<intent-filter>` scheme in
  `android/app/src/main/AndroidManifest.xml`
- re-add the new redirect URL to the Cloud Dashboard
