import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHmac } from "node:crypto";

// A webhook another service sends a plugin (BARY-215): what Barynt accepts,
// refuses, and hands on. The queue, Redis and the rate limit are mocked —
// this process is its own (scripts/run-tests.ts).

process.env.AUTH_SECRET ||= "x".repeat(40);
const { sealSecret } = await import("@/lib/secret-box");

const SECRET = "hook-secret";
let hookRow: Record<string, unknown> | null;
let manifest: Record<string, unknown>;
const update = mock(async () => ({}));
const sendToPlugin = mock(async () => {});
const redisSet = mock(async () => "OK");
const countRequest = mock(async () => ({ ok: true, info: {} }));

mock.module("@/lib/db", () => ({
  db: {
    pluginInboundHook: {
      findUnique: async () => hookRow,
      update,
    },
    plugin: { findFirst: async () => ({ manifest }) },
  },
}));
mock.module("@/lib/webhooks/deliver", () => ({ sendToPlugin }));
mock.module("@/lib/redis", () => ({ redisClient: { set: redisSet } }));
mock.module("@/lib/api/rateLimit", () => ({ countRequest }));
// Its own tests are in tests/unit/pluginIssueData — another process.
const handleLink = mock(async () => {});
mock.module("@/features/plugins/link", () => ({ handleLink }));

const { receiveInbound } = await import("@/features/plugins/inbound");

function setup(provider: "gitlab" | "github", handle = "forward") {
  hookRow = {
    id: "h-1",
    hookId: "repo",
    secret: sealSecret(SECRET, "plugin-inbound-hook"),
    activation: {
      id: "act-1",
      pluginId: "ci-bridge",
      enabled: true,
      workspaceId: "ws-1",
      projectId: null,
    },
  };
  manifest = {
    id: "ci-bridge",
    name: "CI Bridge",
    version: "1.0.0",
    minBaryntVersion: "0.1.0",
    author: "Acme",
    description: "x",
    license: "MIT",
    kind: "service",
    levels: ["workspace"],
    capabilities: ["webhooks:receive", "events:issue"],
    network: ["ci.acme.dev"],
    service: { url: "https://ci.acme.dev/hook", events: ["issue.created"] },
    contributes: {
      inboundHooks: [{ id: "repo", title: "Repo", provider, handle }],
    },
  };
}

const body = JSON.stringify({ object_kind: "merge_request", iid: 412 });

function gitlab(token = SECRET, extra: Record<string, string> = {}) {
  return new Request("https://barynt.acme.dev/api/plugins/hooks/tok", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gitlab-event": "Merge Request Hook",
      "x-gitlab-token": token,
      "x-gitlab-event-uuid": "uuid-1",
      ...extra,
    },
    body,
  });
}

beforeEach(() => {
  update.mockClear();
  sendToPlugin.mockClear();
  handleLink.mockClear();
  redisSet.mockClear();
  redisSet.mockResolvedValue("OK");
  countRequest.mockResolvedValue({ ok: true, info: {} });
  setup("gitlab");
});

describe("receiveInbound()", () => {
  it("doesn't know an address it never gave out", async () => {
    hookRow = null;
    expect((await receiveInbound("nope", gitlab())).status).toBe(404);
  });

  it("is gone while the plugin is off or its version has no such hook", async () => {
    (hookRow?.activation as { enabled: boolean }).enabled = false;
    expect((await receiveInbound("tok", gitlab())).status).toBe(410);
    setup("gitlab");
    manifest.contributes = {};
    manifest.capabilities = ["events:issue"];
    expect((await receiveInbound("tok", gitlab())).status).toBe(410);
  });

  it("refuses a call without the secret, and says so in the settings", async () => {
    const res = await receiveInbound("tok", gitlab("guessed"));
    expect(res.status).toBe(401);
    expect(sendToPlugin).not.toHaveBeenCalled();
    expect((update.mock.calls as unknown[][])[0]?.[0]).toMatchObject({
      data: { lastStatus: 401, lastEvent: "merge_request" },
    });
  });

  it("checks GitHub's signature over the body", async () => {
    setup("github");
    const signed = (secret: string) =>
      new Request("https://barynt.acme.dev/api/plugins/hooks/tok", {
        method: "POST",
        headers: {
          "x-github-event": "pull_request",
          "x-github-delivery": "d-1",
          "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
        },
        body,
      });
    expect((await receiveInbound("tok", signed("wrong"))).status).toBe(401);
    expect((await receiveInbound("tok", signed(SECRET))).status).toBe(202);
  });

  it("files a link hook's call itself, without a server (BARY-226)", async () => {
    setup("github", "link");
    const signed = new Request(
      "https://barynt.acme.dev/api/plugins/hooks/tok",
      {
        method: "POST",
        headers: {
          "x-github-event": "pull_request",
          "x-github-delivery": "d-2",
          "x-hub-signature-256": `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`,
        },
        body,
      },
    );
    expect((await receiveInbound("tok", signed)).status).toBe(202);
    expect(sendToPlugin).not.toHaveBeenCalled();
    expect(handleLink.mock.calls[0]).toEqual([
      expect.objectContaining({ id: "act-1", pluginId: "ci-bridge" }),
      { id: "ci-bridge", name: "CI Bridge" },
      expect.objectContaining({ provider: "github", handle: "link" }),
      undefined,
      "pull_request",
      JSON.parse(body),
    ] as never);
  });

  it("refuses what's too large before reading it, and too many calls", async () => {
    const big = gitlab(SECRET, { "content-length": String(2 * 1024 * 1024) });
    expect((await receiveInbound("tok", big)).status).toBe(413);
    countRequest.mockResolvedValue({ ok: false, info: {} });
    expect((await receiveInbound("tok", gitlab())).status).toBe(429);
  });

  it("forwards to the plugin's server — without the provider's secret", async () => {
    const res = await receiveInbound("tok", gitlab());
    expect(res.status).toBe(202);
    const [activationId, message] = sendToPlugin.mock.calls[0] as unknown as [
      string,
      { event: string; payload: string },
    ];
    expect(activationId).toBe("act-1");
    expect(message.event).toBe("inbound.repo");
    const payload = JSON.parse(message.payload);
    expect(payload.data).toMatchObject({
      hook: "repo",
      provider: "gitlab",
      providerEvent: "merge_request",
      deliveryId: "uuid-1",
      body: { object_kind: "merge_request", iid: 412 },
    });
    expect(JSON.stringify(payload)).not.toContain(SECRET);
  });

  it("takes a provider's retry once", async () => {
    redisSet.mockResolvedValue(null as unknown as string);
    const res = await receiveInbound("tok", gitlab());
    expect(res.status).toBe(200);
    expect(sendToPlugin).not.toHaveBeenCalled();
  });

  it("refuses what isn't JSON", async () => {
    const res = await receiveInbound(
      "tok",
      new Request("https://x/api/plugins/hooks/tok", {
        method: "POST",
        headers: { "x-gitlab-token": SECRET },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });
});
