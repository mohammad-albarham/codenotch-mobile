/** The signed API client for the codenotch agent. */
import { bodyHash, makeNonce, nowTs, signature, learnSkew } from "./signing";
import { saveConnection, getDeviceId } from "./storage";
import { deriveDeviceSecret, type PairingInfo } from "./pairing";
import type { Snapshot } from "./types";

export interface ConnectionConfig {
  host: string; // no scheme, no port
  port: number;
  secret: string;
  serverName?: string;
  demo?: boolean;
  api?: 1 | 2;
  hosts?: string[];
  deviceId?: string;
}

/** Parse `codenotch://<host>:<port>/<secret>` — the string the agent prints.
 * In Expo Go the scheme arrives as `exp+codenotch://`; accept both. */
export function parsePairingString(text: string): ConnectionConfig | null {
  const match = text
    .trim()
    .match(/^(?:exp\+)?codenotch:\/\/([^/:?#]+)(?::(\d+))?(?:\/|$)([0-9a-fA-F]{32,})\/?$/);
  if (!match) return null;
  return {
    host: match[1],
    port: match[2] ? Number(match[2]) : 8787,
    secret: match[3].toLowerCase(),
    api: 1,
  };
}

export function pairingString(config: ConnectionConfig): string {
  return `codenotch://${config.host}:${config.port}/${config.secret}`;
}

function baseURL(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export class ApiError extends Error {
  kind: "unreachable" | "rejected" | "clock-skew" | "server" | "bad-code" | "code-expired" | "revoked";
  detail?: string;

  constructor(kind: ApiError["kind"], message: string, detail?: string) {
    super(message);
    this.kind = kind;
    this.detail = detail;
  }
}


interface SignedInit {
  method: "GET" | "POST";
  path: string;
  body?: string;
  /** A sleeping Mac or a wrong address otherwise hangs for a minute or more
   * before the OS gives up; the answer is "unreachable" long before that. */
  timeoutMs?: number;
  onHostUpdate?: (config: ConnectionConfig) => void;
}

async function signedFetch(config: ConnectionConfig, init: SignedInit): Promise<any> {
  const body = init.body ?? "";
  const ts = nowTs();
  const nonce = makeNonce();
  const path = init.path; // no query strings anywhere in this API
  const headers: Record<string, string> = {
    "X-CN-Timestamp": ts,
    "X-CN-Nonce": nonce,
    "X-CN-Signature": signature(config.secret, ts, nonce, init.method, path, bodyHash(body)),
  };
  if (body) headers["Content-Type"] = "application/json";
  if (config.deviceId) headers["X-CN-Device"] = config.deviceId;

  const attemptFetch = async (host: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 8_000);
    try {
      return await fetch(`${baseURL(host, config.port)}${path}`, {
        method: init.method,
        headers,
        body: init.method === "POST" ? body : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response: Response | null = null;
  
  try {
    response = await attemptFetch(config.host);
  } catch {
    response = null;
  }

  if (!response && config.hosts && config.hosts.length > 1) {
    for (const fallbackHost of config.hosts) {
      if (fallbackHost === config.host) continue;
      try {
        response = await attemptFetch(fallbackHost);
        if (response) {
          const newConfig = { ...config, host: fallbackHost };
          init.onHostUpdate?.(newConfig);
          break;
        }
      } catch {}
    }
  }

  if (!response) {
    throw new ApiError("unreachable", `Couldn't reach the agent`);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    const why = payload?.error ?? "rejected";
    if (why === "clock-skew" && typeof payload?.serverTime === "number") {
      learnSkew(payload.serverTime);
      throw new ApiError("clock-skew", "The phone's clock is off from the Mac's", why);
    }
    if (why === "unknown-device") {
      throw new ApiError("revoked", "This phone was removed from the Mac's settings", why);
    }
    throw new ApiError("rejected", "The agent rejected this request", why);
  }
  if (response.status === 403) {
    throw new ApiError("rejected", "This agent only answers the local network", "foreign-source");
  }
  if (!response.ok) {
    throw new ApiError("server", `The agent answered ${response.status}`);
  }
  return payload;
}

/** Prove the secret and learn the server's name. Throws ApiError. */
export async function pair(config: ConnectionConfig, deviceName: string): Promise<{ server: string; demo: boolean }> {
  const payload = await signedFetch(config, {
    method: "POST",
    path: "/api/v1/pair",
    body: JSON.stringify({ name: deviceName }),
  });
  return { server: payload.server, demo: !!payload.demo };
}

export async function pairV2(
  link: PairingInfo & { version: 2 },
  deviceName: string,
  platform: "ios" | "android" | "web"
): Promise<{ config: ConnectionConfig; server: string; demo: boolean }> {
  const deviceId = await getDeviceId();
  const bodyStr = JSON.stringify({ deviceId, name: deviceName, platform });
  const bodyHashHex = bodyHash(bodyStr);
  const ts = nowTs();
  const nonce = makeNonce();
  const headers = {
    "X-CN-Timestamp": ts,
    "X-CN-Nonce": nonce,
    "X-CN-Signature": signature(link.code, ts, nonce, "POST", "/api/v2/pair", bodyHashHex),
    "Content-Type": "application/json",
  };

  let response: Response | null = null;
  let successfulHost: string | null = null;

  for (const host of link.hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000); // 3s per host
    try {
      const res = await fetch(`http://${host}:${link.port}/api/v2/pair`, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
      if (res) {
        response = res;
        successfulHost = host;
        break; // First that answers wins
      }
    } catch {
      // Continue to next host
    } finally {
      clearTimeout(timer);
    }
  }

  if (!response || !successfulHost) {
    throw new ApiError("unreachable", `Couldn't reach the Mac on any interface`);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    const why = payload?.error ?? "rejected";
    if (why === "clock-skew" && typeof payload?.serverTime === "number") {
      learnSkew(payload.serverTime);
      throw new ApiError("clock-skew", "The phone's clock is off from the Mac's", why);
    }
    if (why === "bad-code") throw new ApiError("bad-code", "That code didn't work", why);
    if (why === "code-expired") throw new ApiError("code-expired", "That code expired", why);
    throw new ApiError("rejected", "The Mac rejected this request", why);
  }
  if (!response.ok) {
    throw new ApiError("server", `The Mac answered ${response.status}`);
  }

  const secret = deriveDeviceSecret(link.code, deviceId);
  const config: ConnectionConfig = {
    host: successfulHost,
    port: link.port,
    secret,
    serverName: payload.server,
    demo: !!payload.demo,
    api: 2,
    hosts: link.hosts,
    deviceId,
  };

  return { config, server: payload.server, demo: !!payload.demo };
}

export async function fetchSnapshot(config: ConnectionConfig, onHostUpdate?: (config: ConnectionConfig) => void): Promise<Snapshot> {
  return (await signedFetch(config, { method: "GET", path: "/api/v1/snapshot", onHostUpdate })) as Snapshot;
}

/** Asks the Mac to re-read every provider — vendor round-trips included, so
 * it gets a longer leash than a plain snapshot. */
export async function refreshSnapshot(config: ConnectionConfig, onHostUpdate?: (config: ConnectionConfig) => void): Promise<Snapshot> {
  return (await signedFetch(config, { method: "POST", path: "/api/v1/refresh", timeoutMs: 25_000, onHostUpdate })) as Snapshot;
}
