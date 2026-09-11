/** Connection config persistence. The pairing secret is a credential — anyone
 * holding it can read your usage — so it lives in the Keychain / Keystore
 * (expo-secure-store, in Expo Go), not in plain AsyncStorage. Configs saved
 * by earlier builds are moved over once and the plain copy deleted. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from 'expo-crypto';
import type { ConnectionConfig } from "./api";

const KEY = "codenotch.connection.v1";
const secure = process.env.EXPO_OS !== "web";

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

export async function loadConnection(): Promise<ConnectionConfig | null> {
  try {
    if (!secure) return parse(await AsyncStorage.getItem(KEY));
    const stored = parse(await SecureStore.getItemAsync(KEY));
    if (stored) return stored;
    // One-time migration from the plain store earlier builds used.
    const legacy = parse(await AsyncStorage.getItem(KEY));
    if (legacy) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(legacy));
      await AsyncStorage.removeItem(KEY);
    }
    return legacy;
  } catch {
    return null;
  }
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  if (!secure) return AsyncStorage.setItem(KEY, JSON.stringify(config));
  await SecureStore.setItemAsync(KEY, JSON.stringify(config));
}

export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
  if (secure) await SecureStore.deleteItemAsync(KEY);
}

export async function getDeviceId(): Promise<string> {
  const DID_KEY = "codenotch.device-id";
  try {
    let did = secure ? await SecureStore.getItemAsync(DID_KEY) : await AsyncStorage.getItem(DID_KEY);
    if (!did) {
      const bytes = Crypto.getRandomBytes(16);
      did = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      if (secure) {
        await SecureStore.setItemAsync(DID_KEY, did);
      } else {
        await AsyncStorage.setItem(DID_KEY, did);
      }
    }
    return did;
  } catch {
    // Fallback if SecureStore fails
    const bytes = Crypto.getRandomBytes(16);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

