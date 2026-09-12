/** Connection config persistence. The pairing secret is a credential — anyone
 * holding it can read your usage — so it lives in the Keychain / Keystore
 * (expo-secure-store, in Expo Go), not in plain AsyncStorage. Configs saved
 * by earlier builds are moved over once and the plain copy deleted. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getRandomBytesAsync } from "expo-crypto";
import { hexEncode } from "./crypto";
import type { ConnectionConfig } from "./api";

const KEY = "codenotch.connection.v1";
const DID_KEY = "codenotch.device-id.v3";
const REPAIR_NOTICE_KEY = "codenotch.connection.v3-repair-required";
const secure = process.env.EXPO_OS !== "web";

export interface ConnectionLoadResult {
  config: ConnectionConfig | null;
  repairRequired: boolean;
}

function parse(raw: string | null): ConnectionConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.host === "string" && typeof parsed?.port === "number" && typeof parsed?.secret === "string") {
      return parsed as ConnectionConfig;
    }
  } catch {}
  return null;
}

export async function loadConnection(): Promise<ConnectionLoadResult> {
  try {
    const repairRequired = (await AsyncStorage.getItem(REPAIR_NOTICE_KEY)) === "true";
    let stored = secure ? parse(await SecureStore.getItemAsync(KEY)) : parse(await AsyncStorage.getItem(KEY));
    if (!stored && secure) {
      // One-time migration from the plain store earlier builds used.
      stored = parse(await AsyncStorage.getItem(KEY));
      if (stored) {
        await SecureStore.setItemAsync(KEY, JSON.stringify(stored));
        await AsyncStorage.removeItem(KEY);
      }
    }

    if (stored?.api === 2) {
      await clearConnection();
      await AsyncStorage.setItem(REPAIR_NOTICE_KEY, "true");
      return { config: null, repairRequired: true };
    }

    return { config: stored, repairRequired };
  } catch {
    return { config: null, repairRequired: false };
  }
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  if (!secure) {
    await AsyncStorage.setItem(KEY, JSON.stringify(config));
  } else {
    await SecureStore.setItemAsync(KEY, JSON.stringify(config));
    // No credential copy may remain in the plain store.
    await AsyncStorage.removeItem(KEY);
  }
  await AsyncStorage.removeItem(REPAIR_NOTICE_KEY);
}

export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  if (secure) await SecureStore.deleteItemAsync(KEY);
}

function uuidFromRandomBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = hexEncode(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function newDeviceId(): Promise<string> {
  return uuidFromRandomBytes(await getRandomBytesAsync(16));
}

export async function getDeviceId(): Promise<string> {
  try {
    let did = secure ? await SecureStore.getItemAsync(DID_KEY) : await AsyncStorage.getItem(DID_KEY);
    if (!did) {
      did = await newDeviceId();
      if (secure) {
        await SecureStore.setItemAsync(DID_KEY, did);
      } else {
        await AsyncStorage.setItem(DID_KEY, did);
      }
    }
    return did;
  } catch {
    return newDeviceId();
  }
}
