/** The signed API client for the codenotch agent. */
import { bodyHash, makeNonce, nowTs, signature, learnSkew } from "./signing";
import type { Snapshot } from "./types";

export interface ConnectionConfig {
  host: string; // no scheme, no port
  port: number;
  secret: string;
  serverName?: string;
  demo?: boolean;
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
  };
}

export function pairingString(config: ConnectionConfig): string {
  return `codenotch://${config.host}:${config.port}/${config.secret}`;
}

function baseURL(config: ConnectionConfig): string {
  return `http://${config.host}:${config.port}`;
}

export class ApiError extends Error {
  kind: "unreachable" | "rejected" | "clock-skew" | "server";
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 8_000);
  let response: Response;
  try {
    response = await fetch(`${baseURL(config)}${path}`, {
      method: init.method,
      headers,
      body: init.method === "POST" ? body : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("unreachable", `Couldn't reach the agent at ${config.host}:${config.port}`);
  } finally {
    clearTimeout(timer);
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

export async function fetchSnapshot(config: ConnectionConfig): Promise<Snapshot> {
  return (await signedFetch(config, { method: "GET", path: "/api/v1/snapshot" })) as Snapshot;
}

/** Asks the Mac to re-read every provider — vendor round-trips included, so
 * it gets a longer leash than a plain snapshot. */
export async function refreshSnapshot(config: ConnectionConfig): Promise<Snapshot> {
  return (await signedFetch(config, { method: "POST", path: "/api/v1/refresh", timeoutMs: 25_000 })) as Snapshot;
}
