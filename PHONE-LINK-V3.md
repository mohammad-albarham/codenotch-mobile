# Codenotch Phone Link — protocol v3

**Status:** contract for implementation. Both the Mac server and the phone client
build against this document. Where this document and existing code disagree,
this document wins.

## Why v3 exists

v2 review found three things:

1. The listener binds `0.0.0.0` and `POST /api/v2/pair` is armed permanently.
2. Bodies cross the LAN in plaintext, and **responses are not authenticated at
   all** — anyone on the network can spoof a snapshot.
3. Device secrets sit in `devices.json` in the clear.

v3 fixes 1 and 2 on the wire. 3 is storage-side and specified here only where it
touches the wire.

## Design constraints

- **No native modules on the phone.** No TLS, no per-Mac certificate, no cert
  pinning. Expo Go must keep working. This is why encryption is at the
  application layer rather than the transport.
- **The pairing code is the only out-of-band channel.** It is already
  distributed by QR. Everything else derives from it.
- **No secret ever crosses the wire.** Already true in v2; preserve it.

## Breaking change: v2 is dropped, not bridged

The server serves v3 only. Mixed-mode signing is where protocols get broken.
Re-pairing costs the user one QR scan.

- Existing `devices.json` entries hold v2-derived secrets, which cannot be
  upgraded (different derivation). On load, **discard them and rewrite the
  file.** No v2 secret is ever written to the keychain.
- The UI must say "Re-pair your phone after updating" when it discards records.
- `/health` advertises `"api": 3`. The phone refuses to pair against `api < 3`
  with "Your Mac app is out of date".

The v1 path (the standalone `agent/codenotch_agent.py`, static secret, plaintext)
stays in the phone client for now and is **out of scope for this round**. The
phone must show a persistent "Unencrypted (legacy agent)" indicator whenever a
v1 connection is active.

## Key schedule

Pairing code `C`: 16 random bytes from `SecRandomCopyBytes`, hex-encoded to 32
chars. Unchanged from v2.

**All key material is raw bytes. Never key an HMAC with an ASCII hex string.**
(v2 did: `SymmetricKey(data: Data(device.secret.utf8))`. That is what this fixes.)

Device secret, derived independently on both sides, never transmitted:

```
S = HMAC-SHA256(key = hexdecode(C), msg = "codenotch-device-v3:" + deviceId)   // 32 raw bytes
```

Per-purpose keys, HKDF-SHA256 (RFC 5869), zero-length salt, L = 32:

```
K_sig      = HKDF(IKM = S,           info = "codenotch/v3/sig")
K_enc      = HKDF(IKM = S,           info = "codenotch/v3/enc")
K_pair_sig = HKDF(IKM = hexdecode(C), info = "codenotch/v3/pair-sig")
K_pair_enc = HKDF(IKM = hexdecode(C), info = "codenotch/v3/pair-enc")
```

One key, one purpose. Do not sign and encrypt with the same key.

## Envelope

Every body that carries content — request and response, pairing included — is:

```
base64( nonce12 || ciphertext || tag16 )
```

- **AES-256-GCM.** Key `K_enc` (or `K_pair_enc` for pairing).
- `nonce12`: 12 bytes from a CSPRNG, fresh per message. A response MUST NOT
  reuse the request's nonce.
- Sent as base64 **text**, `content-type: application/codenotch-v3`. Base64
  rather than raw binary because React Native `fetch` handles binary bodies
  badly.

### Requests without a body

`GET /api/v3/snapshot` and `POST /api/v3/refresh` carry **no request body at
all**. There is nothing to encrypt, so there is no envelope.

- The client sends no body and no `content-type`. It does **not** send an
  envelope of the empty string. In particular it never puts a body on a GET:
  `URLSession` refuses to send one, and intermediaries drop it.
- The signature still covers `sha256hex("")` for those requests, per the formula
  above. Nothing else changes.
- The server **must not attempt to decrypt an absent body.** Decrypt only when a
  body is present. An empty body with a valid signature is proof the client
  genuinely sent none — the body hash is inside the signed string, so an
  attacker cannot strip a body without breaking the MAC.
- **Responses are always encrypted**, including responses to bodiless requests.

### AAD — this is what binds a ciphertext to its request

ASCII, pipe-separated, no trailing separator:

```
request:  v3|req|<ts>|<nonce>|<METHOD>|<path>|<deviceId>
response: v3|res|<ts>|<nonce>|<METHOD>|<path>|<deviceId>|<status>
pairing request:  v3|pair-req|<ts>|<nonce>|POST|/api/v3/pair|<deviceId>
pairing response: v3|pair-res|<ts>|<nonce>|POST|/api/v3/pair|<deviceId>|<status>
```

`<ts>` and `<nonce>` in the **response** AAD are the ones from the request that
produced it. That is deliberate: it binds each response to exactly one request,
so a captured response cannot be replayed or spliced onto a different one.

`<path>` excludes the query string. `<status>` is the numeric HTTP status.

## Headers

Unchanged names:

- `x-cn-timestamp` — seconds since epoch, decimal
- `x-cn-nonce` — **16 bytes from a CSPRNG, hex-encoded (32 chars)**
- `x-cn-device` — the device id, plaintext, on pairing requests too
- `x-cn-signature` — see below

The nonce must come from a cryptographic RNG (`expo-crypto`'s
`getRandomBytesAsync` on the phone). v2's `n-${Date.now()}-${Math.random()}` is
not acceptable and is part of what this round fixes.

`x-cn-device` is plaintext on pairing so it can appear in the AAD. It is a random
UUID and carries nothing. The device *name* and platform stay encrypted.

## Signature — encrypt-then-MAC

```
sig = HMAC-SHA256(K_sig, "<ts>.<nonce>.<METHOD>.<uri>.<sha256hex(body-as-sent)>")
```

hex-encoded, compared in constant time. `body-as-sent` is the **base64 envelope
bytes**, i.e. the MAC covers the ciphertext, not the plaintext. Encrypt-then-MAC
is the correct order; do not invert it.

`<uri>` is the full request target including query string (v2 behaviour —
preserve it).

Pairing requests sign with `K_pair_sig`.

**Responses carry no signature header.** GCM plus the response AAD already
authenticates them. Do not add a redundant MAC.

## Error responses are unauthenticated — and the client must treat them that way

Some errors happen before a key is available (`unknown-device`,
`pairing-closed`, `rate-limited`). Those bodies stay plaintext JSON.

The phone **MUST NOT change durable state in response to an unauthenticated
error.** Specifically: never delete the stored secret, never unpair, never clear
the connection on a 401/403/429. Show a retry state only. Otherwise anyone on
the LAN forges one 401 and unpairs the phone.

`clock-skew` replies carry `serverTime` and are also unauthenticated. Keep
`learnSkew`, but clamp: reject any implied offset greater than 24 hours. A
forged skew is then a denial of service and nothing more — the timestamp is
inside both the signature and the AAD, and nonces are single-use server-side, so
it cannot enable a replay.

## Endpoints

| Endpoint | Auth | Body |
|---|---|---|
| `GET /health` | none | plaintext JSON, `{"ok":true,"app":"codenotch","api":3,"version":"x.y.z"}` |
| `POST /api/v3/pair` | `K_pair_sig` + window open | encrypted under `K_pair_enc` |
| `GET /api/v3/snapshot` | `K_sig` | encrypted under `K_enc` |
| `POST /api/v3/refresh` | `K_sig` | encrypted under `K_enc` |

`/health` stays plaintext: it is discovery, it holds no secret, and the phone
needs it before any key exists.

Pairing request plaintext: `{"deviceId","name","platform"}`.
Pairing response plaintext: `{"paired":true,"server","version","api":3,"deviceId"}`.

## Pairing window

The pairing endpoint must be reachable only while a human is looking at the QR.

- The code is generated **when the pairing window opens**, not in
  `PhoneLinkPairing.init`. With no window open, no code exists and no rotation
  timer runs.
- `POST /api/v3/pair` returns `403 {"error":"pairing-closed"}` unless the window
  is open.
- The window closes on: successful pair, user closing it, or 5 minutes elapsed.
- Retired-code handling stays (`{"error":"code-expired"}`). It leaks nothing and
  is a genuinely useful message.

## Bind

Bind each private IPv4 returned by `PhoneLinkNetwork.getHosts()`, plus
`127.0.0.1` — one NIO channel per address. The invariant to hold:

> the server listens exactly where the QR says to reach it.

- Rebind on network change via `NWPathMonitor`.
- If there is no private address, **do not bind at all** and surface
  `.failed("no private network")`.

Be honest in the PR about what this does and does not buy: on café Wi-Fi `en0`
*is* the café, so this does not narrow that exposure. What it does buy is no
listener on `awdl0`, `utun*` (VPN), Thunderbolt bridge or USB tethering, and a
hard fail-closed when the Mac holds a public address directly — where `0.0.0.0`
would put the socket on the internet with only a remote-address check in front
of it. The café case is fixed by the pairing window, not by the bind.

## Replay and rate limiting

- Nonce store: key by **deviceId** for `/api/v3/*`, by IP for `/api/v3/pair`
  (no device is established yet). v2 keyed everything by IP, which breaks when a
  phone's DHCP lease changes.
- Timestamp window stays ±120 s. Nonce retention stays 300 s.
- Rate limits unchanged: 10/min per IP on pair, 120/min on the API.
- Body cap stays 64 KB, and must be enforced on the envelope before base64
  decoding.

## Storage (Mac)

- `PairedDevice` **loses its `secret` field.** Metadata (`deviceId`, `name`,
  `platform`, `pairedAt`, `lastSeenAt`, `lastSeenIP`) stays in `devices.json`.
- The secret goes to the keychain via the existing
  `Sources/Providers/KeychainItem.swift`: service
  `com.codenotch.phonelink.device`, account = `deviceId`.
- Why split rather than move the whole record: the handler updates
  `lastSeenAt`/`lastSeenIP` on **every** request. With the secret on the struct,
  every heartbeat becomes a keychain round-trip.
- `remove(deviceId:)` must delete the keychain item too. Unpairing destroys the
  secret; it does not orphan it.
- `SecItemCopyMatching` cannot run in a unit test. Introduce
  `PhoneLinkSecretStore` (protocol) with a keychain implementation and an
  in-memory one, injected into `PhoneLinkRegistry` the same way the directory
  already is.

## Storage (phone)

The device secret stays in `expo-secure-store` (already the case — see
`src/lib/storage.ts`). Do not move it to `AsyncStorage`.

## Test vectors

Both implementations must agree on these before either is considered done.
The implementing agent generates them from its own side and writes them to
`PHONE-LINK-V3-VECTORS.json` next to this file, in this shape:

```json
{
  "code": "<32 hex chars>",
  "deviceId": "<uuid>",
  "S": "<64 hex chars>",
  "K_sig": "<64 hex>", "K_enc": "<64 hex>",
  "K_pair_sig": "<64 hex>", "K_pair_enc": "<64 hex>",
  "sample": {
    "ts": "1757000000", "nonce": "<32 hex>",
    "method": "GET", "path": "/api/v3/snapshot", "uri": "/api/v3/snapshot",
    "plaintext": "{\"hello\":\"world\"}",
    "gcmNonce": "<24 hex>",
    "aad": "v3|req|1757000000|<nonce>|GET|/api/v3/snapshot|<uuid>",
    "envelopeBase64": "...",
    "signature": "<64 hex>"
  }
}
```

The Mac side owns this file. Every other implementation must reproduce every
value from `code` and `deviceId` alone, as a test that fails if any side drifts.

**The `sample` block is a crypto fixture, not a legal request.** It names
`GET /api/v3/snapshot` and carries a sealed body, which the "Requests without a
body" section forbids on the wire — the method and path are there only so the
AAD and signature strings have something concrete to be built from, and every
implementation must derive the same bytes for them. Do not read it as an example
of a request the phone sends. A real bodiless GET signs over `sha256("")` and
carries no envelope at all.
