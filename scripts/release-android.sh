#!/usr/bin/env bash
# Build a release-signed Android APK and publish it as a GitHub Release.
#
#   scripts/release-android.sh            build, verify, tag, publish
#   scripts/release-android.sh --dry-run  build and verify only
#
# Release notes come from docs/releases/v<version>.md when that file exists.
#
# The version comes from app.json (expo.version / expo.android.versionCode).
# Bump both before releasing. The signing key never leaves this Mac: Gradle
# reads CODENOTCH_UPLOAD_* from ~/.gradle/gradle.properties (see
# RELEASING-ANDROID.md).
set -euo pipefail
cd "$(dirname "$0")/.."

# SHA-256 of the certificate every GitHub APK must be signed with. Changing it
# breaks updates for every installed copy — users would have to uninstall.
EXPECTED_CERT_SHA256="205a74f51292715ed9063cb524dd13968e2d03102953f3a535085d592ddc1ec8"
# React Native's template debug key. Public: anyone can sign with it.
DEBUG_CERT_SHA256="fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c"

dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true

die() { echo "error: $*" >&2; exit 1; }
# Release blockers; a dry run reports them and keeps building.
block() { if ${dry_run}; then echo "warning: $*" >&2; else die "$*"; fi; }

version=$(node -p 'require("./app.json").expo.version')
version_code=$(node -p 'require("./app.json").expo.android.versionCode || 0')
tag="v${version}"

# 1. Preconditions --------------------------------------------------------
git diff --quiet HEAD -- || block "uncommitted changes to tracked files; commit first"
if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  block "tag ${tag} already exists; bump expo.version and expo.android.versionCode in app.json"
fi

prev_tag=$(git describe --tags --abbrev=0 --match 'v*' --exclude "${tag}" 2>/dev/null || true)
if [[ -n "${prev_tag}" ]]; then
  prev_code=$(git show "${prev_tag}:app.json" | node -p 'JSON.parse(require("fs").readFileSync(0)).expo.android?.versionCode || 1')
  (( version_code > prev_code )) || block "versionCode ${version_code} must be greater than ${prev_tag}'s ${prev_code}"
fi

props="${HOME}/.gradle/gradle.properties"
for key in CODENOTCH_UPLOAD_STORE_FILE CODENOTCH_UPLOAD_STORE_PASSWORD CODENOTCH_UPLOAD_KEY_ALIAS CODENOTCH_UPLOAD_KEY_PASSWORD; do
  grep -Eq "^${key}=.+" "${props}" 2>/dev/null || die "${key} missing from ${props}; see RELEASING-ANDROID.md"
done

jdk17=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
[[ -d "${jdk17}" ]] && export JAVA_HOME="${jdk17}"
unset JAVA_TOOL_OPTIONS

sdk="${ANDROID_HOME:-${HOME}/Library/Android/sdk}"
apksigner=$(ls -d "${sdk}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -1)
[[ -x "${apksigner}" ]] || die "apksigner not found under ${sdk}/build-tools"

# 2. Build ----------------------------------------------------------------
echo "Building ${tag} (versionCode ${version_code})…"
npm run prebuild:android
(cd android && ./gradlew assembleRelease)
apk=android/app/build/outputs/apk/release/app-release.apk

# 3. Verify the signature -------------------------------------------------
cert=$("${apksigner}" verify --print-certs "${apk}" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
[[ "${cert}" != "${DEBUG_CERT_SHA256}" ]] || die "APK is signed with the public debug key; check the upload signing properties"
[[ "${cert}" == "${EXPECTED_CERT_SHA256}" ]] || die "APK certificate ${cert} is not the pinned release certificate"

mkdir -p build-out
out="build-out/codenotch-${tag}-android.apk"
# Never overwrite a released artifact; dry runs get their own name.
if ${dry_run}; then out="build-out/codenotch-${tag}-android-dryrun.apk"; fi
${dry_run} || [[ ! -e "${out}" ]] || die "${out} already exists"
cp "${apk}" "${out}"
(cd build-out && shasum -a 256 "$(basename "${out}")" > "$(basename "${out}").sha256")
echo "Built and verified: ${out}"

# 4. Publish --------------------------------------------------------------
if ${dry_run}; then
  echo "Dry run: not tagging or publishing."
  exit 0
fi
git tag -a "${tag}" -m "Codenotch ${tag}"
git push origin "${tag}"
# Notes from docs/releases/<tag>.md when present, else GitHub's commit list.
notes="docs/releases/${tag}.md"
if [[ -f "${notes}" ]]; then notes_args=(--notes-file "${notes}"); else notes_args=(--generate-notes); fi
gh release create "${tag}" "${out}" "${out}.sha256" \
  --title "Codenotch ${tag}" "${notes_args[@]}"
echo "Published ${tag}."
