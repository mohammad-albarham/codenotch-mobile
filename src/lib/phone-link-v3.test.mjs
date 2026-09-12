import { afterEach, beforeEach, expect, mock, test } from "bun:test";

const asyncValues = new Map();
const secureValues = new Map();
let randomOffset = 0;

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key) => asyncValues.get(key) ?? null,
    setItem: async (key, value) => void asyncValues.set(key, value),
    removeItem: async (key) => void asyncValues.delete(key),
  },
}));

mock.module("expo-secure-store", () => ({
  getItemAsync: async (key) => secureValues.get(key) ?? null,
  setItemAsync: async (key, value) => void secureValues.set(key, value),
  deleteItemAsync: async (key) => void secureValues.delete(key),
}));

mock.module("expo-crypto", () => ({
  getRandomBytesAsync: async (length) => {
    const offset = randomOffset++;
    return Uint8Array.from({ length }, (_, index) => index + offset);
  },
}));

const {
  deriveDeviceKeys,
  deriveDeviceSecret,
  derivePairingKeys,
  hexDecode,
  hexEncode,
  open,
  sealWithNonce,
} = await import("./crypto.ts");
const { bodyHash, learnSkew, makeNonce, nowTs, resetSkew, signature } = await import("./signing.ts");
const { ApiError, fetchSnapshot, refreshSnapshot } = await import("./api.ts");
const { loadConnection, saveConnection } = await import("./storage.ts");

const vector = await Bun.file(new URL("../../phone-link-v3-vectors.app.json", import.meta.url)).json();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  asyncValues.clear();
  secureValues.clear();
  randomOffset = 0;
  resetSkew();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("reproduces the app v3 vector", () => {
  const { code, deviceId } = vector;
  const ts = "1757000000";
  const nonce = "101112131415161718191a1b1c1d1e1f";
  const method = "GET";
  const path = "/api/v3/snapshot";
  const plaintext = "{\"hello\":\"world\"}";
  const gcmNonce = "202122232425262728292a2b";
  const aad = `v3|req|${ts}|${nonce}|${method}|${path}|${deviceId}`;

  const S = deriveDeviceSecret(code, deviceId);
  const deviceKeys = deriveDeviceKeys(S);
  const pairingKeys = derivePairingKeys(code);
  const envelopeBase64 = sealWithNonce(deviceKeys.K_enc, plaintext, aad, hexDecode(gcmNonce));

  expect({
    code,
    deviceId,
    S: hexEncode(S),
    K_sig: hexEncode(deviceKeys.K_sig),
    K_enc: hexEncode(deviceKeys.K_enc),
    K_pair_sig: hexEncode(pairingKeys.K_pair_sig),
    K_pair_enc: hexEncode(pairingKeys.K_pair_enc),
    sample: {
      ts,
      nonce,
      method,
      path,
      uri: path,
      plaintext,
      gcmNonce,
      aad,
      envelopeBase64,
      signature: signature(deviceKeys.K_sig, ts, nonce, method, path, bodyHash(envelopeBase64)),
    },
  }).toEqual(vector);
});

test("response for request A cannot open for request B", () => {
  const secret = deriveDeviceSecret(vector.code, vector.deviceId);
  const { K_enc } = deriveDeviceKeys(secret);
  const responseNonce = hexDecode("303132333435363738393a3b");
  const aadA = `v3|res|1757000000|${vector.sample.nonce}|GET|/api/v3/snapshot|${vector.deviceId}|200`;
  const aadB = `v3|res|1757000000|ffffffffffffffffffffffffffffffff|GET|/api/v3/snapshot|${vector.deviceId}|200`;
  const envelope = sealWithNonce(K_enc, "{\"ok\":true}", aadA, responseNonce);

  expect(open(K_enc, envelope, aadA)).toBe("{\"ok\":true}");
  expect(() => open(K_enc, envelope, aadB)).toThrow();
});

test("forged 401 leaves the stored v3 secret intact", async () => {
  const config = {
    host: "192.168.1.20",
    port: 8787,
    secret: vector.S,
    api: 3,
    deviceId: vector.deviceId,
    hosts: ["192.168.1.20", "192.168.1.21"],
  };
  await saveConnection(config);
  globalThis.fetch = async (url) => {
    if (String(url).includes("192.168.1.20")) throw new Error("primary unreachable");
    return new Response('{"error":"unknown-device"}', {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  };

  let error;
  let persistedHostUpdate = false;
  try {
    await fetchSnapshot(config, () => {
      persistedHostUpdate = true;
    });
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ApiError);
  expect(error.kind).toBe("rejected");
  expect(persistedHostUpdate).toBe(false);
  expect((await loadConnection()).config.secret).toBe(vector.S);
});

test("plaintext success response is never accepted as a fallback", async () => {
  const config = {
    host: "192.168.1.20",
    port: 8787,
    secret: vector.S,
    api: 3,
    deviceId: vector.deviceId,
  };
  globalThis.fetch = async () => new Response('{"server":{"name":"forged"}}', { status: 200 });

  let error;
  try {
    await fetchSnapshot(config);
  } catch (caught) {
    error = caught;
  }

  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).toBe("The Mac response could not be authenticated");
});

test("host retries rebuild the request with a fresh nonce", async () => {
  const config = {
    host: "192.168.1.20",
    port: 8787,
    secret: vector.S,
    api: 3,
    deviceId: vector.deviceId,
    hosts: ["192.168.1.20", "192.168.1.21"],
  };
  const { K_sig, K_enc } = deriveDeviceKeys(hexDecode(config.secret));
  const attempts = [];

  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    const nonce = headers.get("X-CN-Nonce");
    const ts = headers.get("X-CN-Timestamp");
    attempts.push({ nonce, ts, signature: headers.get("X-CN-Signature") });
    if (String(url).includes("192.168.1.20")) throw new Error("response lost");

    const aad = `v3|res|${ts}|${nonce}|GET|/api/v3/snapshot|${config.deviceId}|200`;
    const envelope = sealWithNonce(K_enc, "{}", aad, hexDecode("303132333435363738393a3b"));
    return new Response(envelope, { status: 200 });
  };

  await expect(fetchSnapshot(config)).resolves.toEqual({});
  expect(attempts).toHaveLength(2);
  expect(attempts[0].nonce).not.toBe(attempts[1].nonce);
  for (const attempt of attempts) {
    expect(attempt.signature).toBe(signature(K_sig, attempt.ts, attempt.nonce, "GET", "/api/v3/snapshot", bodyHash("")));
  }
});

test("snapshot and refresh send no body and sign the empty-body hash", async () => {
  const config = {
    host: "192.168.1.20",
    port: 8787,
    secret: vector.S,
    api: 3,
    deviceId: vector.deviceId,
  };
  const { K_sig, K_enc } = deriveDeviceKeys(hexDecode(config.secret));
  const requests = [];

  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init.headers);
    const method = init.method;
    const path = new URL(String(url)).pathname;
    const ts = headers.get("X-CN-Timestamp");
    const nonce = headers.get("X-CN-Nonce");

    expect(init.body).toBeUndefined();
    expect(headers.has("content-type")).toBe(false);
    expect(headers.get("X-CN-Signature")).toBe(signature(K_sig, ts, nonce, method, path, bodyHash("")));
    requests.push({ method, path });

    const aad = `v3|res|${ts}|${nonce}|${method}|${path}|${config.deviceId}|200`;
    const envelope = sealWithNonce(K_enc, "{}", aad, hexDecode("303132333435363738393a3b"));
    return new Response(envelope, { status: 200 });
  };

  await fetchSnapshot(config);
  await refreshSnapshot(config);
  expect(requests).toEqual([
    { method: "GET", path: "/api/v3/snapshot" },
    { method: "POST", path: "/api/v3/refresh" },
  ]);
});

test("stored v2 connection is discarded with a re-pair notice", async () => {
  await saveConnection({ host: "192.168.1.20", port: 8787, secret: "aa".repeat(32), api: 2 });
  const loaded = await loadConnection();
  expect(loaded.config).toBeNull();
  expect(loaded.repairRequired).toBe(true);
});

test("nonces are 16 async CSPRNG bytes and clock skew is clamped", async () => {
  expect(await makeNonce()).toBe("000102030405060708090a0b0c0d0e0f");
  const before = Number(nowTs());
  expect(learnSkew(Date.now() / 1000 + 24 * 60 * 60 + 1)).toBe(false);
  expect(Math.abs(Number(nowTs()) - before)).toBeLessThanOrEqual(1);
});
