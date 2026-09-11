# Codenotch Phone Link — protocol v2

The contract between desktop Codenotch (macOS, Swift) and the Codenotch phone
app (Expo). Both sides implement exactly this. When the two disagree, this file
wins. Test vectors at the end are mandatory on both sides.

## Threat model

Phone and Mac share a home/office LAN. Nothing is exposed to the internet.
A passive sniffer on the LAN must never learn a secret; a captured request must
not be replayable; a screenshot of an old QR code must be useless.

## 1. The pairing link (what the QR code encodes, and what "Copy Link" copies)

```
codenotch://pair?v=2&h=<host1>,<host2>,...&p=<port>&c=<code>&n=<mac name>
```

| Param | Meaning |
|-------|---------|
| `v`   | Protocol version, always `2`. |
| `h`   | Comma-separated hosts in preference order, max 4: the Mac's primary private IPv4 (default-route interface first), other private IPv4s on `en*` interfaces, then `<LocalHostName>.local`. No utun/bridge/awdl/llw/loopback addresses. |
| `p`   | TCP port the Mac listens on (default 8788). |
| `c`   | One-time pairing code: 16 random bytes (SecRandomCopyBytes) as 32 lowercase hex chars. |
| `n`   | The Mac's user-visible computer name, percent-encoded (`Sam%27s%20MacBook%20Pro`). |

Encode every value with RFC 3986 percent-encoding (the commas in `h` may stay
literal). Order of params is not significant.

The phone must also accept:
- `exp+codenotch://pair?...` (Expo Go rewrites the scheme),
- the link embedded in surrounding text (e.g. pasted from Messages),
- the legacy Python-agent string `codenotch://<host>:<port>/<64-hex secret>` (v1, see §6).

### Code lifecycle (Mac)

- A code is valid for **5 minutes** and for **one successful pairing**.
- It rotates on expiry and immediately after a successful pairing, so the QR
  on screen always shows a live code.
- The Mac keeps up to 8 *retired* codes for 10 minutes only to tell a phone
  "that code expired" instead of "that code is wrong". Retired codes never pair.
- Codes exist only in memory. They are never logged or written to disk.

## 2. Request signing (shared by every authenticated request)

```
X-CN-Timestamp: <unix seconds, integer, as decimal string>
X-CN-Nonce:     <opaque string, 8–64 chars, unique per request>
X-CN-Signature: hex(HMAC-SHA256(key, ts + "." + nonce + "." + METHOD + "." + path + "." + hex(SHA256(body))))
```

- `key` is the UTF-8 bytes of the lowercase hex string (the code during pairing,
  the device secret afterwards) — NOT the decoded bytes.
- `path` has no query string. `METHOD` is upper-case. An empty body hashes the
  empty string.
- Server checks, in this order: private-network gate → rate limit → headers
  present → |now − ts| ≤ 120 s → nonce unseen (per source IP, kept 5 min) →
  signature (constant-time compare).

## 3. Pairing: `POST /api/v2/pair`

Signed with **key = the pairing code**.

Request body (JSON, UTF-8):
```json
{"deviceId":"<32 lowercase hex, random, generated once per phone install>","name":"iPhone 17 Pro","platform":"ios"}
```
`platform` is `ios` | `android` | `web`. `name` is truncated to 64 chars by the server.

Server verification: compute the expected signature with the **current** code;
if it matches and the code is unexpired and unused → success. Otherwise, if it
matches a retired code → `401 {"error":"code-expired"}`; else →
`401 {"error":"bad-code"}`. Pairing attempts are rate-limited to 10/min per IP.

On success the server:
1. derives `deviceSecret = hex(HMAC-SHA256(key = UTF-8(code), "codenotch-device-v2:" + deviceId))`,
2. stores/updates the device `{deviceId, name, platform, pairedAt, lastSeenAt, lastSeenIP, secret}`,
3. retires the code and mints a fresh one (QR updates),
4. responds `200`:
```json
{"paired":true,"server":"Sam's MacBook Pro","version":"1.9.0","api":2,"deviceId":"<echo>"}
```

The device secret is **never transmitted**. The phone derives the same value
from the code it scanned.

## 4. Authenticated API (after pairing)

Every request carries the §2 headers signed with **key = deviceSecret**, plus:
```
X-CN-Device: <deviceId>
```

| Route | Response |
|-------|----------|
| `GET /api/v1/snapshot` | `200` Snapshot (§5) — the Mac's current readings, no forced refresh. |
| `POST /api/v1/refresh` | Asks the Mac to refresh every provider (wait ≤ 20 s), then `200` Snapshot. |

Unknown or removed device (or missing `X-CN-Device`) → `401 {"error":"unknown-device"}`.
Bad signature → `401 {"error":"bad-signature"}`. Clock skew →
`401 {"error":"clock-skew","serverTime":<unix seconds, number>}`. Replayed nonce →
`401 {"error":"replayed-nonce"}`. Non-private source IP → `403 {"error":"local-network-only"}`.
Rate limit (120/min per IP) → `429 {"error":"rate-limited"}`.

Unauthenticated:
- `GET /health` → `200 {"ok":true,"app":"codenotch","api":2,"version":"1.9.0"}` (private-network gate still applies).

All responses are `application/json`, `Connection: close` is acceptable.

## 5. Snapshot JSON

Exactly the phone's `src/lib/types.ts` `Snapshot`:

```json
{
  "server": {"name": "Sam's MacBook Pro", "version": "1.9.0", "generatedAt": "2026-09-11T17:55:13Z", "demo": false},
  "providers": [
    {
      "id": "claude", "displayName": "Claude", "fidelity": "official",
      "status": {"kind": "ok"},
      "windows": [{"id": "session", "label": "Current session", "usedFraction": 0.38,
                   "remaining": null, "used": null, "resetsAt": "2026-09-11T20:07:00Z"}],
      "headlineId": "session",
      "block": null,
      "account": {"plan": "max", "source": "Codenotch"}
    }
  ],
  "sessions": [
    {"id": "…", "name": "website-rebuild", "detail": "Terminal · website-rebuild",
     "state": "waiting", "waitingFor": "permission prompt", "since": "2026-09-11T17:51:00Z"}
  ]
}
```

Mapping from desktop types:
- Providers: the store's snapshots in the user's order, **excluding** providers
  the user disconnected and **excluding** `kind == .localRuntime` (Ollama local,
  LM Studio — the phone has no view for them yet).
- `status.kind`: `ok`, `stale` (+ `since` ISO-8601), `needsAuth` (also for
  `signedOutByOwner`), `accessDenied`, `unsupported` (+ `why`), `error` (+ `why`).
- `windows[]`: `id`, `label`, `usedFraction` (null when unknown), `remaining`,
  `used`, `resetsAt` (ISO-8601 or null). Extra fields (`group`, `usedText`,
  `detail`) may be added; the phone ignores what it doesn't know.
- `headlineId` = the provider's declared headline window id (null if none).
- `block` = `{reason, resetsAt}` or null. `account.plan` from `plan` when known.
- Sessions: every live agent session the notch knows about. `state` maps
  busy→`busy`, waiting→`waiting`, success→`idle`, idle→`idle`.
- Dates: ISO-8601 UTC with `Z`, no fractional seconds.

## 6. Legacy v1 (Python agent) — phone only

A stored config with no `deviceId` is a v1 pairing: sign with the shared secret,
send no `X-CN-Device`, pair via `POST /api/v1/pair`. The phone keeps supporting
it; the Mac app does not implement v1.

## 7. Test vectors (both sides MUST assert these)

```
code          = 00112233445566778899aabbccddeeff
deviceId      = 0123456789abcdef0123456789abcdef
deviceSecret  = d56d1f0bfbfff57f6042d9e196373fa64e9c57dd7005a3496ce2046be6c8daf8

pair body     = {"deviceId":"0123456789abcdef0123456789abcdef","name":"Test Phone","platform":"ios"}
sha256(body)  = c10cd76b19c15b55848593dd55b34a478fa9114253db57fa5ed013f44c445423
ts=1757600000 nonce=n-test  POST /api/v2/pair  key=code
signature     = e3e36469c8001024f222c9c1042b575e5653361dbc38de2227de717975031e6c

ts=1757600000 nonce=n-test2 GET /api/v1/snapshot  body="" key=deviceSecret
signature     = eabdc2cf6ddb995110487fea5b42585f2e137bd80260406dffabb476df0c8c3d

link: codenotch://pair?v=2&h=192.168.1.20,Mac.local&p=8788&c=00112233445566778899aabbccddeeff&n=Sam%27s%20MacBook%20Pro
  → hosts ["192.168.1.20","Mac.local"], port 8788, code 00112233…eeff, name "Sam's MacBook Pro"
```
