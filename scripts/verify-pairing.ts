// @ts-ignore
import { parsePairingLink, deriveDeviceSecret } from '../src/lib/pairing.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`Assertion failed: ${msg}`);
    process.exit(1);
  }
}

function testParse() {
  const link2 = "codenotch://pair?v=2&h=192.168.1.20,Mac.local&p=8788&c=00112233445566778899aabbccddeeff&n=Sam%27s%20MacBook%20Pro";
  const parsed2 = parsePairingLink(link2);
  assert(parsed2 !== null && parsed2.version === 2, "v2 parsed successfully");
  if (parsed2 && parsed2.version === 2) {
    assert(parsed2.hosts.join(',') === "192.168.1.20,Mac.local", "hosts match");
    assert(parsed2.port === 8788, "port matches");
    assert(parsed2.code === "00112233445566778899aabbccddeeff", "code matches");
    assert(parsed2.serverName === "Sam's MacBook Pro", "serverName matches");
  }

  // Embedded link
  const embedded = `Here is my link: exp+codenotch://pair?v=2&h=10.0.0.1&p=1234&c=00112233445566778899aabbccddeeff&n=Test! Try it.`;
  const parsedEmb = parsePairingLink(embedded);
  assert(parsedEmb !== null && parsedEmb.version === 2, "embedded parsed successfully");
  if (parsedEmb && parsedEmb.version === 2) {
    assert(parsedEmb.hosts[0] === "10.0.0.1", "embedded host match");
    assert(parsedEmb.serverName === "Test", "embedded name match");
  }

  const link1 = "codenotch://192.168.1.5:8788/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const parsed1 = parsePairingLink(link1);
  assert(parsed1 !== null && parsed1.version === 1, "v1 parsed successfully");
  if (parsed1 && parsed1.version === 1) {
    assert(parsed1.host === "192.168.1.5", "v1 host match");
    assert(parsed1.port === 8788, "v1 port match");
    assert(parsed1.secret === "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "v1 secret match");
  }

  console.log("Parse tests passed.");
}

function testDerivation() {
  const code = "00112233445566778899aabbccddeeff";
  const deviceId = "0123456789abcdef0123456789abcdef";
  const expectedSecret = "d56d1f0bfbfff57f6042d9e196373fa64e9c57dd7005a3496ce2046be6c8daf8";

  const secret = deriveDeviceSecret(code, deviceId);
  assert(secret === expectedSecret, "Device secret matches §7 vector");
  console.log("Derivation tests passed.");
}

testParse();
testDerivation();
