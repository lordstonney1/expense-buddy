# Plan: Make CediTrack Play Store–ready (signed release AAB)

## Current state (verified this turn)
- A real **debug** APK exists at `public/CediTrack.apk` (4.5 MB) and installs via the landing-page "Download Android APK" button. Sideloading on Android devices already works.
- The Android project (`/android`) is real and compiles. `applicationId = app.lovable.ceditrack`, `versionCode 1`, `versionName "1.0"`, `minSdk 24`, `targetSdk 36` — all within Play Store requirements (Play requires targetSdk 34+ for new apps in 2025).
- **Blocker for Play Store:** `android/app/build.gradle` has a `release` build type with **no signing config**. No keystore exists. The Play Store rejects debug-signed/unsigned builds; it requires a release-signed **Android App Bundle (`.aab`)**.

## What we'll do

### 1. Generate a release keystore (in the sandbox)
- Use `keytool` (bundled with the installed JDK 21) to create `android/app/ceditrack-release.jks`:
  - alias: `ceditrack`
  - CN/Org: `CediTrack`, validity 25 years
  - Passwords: generated, then stored in a gitignored `android/keystore.properties` file (keystore password, key alias, key password).
- Add `android/keystore.properties` and `*.jks` / `*.keystore` to `.gitignore` so the signing key never leaks into the repo.

### 2. Wire the signing config into Gradle
- Edit `android/app/build.gradle`:
  - Load `keystore.properties` at the top of the `android {}` block.
  - Add a `signingConfigs { release { ... } }` block referencing the keystore file, alias, and passwords.
  - Point the existing `release` build type at `signingConfig signingConfigs.release`.
  - Bump `versionCode 1` → keep at 1 (first release), confirm `versionName "1.0"`.
- This makes every `release` build signed automatically, including from Android Studio's "Generate Signed Bundle" flow.

### 3. Build the signed release AAB + a signed release APK
- Run `./gradlew :app:bundleRelease` to produce `android/app/build/outputs/bundle/release/app-release.aab` — the format the Play Store requires for new app submissions (Aug 2021 onward).
- Run `./gradlew :app:assembleRelease` to also produce a signed `app-release.apk` for direct install/testing on devices that prefer APKs.
- Copy the signed release APK to `public/CediTrack.apk` (replacing the debug build) so the download button serves a release-signed, production-grade app.
- Report the AAB path and the keystore backup instructions to you.

### 4. Document the Play Store upload path (in `ANDROID.md`)
- Add a "Publishing to Google Play" section covering:
  - You must create a Google Play Console developer account ($25 one-time) at play.google.com/console.
  - Create a new app → Internal testing (fastest first release) or Production.
  - Upload the `.aab` (drag-drop in the Play Console).
  - Fill required store listing: app name, short/full description, app icon (512×512), feature graphic, screenshots, privacy policy URL.
  - Set up **Play App Signing** (opt-in once on first upload) — Google keeps your signing key safe so you can reset it if you lose the keystore; your upload key still signs bundles.
  - Add reviewers' emails for internal testing to distribute before production.

### 5. Keystore backup warning (critical)
- The generated keystore is the **only** thing that lets you publish updates to this app on the Play Store. Losing it means you can never update the published app.
- I'll print its path and the `keystore.properties` contents so you can download both files (`ceditrack-release.jks` + `keystore.properties`) to a safe location immediately after the build.

## Out of scope
- Registering the Play Console account (you'll do that; $25 one-time, takes ~1–3 days for Google to verify).
- Writing the actual store listing copy/screenshots (can be added once you have the account).
- iOS / App Store (Capacitor can build iOS too, but that needs macOS + Xcode — not possible in this sandbox).

## Acceptance
- `android/app/build.gradle` has a working release signing config.
- A signed `.aab` exists at `android/app/build/outputs/bundle/release/app-release.aab`.
- `public/CediTrack.apk` is replaced with the signed release APK.
- `ANDROID.md` documents the Play Store upload steps + keystore backup.
- Keystore + properties are gitignored.
