/**
 * Request signing — mirrors codenotch_agent.py exactly:
 *
 *   signature = HMAC-SHA256(secret, ts + "." + nonce + "." + method + "."
 *                                 + path + "." + sha256(body).hexdigest())
 *
 * A passive listener on the network sees signatures, never the secret, and a
 * captured request cannot be replayed (timestamp window + single-use nonces).
 */
import { sha256 } from "js-sha256";

export function bodyHash(body: string): string {
  return sha256(body ?? "");
}

export function signature(secret: string, ts: string, nonce: string, method: string, path: string, bodyHashHex: string): string {
  const message = `${ts}.${nonce}.${method.toUpperCase()}.${path}.${bodyHashHex}`;
  return sha256.hmac(secret, message);
}

export function makeNonce(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Seconds since the epoch, adjusted by the offset learned from a clock-skew
 * reply, so a phone a minute off the Mac still pairs. */
let skewOffsetSeconds = 0;
export function nowTs(): string {
  return String(Math.floor(Date.now() / 1000) + skewOffsetSeconds);
}
export function learnSkew(serverTimeSeconds: number): void {
  skewOffsetSeconds = Math.round(serverTimeSeconds - Date.now() / 1000);
}
export function resetSkew(): void {
  skewOffsetSeconds = 0;
}
