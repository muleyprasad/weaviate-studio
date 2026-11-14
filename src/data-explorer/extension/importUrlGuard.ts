/**
 * importUrlGuard - Host validation for URL imports.
 *
 * The extension fetches import payloads on the user's behalf, so the URL must
 * not be able to reach the local machine or a cloud metadata endpoint, either
 * directly or through a redirect. Scheme checks live here alongside the address
 * checks so every hop of a redirect can be validated with the same rules.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Maximum number of redirects followed for one import */
export const MAX_IMPORT_REDIRECTS = 3;

export type HostResolver = (hostname: string) => Promise<string[]>;

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => entry.address);
}

let resolveHostname: HostResolver = defaultResolveHostname;

/**
 * Test seam: override DNS resolution so unit tests stay offline.
 * Pass undefined to restore the real resolver.
 */
export function setHostResolverForTesting(resolver: HostResolver | undefined): void {
  resolveHostname = resolver ?? defaultResolveHostname;
}

/** Hostnames that never count as public, even before DNS resolution */
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

/** Suffixes reserved for local networks */
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/**
 * True for loopback, private, link-local (including cloud metadata), CGNAT,
 * multicast and reserved addresses, in either address family.
 */
export function isPrivateOrLocalAddress(address: string): boolean {
  const value = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!value) {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) follows the IPv4 rules
  if (value.startsWith('::ffff:')) {
    return isPrivateOrLocalAddress(value.slice('::ffff:'.length));
  }

  const family = isIP(value);
  if (family === 4) {
    const [a, b] = value.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) {
      return true;
    }
    if (a === 169 && b === 254) {
      // Link-local, which includes 169.254.169.254 instance metadata
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 100 && b >= 64 && b <= 127) {
      // Carrier-grade NAT
      return true;
    }
    return a >= 224; // multicast and reserved space
  }

  if (family === 6) {
    if (value === '::' || value === '::1') {
      return true;
    }
    if (/^f[cd]/.test(value)) {
      return true; // fc00::/7 unique local
    }
    if (/^fe[89ab]/.test(value)) {
      return true; // fe80::/10 link-local
    }
    return /^ff/.test(value); // multicast
  }

  // Not an IP literal: treat as unsafe so callers resolve first
  return true;
}

/**
 * Throws unless the URL uses http/https and has a hostname.
 */
export function assertImportUrlScheme(url: URL): void {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Import URL must use http or https');
  }
  if (!url.hostname) {
    throw new Error('Import URL must include a hostname');
  }
}

/**
 * Throws unless the URL points at a public host, resolving DNS names so a
 * redirect cannot land on localhost or a private range.
 */
export async function assertPublicImportHost(url: URL): Promise<void> {
  assertImportUrlScheme(url);

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Import URL must point to a public host (got ${hostname})`);
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new Error(`Import URL must point to a public host (got ${hostname})`);
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateOrLocalAddress(hostname)) {
      throw new Error(`Import URL must point to a public host (got ${hostname})`);
    }
    return;
  }

  let addresses: string[];
  try {
    addresses = await resolveHostname(hostname);
  } catch {
    throw new Error(`Import URL host could not be resolved: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`Import URL host could not be resolved: ${hostname}`);
  }
  if (addresses.some(isPrivateOrLocalAddress)) {
    throw new Error(`Import URL must point to a public host (got ${hostname})`);
  }
}
