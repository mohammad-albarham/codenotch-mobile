export type PairingInfo = 
  | { version: 2 | 3; hosts: string[]; port: number; code: string; serverName: string }
  | { version: 1; host: string; port: number; secret: string };

export function parsePairingLink(text: string): PairingInfo | null {
  if (!text) return null;

  // Extract link from surrounding text if any
  const match = text.match(/(?:exp\+)?codenotch:\/\/[^\s"'<>]+/i);
  if (!match) return null;

  let urlStr = match[0];
  // Strip trailing punctuation
  urlStr = urlStr.replace(/[.,;:!?)\]}'"]+$/, "");
  urlStr = urlStr.replace(/^exp\+codenotch:\/\//i, 'codenotch://');

  try {
    const url = new URL(urlStr);

    if (url.host === 'pair') {
      const v = url.searchParams.get('v');
      if (v === "2" || v === "3") {
        const h = url.searchParams.get('h');
        const p = url.searchParams.get('p');
        const c = url.searchParams.get('c');
        const n = url.searchParams.get('n');

        if (!h || !p || !c) return null;

        if (!/^[0-9a-f]{32}$/i.test(c)) return null;
        const code = c.toLowerCase();

        const port = parseInt(p, 10);
        if (isNaN(port) || port < 1 || port > 65535) return null;

        const hosts = h.split(',').map(s => s.trim()).filter(Boolean);
        if (hosts.length === 0 || hosts.length > 4) return null;

        return {
          version: Number(v) as 2 | 3,
          hosts,
          port,
          code,
          serverName: n || "your Mac"
        };
      }
    } else {
      // Legacy v1
      // codenotch://<host>:<port>/<64-hex secret>
      if (!url.hostname || !url.port || !url.pathname) return null;
      const secret = url.pathname.slice(1); // remove leading '/'
      if (secret.length !== 64 || !/^[0-9a-f]+$/i.test(secret)) return null;
      
      const port = parseInt(url.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) return null;

      return {
        version: 1,
        host: url.hostname,
        port,
        secret
      };
    }
  } catch {
    return null;
  }
  return null;
}
