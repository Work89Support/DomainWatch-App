import net from "node:net";

type HeaderReader = { get(name: string): string | null };

export function normalizeClientIp(value?: string | null): string | null {
  let ip = (value || "").split(",")[0]?.trim().replace(/^"|"$/g, "");
  if (!ip) return null;
  if (ip.startsWith("[") && ip.includes("]")) ip = ip.slice(1, ip.indexOf("]"));
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  if (ip.toLowerCase().startsWith("::ffff:") && net.isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return net.isIP(ip) ? ip.toLowerCase() : null;
}

export function getClientIp(headers: HeaderReader): string | null {
  return normalizeClientIp(
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for") ||
    headers.get("x-real-ip")
  );
}

function ipv4ToBigInt(ip: string): bigint {
  return ip.split(".").reduce((value, part) => (value << 8n) + BigInt(Number(part)), 0n);
}

function ipv6ToBigInt(ip: string): bigint {
  let source = ip.toLowerCase();
  const ipv4Match = source.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const v4 = ipv4Match[1].split(".").map(Number);
    source = source.slice(0, -ipv4Match[1].length) +
      `${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = source.split("::");
  const left = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const fill = halves.length === 2 ? Array(Math.max(0, 8 - left.length - right.length)).fill("0") : [];
  const groups = [...left, ...fill, ...right];
  if (groups.length !== 8) throw new Error("invalid IPv6");
  return groups.reduce((value, group) => (value << 16n) + BigInt(parseInt(group || "0", 16)), 0n);
}

function ipToBigInt(ip: string): { value: bigint; bits: number } | null {
  const version = net.isIP(ip);
  if (version === 4) return { value: ipv4ToBigInt(ip), bits: 32 };
  if (version === 6) return { value: ipv6ToBigInt(ip), bits: 128 };
  return null;
}

export function parseAllowedIpRanges(value?: string | null): string[] {
  return (value || "")
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isValidIpRule(rule: string): boolean {
  const [rawIp, rawPrefix, extra] = rule.split("/");
  if (extra !== undefined) return false;
  const ip = normalizeClientIp(rawIp);
  if (!ip) return false;
  if (rawPrefix === undefined) return true;
  if (!/^\d+$/.test(rawPrefix)) return false;
  const max = net.isIP(ip) === 4 ? 32 : 128;
  const prefix = Number(rawPrefix);
  return prefix >= 0 && prefix <= max;
}

export function normalizeAllowedIpRanges(value?: string | null): string | null {
  const rules = parseAllowedIpRanges(value);
  if (!rules.length) return null;
  if (!rules.every(isValidIpRule)) throw new Error("รูปแบบ IP/CIDR ไม่ถูกต้อง");
  return [...new Set(rules)].join("\n");
}

export function isIpAllowed(clientIp: string | null, configured?: string | null): boolean {
  const rules = parseAllowedIpRanges(configured);
  if (!rules.length) return true;
  const normalized = normalizeClientIp(clientIp);
  if (!normalized) return false;
  const client = ipToBigInt(normalized);
  if (!client) return false;

  return rules.some((rule) => {
    if (!isValidIpRule(rule)) return false;
    const [rawNetwork, rawPrefix] = rule.split("/");
    const networkIp = normalizeClientIp(rawNetwork);
    if (!networkIp) return false;
    const network = ipToBigInt(networkIp);
    if (!network || network.bits !== client.bits) return false;
    const prefix = rawPrefix === undefined ? network.bits : Number(rawPrefix);
    if (prefix === 0) return true;
    const shift = BigInt(network.bits - prefix);
    return (client.value >> shift) === (network.value >> shift);
  });
}
