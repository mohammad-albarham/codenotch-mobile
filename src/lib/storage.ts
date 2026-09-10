/** Connection config persistence — AsyncStorage is in Expo Go; MMKV is not. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ConnectionConfig } from "./api";

const KEY = "codenotch.connection.v1";

export async function loadConnection(): Promise<ConnectionConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.host === "string" && typeof parsed?.port === "number" && typeof parsed?.secret === "string") {
      return parsed as ConnectionConfig;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveConnection(config: ConnectionConfig): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(config));
}

export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
