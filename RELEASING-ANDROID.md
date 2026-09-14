# Release Codenotch on Google Play

1. **Create and back up the upload key once.** Run this yourself with a JDK's
   `keytool`; choose passwords at the prompts. Keep the key outside the repository
   and back up the keystore and credentials securely.

   ```sh
   mkdir -p "$HOME/.android-keys"
   keytool -genkeypair -v -storetype JKS \
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
   Upload the AAB to an internal testing release first. Complete the privacy
   policy URL, Data safety form, content rating questionnaire, and store listing
   text/assets (icon, screenshots, feature graphic). In App access, state that
   Codenotch requires a paired Mac running the Codenotch agent on the same LAN;
   provide working setup and pairing instructions for reviewers. Complete any
   additional requirements shown in [Play Console's review setup](https://support.google.com/googleplay/android-developer/answer/9859455).

Android permission decisions: [SDK 57 Camera](https://docs.expo.dev/versions/v57.0.0/sdk/camera/)
supports `recordAudioAndroid: false`. [SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/#imagepickerlaunchimagelibraryasyncoptions)
documents permission-free Android system image selection; its installed Android
implementation uses `PickVisualMedia`. The QR image flow therefore needs no
storage permission. `android.blockedPermissions` removes `RECORD_AUDIO`,
`SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, and `WRITE_EXTERNAL_STORAGE` at
manifest merge time. Generated main-manifest entries with `tools:node="remove"`
are removal rules, not requested permissions. ImagePicker's
`microphonePermission: false` also removes the iOS microphone description, so
Android blocking is used to preserve the existing iOS configuration.
