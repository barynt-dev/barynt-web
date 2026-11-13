import "server-only";
import { lookup } from "node:dns/promises";
import https from "node:https";
import { db } from "@/lib/db";
import type { BridgeResponse } from "@/lib/plugins/bridge";
import { pluginInternalHosts } from "@/lib/plugins/dev";
import {
  credentialHeader,
  credentialScopeKey,
  isTextType,
  PROXY_MAX_RESPONSE_BYTES,
  PROXY_TIMEOUT_MS,
  type ProxyRequest,
  parseProxyRequest,
  pickResponseHeaders,
} from "@/lib/plugins/proxy";
import { isPrivateAddress } from "@/lib/public-fetch";
import { openSecret } from "@/lib/secret-box";
import type { RunningPlugin } from "./runtime";

// The host proxy (BARY-147): a sandboxed plugin has no network of its own,
// so it asks Barynt to call one of the hosts its manifest names. Barynt
// resolves the host, refuses private addresses (unless an admin let the host
// through, `PLUGIN_INTERNAL_HOSTS`), and connects to exactly the address it
// checked — a DNS answer that changes in between (rebinding) can't send the
// request somewhere else. It adds the credentials the manifest declares for
// that host itself; the plugin never sees them. Redirects aren't followed:
// the plugin gets the 3xx and may ask again, for a host it's allowed.

const no = (error: string): BridgeResponse =>
  ({ ok: false, error }) as BridgeResponse;

/** The address to connect to: every address of the host public, or the
 *  host one an admin let through. `null` when it isn't. */
async function checkedAddress(
  host: string,
  internal: boolean,
): Promise<{ address: string; family: number } | null> {
  try {
    const all = await lookup(host, { all: true });
    if (all.length === 0) return null;
    if (!internal && all.some((a) => isPrivateAddress(a.address))) return null;
    return all[0];
  } catch {
    return null;
  }
}

/** The headers of the credentials the manifest declares for this host,
 *  opened — or which one is missing. */
async function credentialsFor(
  userId: string,
  plugin: RunningPlugin,
  host: string,
): Promise<Record<string, string> | { missing: string }> {
  const declared = (plugin.manifest.contributes.credentials ?? []).filter(
    (c) => c.host === host,
  );
  const headers: Record<string, string> = {};
  for (const credential of declared) {
    const scopeKey = credentialScopeKey(credential.level, plugin, userId);
    const row = scopeKey
      ? await db.pluginCredential.findUnique({
          where: {
            pluginId_scopeKey_key: {
              pluginId: plugin.pluginId,
              scopeKey,
              key: credential.key,
            },
          },
          select: { valueCipher: true },
        })
      : null;
    const value = row && openSecret(row.valueCipher, "plugin-credential");
    if (!value) return { missing: credential.key };
    const [name, header] = credentialHeader(credential, value);
    headers[name] = header;
  }
  return headers;
}

/** One request, to the checked address, within time and size. */
function send(
  request: ProxyRequest,
  address: { address: string; family: number },
  headers: Record<string, string>,
): Promise<
  | {
      status: number;
      headers: Record<string, string | string[] | undefined>;
      body: Buffer;
    }
  | "timeout"
  | "upstream_failed"
> {
  return new Promise((resolve) => {
    const req = https.request(
      request.url,
      {
        method: request.method,
        headers: {
          ...headers,
          "user-agent": "Barynt-plugin-proxy",
          ...(request.body !== null && {
            "content-length": String(Buffer.byteLength(request.body)),
          }),
        },
        // Exactly the address that was checked, whatever DNS says now.
        lookup: (_host, options, callback) => {
          if ((options as { all?: boolean })?.all)
            (callback as (e: null, a: unknown[]) => void)(null, [address]);
          else
            (callback as (e: null, a: string, f: number) => void)(
              null,
              address.address,
              address.family,
            );
        },
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > PROXY_MAX_RESPONSE_BYTES) {
            res.destroy();
            resolve("upstream_failed");
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
        res.on("error", () => resolve("upstream_failed"));
      },
    );
    req.on("error", (error) =>
      resolve(error.name === "AbortError" ? "timeout" : "upstream_failed"),
    );
    if (request.body !== null) req.write(request.body);
    req.end();
  });
}

/**
 * `net.fetch`: the plugin's request to one of its hosts, sent by Barynt.
 * The answer carries `status`, the allowed `headers`, and the body as
 * `text` — or as `base64` when it isn't text.
 */
export async function proxyFetch(
  userId: string,
  plugin: RunningPlugin,
  params: unknown,
): Promise<BridgeResponse> {
  const internalHosts = pluginInternalHosts();
  const request = parseProxyRequest(
    params,
    plugin.manifest.network,
    internalHosts,
  );
  if (typeof request === "string") return no(request);

  const credentials = await credentialsFor(
    userId,
    plugin,
    request.url.hostname.toLowerCase(),
  );
  if ("missing" in credentials) return no("credential_missing");

  const address = await checkedAddress(
    request.url.hostname,
    internalHosts.includes(request.url.host.toLowerCase()),
  );
  if (!address) return no("host_not_allowed");

  const res = await send(request, address, {
    ...request.headers,
    ...credentials,
  });
  if (typeof res === "string") return no(res);
  const headers = pickResponseHeaders(res.headers);
  const text = isTextType(headers["content-type"] ?? "");
  return {
    ok: true,
    result: {
      status: res.status,
      headers,
      ...(text
        ? { text: res.body.toString("utf8") }
        : { base64: res.body.toString("base64") }),
    },
  };
}
