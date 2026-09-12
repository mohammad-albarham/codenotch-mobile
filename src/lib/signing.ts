import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { sha256 as legacySha256 } from "js-sha256";
import { hexEncode } from "./crypto";

const MAX_SKEW_SECONDS = 24 * 60 * 60;

export function bodyHash(bodyAsSent: string): string {
  return hexEncode(sha256(utf8ToBytes(bodyAsSent ?? "")));
}

/** v3 encrypt-then-MAC signature. `bodyHashHex` is the hash of the base64
 * envelope exactly as sent, or of the empty body when there is no body. */
export function signature(
  K_sig: Uint8Array,
  ts: string,
  nonce: string,
  method: string,
  uri: string,
  bodyHashHex: string,
): string {
  const message = `${ts}.${nonce}.${method.toUpperCase()}.${uri}.${bodyHashHex}`;
  return hexEncode(hmac(sha256, K_sig, utf8ToBytes(message)));
}

/** The standalone v1 Python agent deliberately keeps its original ASCII-key
 * signing behavior. */
export function legacySignature(
  secret: string,
  ts: string,
  nonce: string,
  method: string,
  uri: string,
  bodyHashHex: string,
): string {
  const message = `${ts}.${nonce}.${method.toUpperCase()}.${uri}.${bodyHashHex}`;
  return legacySha256.hmac(secret, message);
}

export async function makeNonce(): Promise<string> {
  const { getRandomBytesAsync } = await import("expo-crypto");
  return hexEncode(await getRandomBytesAsync(16));
}

/** Seconds since the epoch, adjusted by the offset learned from a clock-skew
 * reply, so a phone a minute off the Mac still pairs. */
let skewOffsetSeconds = 0;
export function nowTs(): string {
  return String(Math.floor(Date.now() / 1000) + skewOffsetSeconds);
}
/** Returns false and leaves the current offset untouched when an
 * unauthenticated reply implies more than 24 hours of skew. */
export function learnSkew(serverTimeSeconds: number): boolean {
  if (!Number.isFinite(serverTimeSeconds)) return false;
  const candidate = Math.round(serverTimeSeconds - Date.now() / 1000);
  if (Math.abs(candidate) > MAX_SKEW_SECONDS) return false;
  skewOffsetSeconds = candidate;
  return true;
}
export function resetSkew(): void {
  skewOffsetSeconds = 0;
}
