/**
 * The staff IP allow-list for the admin portal (`docs/02-access-control.md`:
 * "IP allow-list for admin"; T-058, enforced for T-067).
 *
 * The admin portal is also deployed on a private route, so this is the second
 * layer rather than the only one: it stops a staff session being replayed from
 * outside the office or VPN even if a token leaks.
 *
 * The rule is a pure function over strings so it can be tested exhaustively and
 * used from Next.js middleware, which runs on the edge runtime and cannot reach
 * the gateway's Nest guard.
 *
 * IPv4 only, because that is what the South African ISPs and the office links
 * hand out; an IPv6 caller is denied rather than silently allowed. Being
 * conservative matters here — a wrong `true` is a breach, a wrong `false` is a
 * support ticket.
 */

/** A single address or a `/n` block, as written in the configuration. */
export type IpRange =
  | { kind: 'address'; bytes: number[] }
  | { kind: 'cidr'; bytes: number[]; prefix: number };

/** `1.2.3.4` or `1.2.3.0/24`. Returns `undefined` for anything else. */
export function parseIpRange(input: string): IpRange | undefined {
  const text = input.trim();
  if (text.length === 0) return undefined;

  const [addr, prefixText, ...rest] = text.split('/');
  if (rest.length > 0) return undefined;

  const bytes = parseIpv4(addr);
  if (!bytes) return undefined;

  if (prefixText === undefined) return { kind: 'address', bytes };

  // `/0` to `/32` only; `/33` is a typo, not a broad match.
  if (!/^\d{1,2}$/.test(prefixText)) return undefined;
  const prefix = Number(prefixText);
  if (prefix < 0 || prefix > 32) return undefined;
  return { kind: 'cidr', bytes, prefix };
}

function parseIpv4(text: string): number[] | undefined {
  const parts = text.split('.');
  if (parts.length !== 4) return undefined;
  const bytes: number[] = [];
  for (const part of parts) {
    // Reject `01`, `+1`, ` 1` and `1.0e2`: only plain decimal octets. A leading
    // zero is ambiguous — some parsers read `010` as octal — so it is refused.
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return undefined;
    const n = Number(part);
    if (n > 255) return undefined;
    bytes.push(n);
  }
  return bytes;
}

/**
 * Parses a comma-separated allow-list. Unparseable entries are dropped rather
 * than throwing: a typo in one entry must not take the whole portal down, and
 * `isIpAllowed` denies anything the remaining entries do not cover.
 */
export function parseAllowlist(csv: string | undefined): IpRange[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map(parseIpRange)
    .filter((r): r is IpRange => r !== undefined);
}

/** Whether `ip` falls inside `range`. */
export function ipInRange(ip: string, range: IpRange): boolean {
  const bytes = parseIpv4(ip.trim());
  if (!bytes) return false;
  if (range.kind === 'address') return bytes.every((b, i) => b === range.bytes[i]);

  const prefix = range.prefix;
  const fullBytes = Math.floor(prefix / 8);
  const remainder = prefix % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (bytes[i] !== range.bytes[i]) return false;
  }
  if (remainder === 0) return true;
  const mask = 0xff << (8 - remainder);
  return (bytes[fullBytes] & mask) === (range.bytes[fullBytes] & mask);
}

/**
 * The decision for one request.
 *
 * - No allow-list configured: allowed. Local development and preview builds have
 *   no office range; the deploy contract test requires production to set one.
 * - A list is configured but the caller's IP is missing or unparseable: denied.
 *   A proxy that drops `X-Forwarded-For` must not become a way past the list.
 */
export function isIpAllowed(ip: string | undefined, ranges: readonly IpRange[]): boolean {
  if (ranges.length === 0) return true;
  if (!ip) return false;
  return ranges.some((range) => ipInRange(ip, range));
}

/** The caller's IP from the proxy headers, first hop only. */
export function clientIpFromHeaders(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  // Vercel and some proxies use a single-value header.
  return headers.get('x-real-ip')?.trim() || undefined;
}

/** Everything the middleware needs, in one place. */
export function allowlistDecision(
  headers: Headers,
  csv: string | undefined,
): { allowed: boolean; ip?: string } {
  const ip = clientIpFromHeaders(headers);
  return { allowed: isIpAllowed(ip, parseAllowlist(csv)), ip };
}

/**
 * Only a same-origin path is a valid place to send someone after sign-in
 * (T-058). Lives beside the allow-list because both are the same kind of rule:
 * a small, pure check on caller-supplied input that a mistake in is a breach.
 *
 * This is the open-redirect guard: `?returnTo=https://evil.example`,
 * `//evil.example` (protocol-relative) and `/\evil.example` (browsers treat the
 * backslash as a slash) all fall back to the fallback. A path that merely
 * contains a colon, like `/orders/abc:1`, is fine and kept.
 */
export function safeReturnPath(candidate: string | undefined, fallback = '/'): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return fallback;
  if (/[\r\n\t]/.test(candidate)) return fallback;
  return candidate;
}
