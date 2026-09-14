# Codenotch Privacy Policy

Effective date: 2026-09-14

Codenotch displays coding-assistant usage from the Codenotch agent on your own
Mac. You do not create a Codenotch account or log in to this app. The app has no
analytics, advertising, or crash-reporting SDKs and does not use biometrics.

## Camera, photos, and pairing

Camera access is used only to scan a pairing QR code. Camera frames are processed
on your phone; the app does not save or transmit them. You can also select one
image containing a QR code with the system photo picker. The code is decoded on
your phone, and the image is not uploaded. The Android app does not request
storage permission for this. If you tap Paste, the app reads the clipboard text
to use a pairing link.

## Communication with your Mac

The app connects directly to the agent address in your pairing link, intended
for your own Mac on the same local network. The developer operates no relay
server for these connections and receives none of your pairing or usage data.
The app displays the usage, session, and provider account information returned
by your Mac.

With protocol v3, pairing sends a randomly generated installation ID, your device
name (or a model name fallback), and platform to your Mac. Pairing and usage
request bodies and successful reply bodies are encrypted between your phone and
Mac using keys derived from pairing. The installation ID is also sent in a
request header, which is not encrypted over the local network. Health checks
and error replies are not encrypted. Legacy protocol v1 connections remain
supported: they send the device name during pairing, sign requests, and leave
request and reply bodies unencrypted.

## Local storage and removal

On mobile, connection settings, pairing credentials, and the installation ID are
stored using SecureStore. AsyncStorage holds a re-pairing notice and is also used
for storage in the web version; older mobile connection records are migrated out
of AsyncStorage. Disconnecting removes the saved connection settings and
credentials from both stores and clears cached readings. It retains the
installation ID and any re-pairing notice, and does not delete records on your
Mac. No biometric authentication is requested to access these stored settings.

## External links

Provider and project website links open using the system browser. Those websites
handle information under their own privacy policies.

## Children and contact

Codenotch is not directed at children. For privacy questions, contact
[mohammad.albarham.work@gmail.com](mailto:mohammad.albarham.work@gmail.com).
