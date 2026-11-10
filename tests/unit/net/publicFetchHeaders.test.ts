import { afterAll, describe, expect, it, mock } from "bun:test";

// Every host resolves to a public address — no network needed.
mock.module("node:dns/promises", () => ({
  lookup: async () => [{ address: "140.82.121.6", family: 4 }],
}));

const { fetchPublic } = await import("@/lib/public-fetch");

const realFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

/** Answers each URL from `routes`, noting the headers every request had. */
function serve(routes: Record<string, () => Response>) {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    seen.push({
      url,
      headers: { ...(init?.headers as Record<string, string>) },
    });
    const route = routes[url];
    return route ? route() : new Response("missing", { status: 404 });
  }) as typeof fetch;
  return seen;
}

const options = {
  accept: "*/*",
  maxBytes: 1024,
  types: /^application\/octet-stream$/,
  protocols: ["https:" as const],
  headers: { authorization: "Bearer secret" },
};

describe("fetchPublic headers (BARY-141)", () => {
  it("sends the token to the first host, not after a redirect elsewhere", async () => {
    const seen = serve({
      "https://api.github.com/asset": () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://objects.githubusercontent.com/signed" },
        }),
      "https://objects.githubusercontent.com/signed": () =>
        new Response("data", {
          headers: { "content-type": "application/octet-stream" },
        }),
    });
    const res = await fetchPublic(
      new URL("https://api.github.com/asset"),
      options,
    );
    expect(new TextDecoder().decode(res?.body)).toBe("data");
    expect(seen[0].headers.authorization).toBe("Bearer secret");
    expect(seen[1].headers.authorization).toBeUndefined();
  });

  it("keeps it on a redirect within the same host", async () => {
    const seen = serve({
      "https://api.github.com/a": () =>
        new Response(null, {
          status: 301,
          headers: { location: "/b" },
        }),
      "https://api.github.com/b": () =>
        new Response("ok", {
          headers: { "content-type": "application/octet-stream" },
        }),
    });
    await fetchPublic(new URL("https://api.github.com/a"), options);
    expect(seen.map((s) => s.headers.authorization)).toEqual([
      "Bearer secret",
      "Bearer secret",
    ]);
  });
});
