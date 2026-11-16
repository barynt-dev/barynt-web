import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHmac } from "node:crypto";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWebhookFindMany = mock();
const mockWebhookUpdate = mock();
const mockWebhookCount = mock();
const mockUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    webhook: {
      findMany: mockWebhookFindMany,
      update: mockWebhookUpdate,
      count: mockWebhookCount,
    },
    user: { findUnique: mockUserFindUnique },
  },
}));

import { deliverWebhookEvent, signPayload } from "@/lib/webhooks/deliver";
import {
  buildEnvelope,
  dispatchEvent,
  hasEventListeners,
} from "@/lib/webhooks/emit";
import { runAsPlugin } from "@/lib/webhooks/source";

const HOOK = { id: "wh-1", url: "https://example.com/hook", secret: "shh" };
const ENVELOPE = { event: "issue.created", data: { id: "i-1" } };

function reset() {
  mockWebhookFindMany.mockReset();
  mockWebhookUpdate.mockReset();
  mockWebhookCount.mockReset();
  mockUserFindUnique.mockReset();
  mockWebhookFindMany.mockResolvedValue([HOOK]);
  mockWebhookUpdate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({
    id: "u-1",
    firstName: "Ada",
    lastName: "Rahman",
  });
}

describe("signPayload()", () => {
  it("matches a manually computed HMAC-SHA256 over timestamp.payload", () => {
    const sig = signPayload("shh", "1000", '{"a":1}');
    const expected = createHmac("sha256", "shh")
      .update('1000.{"a":1}')
      .digest("hex");
    expect(sig).toBe(expected);
  });

  it("has no sha256= prefix — bare hex, unlike GitHub's convention", () => {
    const sig = signPayload("shh", "1000", "{}");
    expect(sig).not.toContain("sha256=");
    expect(/^[0-9a-f]+$/.test(sig)).toBe(true);
  });
});

describe("deliverWebhookEvent()", () => {
  beforeEach(reset);

  it("does nothing when no webhook is subscribed to the event", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;

    await deliverWebhookEvent("ws-1", "issue.created", ENVELOPE);

    global.fetch = originalFetch;
    expect(mockWebhookUpdate).not.toHaveBeenCalled();
  });

  it("looks up only enabled webhooks subscribed to this event", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    await deliverWebhookEvent("ws-1", "comment.created", ENVELOPE);
    expect(mockWebhookFindMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        enabled: true,
        events: { has: "comment.created" },
      },
      select: { id: true, url: true, secret: true },
    });
  });

  it("POSTs a signed payload and records the status on success", async () => {
    const originalFetch = global.fetch;
    const fetchMock = mock(async (url: string, init: RequestInit) => {
      expect(url).toBe(HOOK.url);
      const body = init.body as string;
      const headers = init.headers as Record<string, string>;
      const timestamp = headers["x-barynt-timestamp"];
      const expectedSig = createHmac("sha256", HOOK.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      expect(headers["x-barynt-signature"]).toBe(expectedSig);
      expect(headers["x-barynt-event"]).toBe("issue.created");
      const parsed = JSON.parse(body);
      expect(parsed.event).toBe("issue.created");
      expect(parsed.data).toEqual({ id: "i-1" });
      return new Response(null, { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await deliverWebhookEvent("ws-1", "issue.created", ENVELOPE);

    global.fetch = originalFetch;
    expect(mockWebhookUpdate).toHaveBeenCalledWith({
      where: { id: "wh-1" },
      data: {
        lastDeliveryAt: expect.any(Date),
        lastDeliveryStatus: 200,
        lastDeliveryError: null,
      },
    });
  });

  it("records the error and never throws when the request fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = mock(() => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    await expect(
      deliverWebhookEvent("ws-1", "issue.created", ENVELOPE),
    ).resolves.toBeUndefined();

    global.fetch = originalFetch;
    expect(mockWebhookUpdate).toHaveBeenCalledWith({
      where: { id: "wh-1" },
      data: {
        lastDeliveryAt: expect.any(Date),
        lastDeliveryStatus: null,
        lastDeliveryError: "ECONNREFUSED",
      },
    });
  });
});

describe("the envelope (BARY-210)", () => {
  beforeEach(reset);

  it("says where, who and what, and carries changes only when given", async () => {
    const env = await buildEnvelope(
      "issue.updated",
      { id: "i-1" },
      { workspaceId: "ws-1", projectId: "p-1", actorId: "u-1" },
      { changes: { title: { from: "a", to: "b" } } },
    );
    expect(env).toMatchObject({
      event: "issue.updated",
      workspaceId: "ws-1",
      projectId: "p-1",
      actor: { id: "u-1", name: "Ada Rahman" },
      via: null,
      data: { id: "i-1" },
      changes: { title: { from: "a", to: "b" } },
    });
    expect(typeof env.timestamp).toBe("number");

    const plain = await buildEnvelope(
      "label.created",
      {},
      { workspaceId: "w" },
    );
    expect(plain.projectId).toBeNull();
    expect(plain.actor).toBeNull();
    expect("changes" in plain).toBe(false);
    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
  });

  it("names the plugin a change came through", async () => {
    const env = await runAsPlugin({ id: "gitlab", name: "GitLab" }, () =>
      buildEnvelope("comment.created", {}, { workspaceId: "ws-1" }),
    );
    expect(env.via).toEqual({ plugin: { id: "gitlab", name: "GitLab" } });
    // Outside the plugin's request, nothing is left behind.
    const after = await buildEnvelope(
      "comment.created",
      {},
      {
        workspaceId: "ws-1",
      },
    );
    expect(after.via).toBeNull();
  });

  it("delivers the envelope as the body", async () => {
    const originalFetch = global.fetch;
    let body: Record<string, unknown> = {};
    global.fetch = mock(async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    await dispatchEvent(
      "member.added",
      { id: "u-2" },
      {
        workspaceId: "ws-1",
        actorId: "u-1",
      },
    );

    global.fetch = originalFetch;
    expect(body).toMatchObject({
      event: "member.added",
      workspaceId: "ws-1",
      projectId: null,
      actor: { id: "u-1", name: "Ada Rahman" },
      data: { id: "u-2" },
    });
  });

  it("only counts enabled webhooks as listeners", async () => {
    mockWebhookCount.mockResolvedValue(0);
    expect(await hasEventListeners("ws-1")).toBe(false);
    expect(mockWebhookCount).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", enabled: true },
    });
    mockWebhookCount.mockResolvedValue(2);
    expect(await hasEventListeners("ws-1")).toBe(true);
  });
});
