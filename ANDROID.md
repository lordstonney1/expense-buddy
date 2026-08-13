# Building the CediTrack Android app

CediTrack ships as a PWA (iOS, desktop, Android browsers) **and** a real Android
app via [Capacitor](https://capacitorjs.com/). The web code is identical — the
Android app just wraps the built site in a native shell.

A **signed release APK** is built and served at `/CediTrack.apk` (the "Download
Android APK" button on the landing page). It is release-signed and safe for
direct install on Android devices. A matching **signed release AAB**
(`.aab`) is also produced for Play Store upload — see
[Publishing to Google Play](#publishing-to-google-play) below.

## Prerequisites (one-time)

1. Install [Android Studio](https://developer.android.com/studio) (bundles the
   Android SDK).
2. Install JDK 21 (Android Studio: _Settings → Build Tools → Gradle → Gradle JDK_).
3. Install [Bun](https://bun.sh/) (or use npm / pnpm — same commands).

## Build

### Debug (quick testing)

```bash
bun install
bun run android:sync    # builds the web app, renders the static shell, syncs /android
cd android && ./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../public/CediTrack.apk
```

### Signed release (Play Store + production install)

The release signing config is wired into `android/app/build.gradle` and reads
its key from `android/keystore.properties` (gitignored). To rebuild a signed
release:

```bash
bun install
bun run android:sync      # build web assets + static shell + sync /android
cd android
# JDK 21 is required (AGP 8.13). Set JAVA_HOME to a JDK 21 install.
./gradlew :app:bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab  (Play Store)
./gradlew :app:assembleRelease   # -> app/build/outputs/apk/release/app-release.apk    (direct install)
cp app/build/outputs/apk/release/app-release.apk ../public/CediTrack.apk
```

Both outputs are signed automatically by the release config — no need to use
Android Studio's "Generate Signed Bundle" wizard.

### How the web assets are packaged

The app is server-rendered, so the production build has no `index.html`.
`bun run android:shell` (run automatically by `android:sync`) boots the built
server locally, requests `/`, and snapshots the rendered HTML into
`dist/client/index.html`. Capacitor loads that file inside the WebView and the
router takes over from there — the app works fully offline.


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

## Publishing to Google Play

The signed release AAB (`app-release.aab`) is the format Google Play requires
for new apps (since Aug 2021). The signed release APK (`app-release.apk`) is
for direct install/testing.

### One-time setup

1. **Create a Google Play Console developer account** ($25 one-time) at
   <https://play.google.com/console>. Google takes ~1–3 days to verify your
   identity after you sign up.
2. **Back up your keystore** — see [Keystore backup](#keystore-backup) below.
   Do this *before* your first upload; losing the key means you can never
   update the published app.

### Upload

1. In the Play Console, click **Create app**. Choose App name `CediTrack`,
   Default app-language English, App type **App**, Free/Paid → **Free**.
2. Go to **Production** (or **Internal testing** for a faster first release)
   → **Create new release**.
3. Upload the signed `app-release.aab` (drag-drop in the release panel).
4. On the **first** upload, Google offers **Play App Signing** — opt in. Google
   then keeps your app-signing key safe; if you ever lose your keystore you can
   request a reset through the Console instead of being permanently locked out.
5. Complete the **app content** declarations and **store listing**:
   - App icon 512×512, feature graphic 1024×500, at least 2 screenshots.
   - Short description (≤80 chars) and full description.
   - A **privacy policy URL** (required even for free apps — host it on your
     site or a simple static page).
   - App category, target audience, content rating questionnaire.
6. Add **testers** (their Gmail addresses) under Internal testing to distribute
   before going to Production.

### Releasing updates

Each new version must bump `versionCode` and `versionName` in
`android/app/build.gradle`, rebuild the AAB, and upload a new release in the
Console. The keystore must stay the same.

## Keystore backup

The release key lives in `android/app/ceditrack-release.jks` with its
credentials in `android/keystore.properties`. **These are the only files that
let you publish updates to CediTrack on the Play Store.**

Back them up immediately (both files together) to a secure location outside
the repo — cloud storage, a password manager, or a USB drive:

- `android/app/ceditrack-release.jks` (the binary key)
- `android/keystore.properties` (store/key password, alias)

These are gitignored and never committed. If you lose them and opted into
Play App Signing, you can request a key upgrade/reset from the Play Console;
without Play App Signing, the app is permanently locked to that key.

### Generating a new keystore (only if you don't have one)

The existing key was generated for this project. To create a fresh one (new
app identity — do **not** do this for an already-published app):

```bash
keytool -genkeypair -v -keystore ceditrack-release.jks -alias ceditrack \
  -keyalg RSA -keysize 2048 -validity 9125 \
  -dname "CN=CediTrack, OU=Mobile, O=CediTrack, L=Accra, ST=Greater Accra, C=GH"
```

Then write `android/keystore.properties` with the password you chose:

```
storeFile=ceditrack-release.jks
storePassword=<your-password>
keyAlias=ceditrack
keyPassword=<your-password>
```
- re-add the new redirect URL to the Cloud Dashboard
