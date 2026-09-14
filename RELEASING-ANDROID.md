# Release Codenotch on Google Play

## Requirements

Build with **JDK 17**. For Homebrew `openjdk@17` on Apple Silicon, set:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
unset JAVA_TOOL_OPTIONS
```

Android Studio's bundled JDK 25 prints a "restricted method" warning (and any
`Picked up JAVA_TOOL_OPTIONS` note) on stderr, and AGP's prefab step treats any
stderr line as an error, failing
`:react-native-worklets:configureCMakeRelWithDebInfo`.

## Build and upload

1. **Create and back up the upload key once.** Run this yourself with a JDK's
   `keytool`; choose passwords at the prompts. Keep the key outside the repository
   and back up the keystore and credentials securely.

   ```sh
   mkdir -p "$HOME/.android-keys"
   "$JAVA_HOME/bin/keytool" -genkeypair -v -storetype PKCS12 \
     -keystore "$HOME/.android-keys/codenotch-upload.jks" \
     -alias codenotch-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure local signing.** Add these four properties to
   `~/.gradle/gradle.properties`, replacing the placeholders. Use an absolute
   keystore path (no `~` or `$HOME`) and Java properties escaping for any
   backslashes in passwords. Keep this file private; never commit credentials.

   ```properties
   CODENOTCH_UPLOAD_STORE_FILE=/absolute/path/to/.android-keys/codenotch-upload.jks
   CODENOTCH_UPLOAD_STORE_PASSWORD=replace-with-store-password
   CODENOTCH_UPLOAD_KEY_ALIAS=codenotch-upload
   CODENOTCH_UPLOAD_KEY_PASSWORD=replace-with-key-password
   ```

   All four values must be nonempty to use upload signing. If any is missing or
   blank, release builds fall back to the debug key for local testing. Such a
   bundle cannot be uploaded to Play. Incorrect credentials or a missing keystore
   with all properties set cause the build to fail instead.

3. **Set the version and generate Android.** Keep `expo.android.package` as
   `com.codenotch`. The first upload uses `expo.android.versionCode: 1`; increase
   it for every subsequent upload. The current version name is `0.2.0`.
   From the checkout root, with dependencies installed, run:

   ```sh
   npm run prebuild:android
   ```

   This runs `expo prebuild --platform android --clean --no-install`.
   Android is generated: put persistent settings in `app.json` or `plugins/`.
   Plain HTTP remains enabled for communication with the Mac over the LAN.

4. **Build the upload bundle.** With the Android SDK and JDK installed, run:

   ```sh
   npm run bundle:android
   ```

   This runs `cd android && ./gradlew bundleRelease`. The AAB is at
   `android/app/build/outputs/bundle/release/app-release.aab`. Build all default
   ABIs; do not add `-PreactNativeArchitectures`. Play generates device-specific
   APKs. Before uploading, confirm the bundle uses your upload certificate and
   inspect the merged release manifest for the blocked permissions below.

5. **Complete Play Console setup and upload.** Create the app, enroll in
   [Play App Signing](https://developer.android.com/studio/publish/app-signing),
   and let Google manage the app signing key while you retain the upload key.
   Upload the AAB to an internal testing release first. Complete the content
   rating questionnaire and the following:

   - **Privacy policy URL:**
     [PRIVACY.md on main](https://github.com/mohammad-albarham/codenotch-mobile/blob/main/PRIVACY.md).
     This URL is derived from `git remote get-url origin` and the checkout's
     `main` branch. Merge the policy into the public default branch and confirm
     the URL opens without signing in before submitting it.
   - **Data safety:** Recommend the conservative declaration
     **Device or other IDs — App functionality, not shared**. Protocol v3 sends
     pairing and usage bodies end-to-end encrypted to the user's own Mac;
     the developer receives nothing. Google's
     [end-to-end-encryption exception](https://support.google.com/googleplay/android-developer/answer/10787469)
     makes "no data collected" defensible for those encrypted bodies. However,
     the device ID header (`X-CN-Device`) travels unencrypted over HTTP on the LAN.
     The app also still accepts legacy v1 pairing with unencrypted bodies, so
     the exception does not cover every supported connection. Review v1's device
     name and usage data when completing the form; the recommended ID declaration
     is not a claim that it exhausts all v1 disclosures. Do not claim that all
     transmitted data is encrypted.
   - **Closed testing:** Personal developer accounts created after 2023-11-13
     need at least **12 testers opted in for 14 continuous days** in a closed
     test before applying for production access. Internal testing does not
     replace this requirement. See Google's
     [testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
   - **Store listing assets:** Supply a **512x512 PNG icon**, a **1024x500 feature
     graphic**, and **at least 2 phone screenshots**, plus the listing text.
     See Google's [asset specifications](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB).
   - **App access:** Reviewers need a Mac running the Codenotch agent on the same
     Wi-Fi as the phone. Provide the
     [Codenotch for Mac installation link](https://github.com/vinzdg/codenotch)
     and these pairing steps: start Codenotch on the Mac, display its Phone Link pairing QR code,
     open Codenotch on the phone, scan that code (granting camera access), and
     keep the Mac awake while checking usage. A selected QR image or pasted
     pairing link also works. Include a demo video link if available. Complete
     any additional requirements shown in
     [Play Console's review setup](https://support.google.com/googleplay/android-developer/answer/9859455).

Android permission decisions: [SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
supports `recordAudioAndroid: false`. [SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/#imagepickerlaunchimagelibraryasyncoptions)
documents permission-free Android system image selection; its installed Android
implementation uses `PickVisualMedia`. The QR image flow therefore needs no
storage permission. `android.blockedPermissions` removes `RECORD_AUDIO`,
`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`,
`USE_BIOMETRIC`, and `USE_FINGERPRINT` at manifest merge time. SecureStore calls
do not request `requireAuthentication`, and the app has no biometric use.
Regenerate and rebuild before upload: changing this config does not alter an
existing AAB. Generated main-manifest entries with `tools:node="remove"`
are removal rules, not requested permissions. ImagePicker's
`microphonePermission: false` also removes the iOS microphone description, so
Android blocking is used to preserve the existing iOS configuration.
