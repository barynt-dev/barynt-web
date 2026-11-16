import "server-only";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isPrivateAddress } from "@/lib/public-fetch";

// A POST to an address someone typed in, sent from this server (BARY-211):
// webhooks. The host is resolved once, every address must be public (unless
// an admin let the host through), and the request goes to exactly the
// address that was checked — a DNS answer that changes in between
// (rebinding) can't send it into the network. Redirects aren't followed.
// The same idea as the plugins' host proxy (`features/plugins/proxy.ts`),
// for http too and with any port.

export type PinnedResult =
  | { status: number; body: string; durationMs: number }
  | {
      error: "blocked" | "timeout" | "failed";
      message: string;
      durationMs: number;
    };

export interface PinnedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
  /** How much of the answer to read; the rest is dropped. */
  keepBytes: number;
  /** `host` or `host:port` an admin let through although private. */
  internalHosts?: readonly string[];
}

type Address = { address: string; family: number };

/** The address to connect to — `null` (with the reason) when it may not be
 *  reached. */
async function checkedAddress(
  url: URL,
  internalHosts: readonly string[],
): Promise<Address | string> {
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return "Only http and https addresses";
  if (url.username || url.password) return "No credentials in the address";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const internal =
    internalHosts.includes(url.host.toLowerCase()) ||
    internalHosts.includes(host.toLowerCase());
  try {
    const all = await lookup(host, { all: true });
    if (all.length === 0) return "The host has no address";
    if (!internal && all.some((a) => isPrivateAddress(a.address)))
      return "The address is on a private network";
    return all[0];
  } catch {
    return "The host could not be resolved";
  }
}

export async function pinnedPost(
  request: PinnedRequest,
): Promise<PinnedResult> {
  const started = Date.now();
  const took = () => Date.now() - started;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { error: "blocked", message: "Not a valid address", durationMs: 0 };
  }
  const address = await checkedAddress(url, request.internalHosts ?? []);
  if (typeof address === "string")
    return { error: "blocked", message: address, durationMs: took() };

  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = client.request(
      url,
      {
        method: "POST",
        headers: {
          ...request.headers,
          "content-length": String(Buffer.byteLength(request.body)),
        },
        // Exactly the address that was checked, whatever DNS says now.
        lookup: (_host, options, callback) => {
          if ((options as { all?: boolean })?.all)
            (callback as (e: null, a: Address[]) => void)(null, [address]);
          else
            (callback as (e: null, a: string, f: number) => void)(
              null,
              address.address,
              address.family,
            );
        },
        signal: AbortSignal.timeout(request.timeoutMs),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          if (size < request.keepBytes) chunks.push(chunk);
          size += chunk.length;
        });
        const done = () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks)
              .subarray(0, request.keepBytes)
              .toString("utf8"),
            durationMs: took(),
          });
        res.on("end", done);
        res.on("error", done);
      },
    );
    req.on("error", (error) =>
      resolve(
        error.name === "AbortError" || error.name === "TimeoutError"
          ? {
              error: "timeout",
              message: `No answer within ${request.timeoutMs / 1000} s`,
              durationMs: took(),
            }
          : { error: "failed", message: error.message, durationMs: took() },
      ),
    );
    req.end(request.body);
  });
}
