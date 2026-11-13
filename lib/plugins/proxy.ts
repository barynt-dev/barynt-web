import type { CredentialLevel } from "./manifest";

// The host proxy's rules (BARY-147): which requests a sandboxed plugin may
// send to the outside through Barynt, which headers go along, which come
// back, and how a credential becomes a header. No dependencies — the
// fetching itself, with its address checks, is `features/plugins/proxy.ts`.

/** Per request. */
export const PROXY_TIMEOUT_MS = 10_000;
/** A request's body, as text. */
export const PROXY_MAX_REQUEST_BYTES = 1024 * 1024;
/** A response's body. */
export const PROXY_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export const PROXY_METHODS = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type ProxyMethod = (typeof PROXY_METHODS)[number];

/** Headers a plugin may send; anything `x-` too, except the proxies'. */
const REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-none-match",
  "if-modified-since",
]);
/** Headers a plugin gets back. */
const RESPONSE_HEADERS = new Set([
  "content-type",
  "etag",
  "last-modified",
  "location",
  "link",
  "retry-after",
  "x-total-count",
  "x-request-id",
]);

/** Why the proxy refused — a bridge error code. */
export type ProxyRefusal =
  | "invalid_params"
  | "host_not_allowed"
  | "credential_missing"
  | "upstream_failed"
  | "timeout";

export interface ProxyRequest {
  url: URL;
  method: ProxyMethod;
  headers: Record<string, string>;
  body: string | null;
}

/**
 * A plugin's request as the proxy takes it, or why not: an `https` address
 * on one of the manifest's `network` hosts (no user, no password, no port —
 * unless the host is one an admin let through with its port), a known
 * method, a text body within the limit, only the headers above.
 */
export function parseProxyRequest(
  input: unknown,
  network: readonly string[],
  internalHosts: readonly string[],
): ProxyRequest | ProxyRefusal {
  if (!input || typeof input !== "object") return "invalid_params";
  const p = input as Record<string, unknown>;
  if (typeof p.url !== "string" || p.url.length > 2048) return "invalid_params";
  let url: URL;
  try {
    url = new URL(p.url);
  } catch {
    return "invalid_params";
  }
  const host = url.hostname.toLowerCase();
  const internal = internalHosts.includes(url.host.toLowerCase());
  if (url.protocol !== "https:") return "host_not_allowed";
  if (url.username || url.password) return "host_not_allowed";
  if (url.port && !internal) return "host_not_allowed";
  if (!network.includes(host)) return "host_not_allowed";

  const method = (
    typeof p.method === "string" ? p.method.toUpperCase() : "GET"
  ) as ProxyMethod;
  if (!PROXY_METHODS.includes(method)) return "invalid_params";

  let body: string | null = null;
  if (p.body !== undefined && p.body !== null) {
    if (typeof p.body !== "string") return "invalid_params";
    if (method === "GET" || method === "HEAD") return "invalid_params";
    if (new TextEncoder().encode(p.body).length > PROXY_MAX_REQUEST_BYTES)
      return "invalid_params";
    body = p.body;
  }

  const headers: Record<string, string> = {};
  if (p.headers !== undefined) {
    if (!p.headers || typeof p.headers !== "object") return "invalid_params";
    for (const [name, value] of Object.entries(p.headers)) {
      const lower = name.toLowerCase();
      const allowed =
        REQUEST_HEADERS.has(lower) ||
        (lower.startsWith("x-") && !lower.startsWith("x-forwarded"));
      if (!allowed || typeof value !== "string" || /[\r\n]/.test(value))
        continue;
      headers[lower] = value.slice(0, 1000);
    }
  }
  return { url, method, headers, body };
}

/** The response headers a plugin gets: the ones above, and rate limits. */
export function pickResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (
      value === undefined ||
      !(RESPONSE_HEADERS.has(lower) || lower.startsWith("x-ratelimit-"))
    )
      continue;
    out[lower] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

/** A credential as the header it becomes: `format` with `{value}` in it. */
export function credentialHeader(
  credential: { header: string; format: string },
  value: string,
): [string, string] {
  return [
    credential.header.toLowerCase(),
    credential.format.replaceAll("{value}", value.replace(/[\r\n]/g, "")),
  ];
}

/** Where a credential of a level is kept, for a place and a person. */
export function credentialScopeKey(
  level: CredentialLevel,
  place: { workspaceId: string; projectId: string | null },
  userId: string,
): string | null {
  if (level === "workspace") return `ws:${place.workspaceId}`;
  if (level === "project")
    return place.projectId ? `pr:${place.projectId}` : null;
  return `us:${userId}`;
}

/** Text the plugin can read, or base64 for anything else. */
export function isTextType(contentType: string): boolean {
  const type = contentType.split(";")[0].trim().toLowerCase();
  return (
    type.startsWith("text/") ||
    type === "application/json" ||
    type.endsWith("+json") ||
    type === "application/xml" ||
    type.endsWith("+xml") ||
    type === "application/x-www-form-urlencoded" ||
    type === "application/javascript"
  );
}
