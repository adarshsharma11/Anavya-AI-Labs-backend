import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {}

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home.arpa"];

export function normalizeUrl(input: unknown) {
  if (typeof input !== "string" || !input.trim()) {
    throw new UnsafeUrlError("URL required");
  }

  let value = input.trim();
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new UnsafeUrlError("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs can be scanned");
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials cannot be scanned");
  }

  parsed.hash = "";
  return parsed.toString();
}

export function getOrigin(url: string) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function isPrivateIPv4(ip: string) {
  const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(address: string) {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();

  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (!net.isIPv6(ip)) return false;

  if (ip === "::" || ip === "::1") return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);
  return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff");
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return true;
  }
  return net.isIP(host.replace(/^\[|\]$/g, "")) !== 0 && isPrivateAddress(host);
}

export async function assertPublicUrl(input: unknown) {
  const url = normalizeUrl(input);
  const hostname = new URL(url).hostname;

  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError("Private or internal addresses cannot be scanned");
  }

  const bare = hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(bare) === 0) {
    let addresses: { address: string }[];
    try {
      addresses = await dns.lookup(bare, { all: true });
    } catch {
      throw new UnsafeUrlError("Could not resolve that domain");
    }
    if (addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new UnsafeUrlError("Private or internal addresses cannot be scanned");
    }
  }

  return url;
}

export const safeRedirects = {
  maxRedirects: 5,
  beforeRedirect: (options: Record<string, any>) => {
    const hostname = String(options.hostname || options.host || "");
    if (isBlockedHostname(hostname)) {
      throw new UnsafeUrlError("Redirect to a private address was blocked");
    }
  },
};
