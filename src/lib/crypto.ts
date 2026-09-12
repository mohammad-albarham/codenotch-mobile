import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";

const EMPTY_SALT = new Uint8Array(0);
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export interface DeviceKeys {
  K_sig: Uint8Array;
  K_enc: Uint8Array;
}

export interface PairingKeys {
  K_pair_sig: Uint8Array;
  K_pair_enc: Uint8Array;
}

export function hexDecode(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function deriveDeviceSecret(code: string, deviceId: string): Uint8Array {
  return hmac(sha256, hexDecode(code), utf8ToBytes(`codenotch-device-v3:${deviceId}`));
}

export function deriveDeviceKeys(secret: Uint8Array): DeviceKeys {
  return {
    K_sig: deriveKey(secret, "codenotch/v3/sig"),
    K_enc: deriveKey(secret, "codenotch/v3/enc"),
  };
}

export function derivePairingKeys(code: string): PairingKeys {
  const codeBytes = hexDecode(code);
  return {
    K_pair_sig: deriveKey(codeBytes, "codenotch/v3/pair-sig"),
    K_pair_enc: deriveKey(codeBytes, "codenotch/v3/pair-enc"),
  };
}

function deriveKey(ikm: Uint8Array, info: string): Uint8Array {
  return hkdf(sha256, ikm, EMPTY_SALT, utf8ToBytes(info), 32);
}

export async function seal(key: Uint8Array, plaintext: string, aad: string): Promise<string> {
  const { getRandomBytesAsync } = await import("expo-crypto");
  return sealWithNonce(key, plaintext, aad, await getRandomBytesAsync(GCM_NONCE_BYTES));
}

export function sealWithNonce(key: Uint8Array, plaintext: string, aad: string, nonce: Uint8Array): string {
  if (nonce.length !== GCM_NONCE_BYTES) throw new Error("AES-GCM nonce must be 12 bytes");
  const ciphertextAndTag = gcm(key, nonce, utf8ToBytes(aad)).encrypt(utf8ToBytes(plaintext));
  return base64Encode(concatBytes(nonce, ciphertextAndTag));
}

export function open(key: Uint8Array, envelopeBase64: string, aad: string): string {
  const envelope = base64Decode(envelopeBase64);
  if (envelope.length < GCM_NONCE_BYTES + GCM_TAG_BYTES) throw new Error("Invalid v3 envelope");
  const nonce = envelope.slice(0, GCM_NONCE_BYTES);
  const ciphertextAndTag = envelope.slice(GCM_NONCE_BYTES);
  const plaintext = gcm(key, nonce, utf8ToBytes(aad)).decrypt(ciphertextAndTag);
  return new TextDecoder().decode(plaintext);
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.length + right.length);
  result.set(left);
  result.set(right, left.length);
  return result;
}

function base64Encode(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const value = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    result += BASE64[(value >>> 18) & 63];
    result += BASE64[(value >>> 12) & 63];
    result += index + 1 < bytes.length ? BASE64[(value >>> 6) & 63] : "=";
    result += index + 2 < bytes.length ? BASE64[value & 63] : "=";
  }
  return result;
}

function base64Decode(value: string): Uint8Array {
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.slice(0, -2).includes("=")) {
    throw new Error("Invalid base64 envelope");
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((value.length / 4) * 3 - padding);
  let output = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64.indexOf(value[index]);
    const b = BASE64.indexOf(value[index + 1]);
    const c = value[index + 2] === "=" ? 0 : BASE64.indexOf(value[index + 2]);
    const d = value[index + 3] === "=" ? 0 : BASE64.indexOf(value[index + 3]);
    const decoded = (a << 18) | (b << 12) | (c << 6) | d;
    if (output < bytes.length) bytes[output++] = (decoded >>> 16) & 0xff;
    if (output < bytes.length) bytes[output++] = (decoded >>> 8) & 0xff;
    if (output < bytes.length) bytes[output++] = decoded & 0xff;
  }
  return bytes;
}
