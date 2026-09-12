/** Phone Link API client. v1 remains plaintext for the standalone agent;
 * v3 encrypts and authenticates every content-bearing body. */
import { bodyHash, legacySignature, makeNonce, nowTs, signature, learnSkew } from "./signing";
import { getDeviceId } from "./storage";
import { deriveDeviceKeys, deriveDeviceSecret, derivePairingKeys, hexDecode, hexEncode, open, seal } from "./crypto";
import type { PairingInfo } from "./pairing";
import type { Snapshot } from "./types";

export interface ConnectionConfig {
  host: string;
  port: number;
  /** Hex encoding for persistence only. Crypto operations decode it to raw bytes. */
  secret: string;
  serverName?: string;
  demo?: boolean;
  api?: 1 | 2 | 3;
  hosts?: string[];
  deviceId?: string;
}

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
  kind: "unreachable" | "rejected" | "clock-skew" | "server" | "bad-code" | "code-expired" | "out-of-date";
  detail?: string;

  constructor(kind: ApiError["kind"], message: string, detail?: string) {
    super(message);
    this.kind = kind;
    this.detail = detail;
  }
}

interface SignedInit {
  method: "GET" | "POST";
  /** Full request target. AAD strips its query string; the signature does not. */
  path: string;
  body?: string;
  timeoutMs?: number;
  onHostUpdate?: (config: ConnectionConfig) => void;
}

interface Attempt {
  response: Response;
  host: string;
  ts: string;
  nonce: string;
}

interface AttemptRequest {
  init: RequestInit;
  ts: string;
  nonce: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function attemptHosts(
  config: ConnectionConfig,
  buildRequest: () => Promise<AttemptRequest>,
  path: string,
  timeoutMs: number,
): Promise<Attempt | null> {
  const hosts = [config.host, ...(config.hosts ?? []).filter((host) => host !== config.host)];
  for (const host of hosts) {
    const request = await buildRequest();
    try {
      return {
        response: await fetchWithTimeout(`${baseURL(host, config.port)}${path}`, request.init, timeoutMs),
        host,
        ts: request.ts,
        nonce: request.nonce,
      };
    } catch {
      // A Mac may advertise several private interfaces; try the next one.
    }
  }
  return null;
}

async function readPlainJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestAAD(ts: string, nonce: string, method: string, path: string, deviceId: string): string {
  return `v3|req|${ts}|${nonce}|${method.toUpperCase()}|${path}|${deviceId}`;
}

function responseAAD(ts: string, nonce: string, method: string, path: string, deviceId: string, status: number): string {
  return `v3|res|${ts}|${nonce}|${method.toUpperCase()}|${path}|${deviceId}|${status}`;
}

function pairRequestAAD(ts: string, nonce: string, deviceId: string): string {
  return `v3|pair-req|${ts}|${nonce}|POST|/api/v3/pair|${deviceId}`;
}

function pairResponseAAD(ts: string, nonce: string, deviceId: string, status: number): string {
  return `v3|pair-res|${ts}|${nonce}|POST|/api/v3/pair|${deviceId}|${status}`;
}

function learnClockSkew(payload: any): boolean {
  return payload?.error === "clock-skew" && typeof payload.serverTime === "number" && learnSkew(payload.serverTime);
}

async function throwApiError(response: Response, mac: boolean): Promise<never> {
  const payload = await readPlainJson(response);
  const why = payload?.error ?? "rejected";

  if (response.status === 401 && why === "clock-skew" && typeof payload?.serverTime === "number") {
    learnClockSkew(payload);
    throw new ApiError("clock-skew", "The phone's clock is off from the Mac's", why);
  }
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new ApiError("rejected", mac ? "The Mac rejected this request. Try again." : "The agent rejected this request. Try again.", why);
  }
  throw new ApiError("server", mac ? `The Mac answered ${response.status}` : `The agent answered ${response.status}`, why);
}

async function signedFetchV1(config: ConnectionConfig, init: SignedInit): Promise<any> {
  const body = init.body ?? "";
  const attempt = await attemptHosts(
    config,
    async () => {
      const ts = nowTs();
      const nonce = await makeNonce();
      const headers: Record<string, string> = {
        "X-CN-Timestamp": ts,
        "X-CN-Nonce": nonce,
        "X-CN-Signature": legacySignature(config.secret, ts, nonce, init.method, init.path, bodyHash(body)),
      };
      if (body) headers["Content-Type"] = "application/json";
      return {
        ts,
        nonce,
        init: {
          method: init.method,
          headers,
          body: init.method === "POST" ? body : undefined,
        },
      };
    },
    init.path,
    init.timeoutMs ?? 8_000,
  );
  if (!attempt) throw new ApiError("unreachable", "Couldn't reach the agent");
  if (!attempt.response.ok) return throwApiError(attempt.response, false);

  const payload = await readPlainJson(attempt.response);
  if (payload == null) throw new ApiError("server", "The agent returned an invalid response");
  if (attempt.host !== config.host) init.onHostUpdate?.({ ...config, host: attempt.host });
  return payload;
}

async function signedFetchV3(config: ConnectionConfig, init: SignedInit): Promise<any> {
  const deviceId = config.deviceId;
  if (!deviceId) throw new ApiError("server", "This connection must be paired again");

  const uri = init.path;
  const path = uri.split("?", 1)[0];
  const { K_sig, K_enc } = deriveDeviceKeys(hexDecode(config.secret));
  const attempt = await attemptHosts(
    config,
    async () => {
      const ts = nowTs();
      const nonce = await makeNonce();
      const body = init.body === undefined ? "" : await seal(K_enc, init.body, requestAAD(ts, nonce, init.method, path, deviceId));
      const headers: Record<string, string> = {
        "X-CN-Timestamp": ts,
        "X-CN-Nonce": nonce,
        "X-CN-Device": deviceId,
        "X-CN-Signature": signature(K_sig, ts, nonce, init.method, uri, bodyHash(body)),
      };
      if (init.body !== undefined) headers["Content-Type"] = "application/codenotch-v3";
      return {
        ts,
        nonce,
        init: {
          method: init.method,
          headers,
          body: init.body === undefined ? undefined : body,
        },
      };
    },
    uri,
    init.timeoutMs ?? 8_000,
  );
  if (!attempt) throw new ApiError("unreachable", "Couldn't reach your Mac");
  if (!attempt.response.ok) return throwApiError(attempt.response, true);

  try {
    const envelope = await attempt.response.text();
    const plaintext = open(K_enc, envelope, responseAAD(attempt.ts, attempt.nonce, init.method, path, deviceId, attempt.response.status));
    const payload = JSON.parse(plaintext);
    if (attempt.host !== config.host) init.onHostUpdate?.({ ...config, host: attempt.host });
    return payload;
  } catch {
    throw new ApiError("server", "The Mac response could not be authenticated");
  }
}

async function signedFetch(config: ConnectionConfig, init: SignedInit): Promise<any> {
  return config.api === 3 ? signedFetchV3(config, init) : signedFetchV1(config, init);
}

/** Prove the legacy v1 secret and learn the standalone agent's name. */
export async function pair(config: ConnectionConfig, deviceName: string): Promise<{ server: string; demo: boolean }> {
  const payload = await signedFetchV1(config, {
    method: "POST",
    path: "/api/v1/pair",
    body: JSON.stringify({ name: deviceName }),
  });
  return { server: payload.server, demo: !!payload.demo };
}

async function healthForHost(host: string, port: number): Promise<any> {
  const response = await fetchWithTimeout(`${baseURL(host, port)}/health`, { method: "GET" }, 3_000);
  if (!response.ok) throw new Error("health failed");
  return readPlainJson(response);
}

export async function pairV3(
  link: PairingInfo & { version: 2 | 3 },
  deviceName: string,
  platform: "ios" | "android" | "web",
): Promise<{ config: ConnectionConfig; server: string; demo: boolean }> {
  const deviceId = await getDeviceId();
  let reachedCompatibleMac = false;

  for (const host of link.hosts) {
    try {
      const health = await healthForHost(host, link.port);
      if (typeof health?.api !== "number") continue;
      if (health.api < 3) throw new ApiError("out-of-date", "Your Mac app is out of date");
      if (health?.ok !== true || health?.app !== "codenotch") continue;
      reachedCompatibleMac = true;

      const ts = nowTs();
      const nonce = await makeNonce();
      const plaintext = JSON.stringify({ deviceId, name: deviceName, platform });
      const { K_pair_sig, K_pair_enc } = derivePairingKeys(link.code);
      const body = await seal(K_pair_enc, plaintext, pairRequestAAD(ts, nonce, deviceId));
      const response = await fetchWithTimeout(
        `${baseURL(host, link.port)}/api/v3/pair`,
        {
          method: "POST",
          headers: {
            "X-CN-Timestamp": ts,
            "X-CN-Nonce": nonce,
            "X-CN-Device": deviceId,
            "X-CN-Signature": signature(K_pair_sig, ts, nonce, "POST", "/api/v3/pair", bodyHash(body)),
            "Content-Type": "application/codenotch-v3",
          },
          body,
        },
        3_000,
      );

      if (!response.ok) {
        const error = await readPlainJson(response);
        const why = error?.error ?? "rejected";
        if (why === "clock-skew" && typeof error?.serverTime === "number") {
          learnClockSkew(error);
          throw new ApiError("clock-skew", "The phone's clock is off from the Mac's", why);
        }
        if (why === "bad-code") throw new ApiError("bad-code", "That code didn't work", why);
        if (why === "code-expired") throw new ApiError("code-expired", "That code expired", why);
        throw new ApiError("rejected", "The Mac rejected this pairing request. Try again.", why);
      }

      let payload: any;
      try {
        payload = JSON.parse(open(K_pair_enc, await response.text(), pairResponseAAD(ts, nonce, deviceId, response.status)));
      } catch {
        throw new ApiError("server", "The Mac response could not be authenticated");
      }
      if (payload?.paired !== true || typeof payload?.api !== "number" || payload.api < 3 || payload?.deviceId !== deviceId || typeof payload?.server !== "string") {
        throw new ApiError("server", "The Mac returned an invalid pairing response");
      }

      const secret = hexEncode(deriveDeviceSecret(link.code, deviceId));
      const config: ConnectionConfig = {
        host,
        port: link.port,
        secret,
        serverName: payload.server,
        demo: false,
        api: 3,
        hosts: link.hosts,
        deviceId,
      };
      return { config, server: payload.server, demo: false };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // A dead advertised interface is expected; try the next one.
    }
  }

  throw new ApiError("unreachable", reachedCompatibleMac ? "Couldn't complete pairing with your Mac" : "Couldn't reach the Mac on any interface");
}

export async function fetchSnapshot(config: ConnectionConfig, onHostUpdate?: (config: ConnectionConfig) => void): Promise<Snapshot> {
  const path = config.api === 3 ? "/api/v3/snapshot" : "/api/v1/snapshot";
  return (await signedFetch(config, { method: "GET", path, onHostUpdate })) as Snapshot;
}

export async function refreshSnapshot(config: ConnectionConfig, onHostUpdate?: (config: ConnectionConfig) => void): Promise<Snapshot> {
  const path = config.api === 3 ? "/api/v3/refresh" : "/api/v1/refresh";
  return (await signedFetch(config, { method: "POST", path, timeoutMs: 25_000, onHostUpdate })) as Snapshot;
}
