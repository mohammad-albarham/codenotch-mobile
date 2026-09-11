# Codenotch Mobile

Your coding assistant's usage limits — Claude, Codex, GLM and friends — read off
your Mac and shown on your phone. Nothing leaves your local network.

```
┌──────────────────────────┐                              ┌────────────────────────┐
│  Mac                     │   http://192.168.1.20:8788   │  Phone                 │
│  Codenotch (Phone Link)  │ ◀───────────────────────────▶│  Expo / React Native   │
│  reads provider usage    │   HMAC-signed, LAN only      │  rings · sessions      │
└──────────────────────────┘                              └────────────────────────┘
```

The Mac does all the reading. The phone is a viewer: it receives percentages,
reset times and session states — never an API key or token.

<p align="center">
  <img src="assets/screenshots/ios-rings.png" alt="Rings screen on iOS" width="300">
  &nbsp;&nbsp;
  <img src="assets/screenshots/android-rings.png" alt="Rings screen on Android" width="300">
</p>

<p align="center"><sub>The Rings screen — iOS (dark) and Android (light). One codebase, each platform's own look.</sub></p>

## What you get

- **Rings** — one ring per provider, showing how much of the current window is
  spent and when it resets. Tap through for the full window breakdown.
- **Sessions** — every live agent session the Mac knows about, and which one is
  waiting on you (a permission prompt, a question).
- **Settings** — which Mac you're paired with, its address, reading fidelity,
  and the controls to re-pair or disconnect.

Readings refresh every 60 seconds while the app is open, and pull-to-refresh
asks the Mac to re-read every provider on demand.

## Requirements

- Node 20 or newer
- **Codenotch for Mac** with Phone Link (protocol v2) — see
  [vinzdg/codenotch](https://github.com/vinzdg/codenotch) — or the legacy Python
  agent (protocol v1, still supported)
- Phone and Mac on the **same local network**
- To build natively: Xcode (iOS) or Android Studio (Android). Expo Go works too.

## Quick start

```sh
npm install
npm start          # then scan the Metro QR with Expo Go
```

Or build and run natively:

```sh
npm run ios        # expo run:ios
npm run android    # expo run:android
```

## Pairing

On the Mac, open Codenotch's Phone Link window to show a QR code. Then, in the
app:

1. **Scan QR Code** — point the camera at the Mac's screen, or
2. **Paste** — copy the link on the Mac ("Copy Link") and paste it in the app.

A pairing code is good for **5 minutes and one pairing**. It rotates as soon as
you pair, so an old screenshot of the QR is worthless.

The app also accepts a pairing link pasted with surrounding text (from Messages,
say), the `exp+codenotch://` form Expo Go rewrites, and the legacy
`codenotch://<host>:<port>/<secret>` string the Python agent prints.

## How the connection works

The Mac runs a small HTTP server on port 8788, bound to every interface. The QR
encodes its private IPv4 addresses plus `<name>.local`, so the phone tries each
in turn and keeps the one that answers. If the Mac's IP later changes, the phone
falls back to the other addresses on its own.

Pairing derives a per-device secret on both sides from the one-time code. That
secret is **never transmitted**. Every later request carries:

```
X-CN-Timestamp  unix seconds
X-CN-Nonce      unique per request
X-CN-Signature  hex(HMAC-SHA256(secret, ts.nonce.METHOD.path.sha256(body)))
X-CN-Device     this phone's id
```

The full contract, including test vectors both sides assert, is in
[PHONE_LINK_PROTOCOL.md](PHONE_LINK_PROTOCOL.md).

## Security

- **LAN only.** The Mac refuses any request whose source IP isn't private
  (`10.x`, `172.16–31.x`, `192.168.x`, `169.254.x`, IPv6 ULA/link-local),
  before authentication.
- **No secret on the wire.** Both sides derive the device secret from the
  pairing code; a passive sniffer sees signatures only.
- **No replays.** Timestamps must be within ±120 s and each nonce is single-use
  for 5 minutes.
- **Stored in the keychain.** The connection config lives in `expo-secure-store`,
  not plain AsyncStorage.
- **Revocable.** Remove the phone on the Mac and its next request gets
  `401 unknown-device`; the app then shows a re-pair prompt.

## Project layout

```
src/
  app/            expo-router screens — (tabs)/(rings), sessions, settings, pair, scan
  components/     rings, provider cards, session rows, glyphs, shared primitives
  lib/            api client, pairing, signing, storage, formatting
  state/          connection context and TanStack Query snapshot cache
  theme.ts        design tokens
scripts/
  verify-pairing.ts   asserts the protocol test vectors
```

## Development

```sh
npx tsc --noEmit                 # type check
node scripts/verify-pairing.ts   # protocol test vectors
```

`scripts/verify-pairing.ts` checks link parsing and device-secret derivation
against §7 of the protocol doc. The Mac side asserts the same vectors, so if
both suites pass, the two implementations agree.

## Troubleshooting

**"Couldn't reach your Mac"** — almost always a network problem, not a pairing
problem:

- Phone and Mac must be on the same network. Guest Wi-Fi and networks with
  client isolation block device-to-device traffic even when the name matches.
- Turn off any VPN on the phone; it routes requests away from the LAN.
- Wake the Mac and make sure Codenotch is running.
- On iOS, grant the local network permission when prompted.

**"The phone's clock is off from the Mac's"** — the signature window is ±120 s.
Turn on automatic time on both devices.

**"This Mac only answers the local network"** — the request arrived from a
non-private address, which usually means a VPN or a relayed connection.

## License

MIT. See [LICENSE](LICENSE).
