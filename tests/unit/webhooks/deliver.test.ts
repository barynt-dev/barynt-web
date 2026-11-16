import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createHmac } from "node:crypto";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `EventDelivery` as a small table in memory, so the real flow runs:
// queue, attempt, schedule, give up. The network is `pinnedPost`.

type Row = Record<string, unknown> & { id: string };
let deliveries: Row[] = [];
let hook: Row;
/** Switched-on plugins and their active versions' manifests (BARY-212). */
let activations: Row[] = [];
let pluginRows: { pluginId: string; manifest: unknown }[] = [];
let projectVisibility = "public";

const mockWebhookFindMany = mock();
const mockWebhookCount = mock();
const mockWebhookUpdate = mock(
  async ({ data }: { data: Record<string, unknown> }) => {
    Object.assign(hook, data);
    return hook;
  },
);
const mockWebhookUpdateMany = mock(
  async ({
    where,
    data,
  }: {
    where: { enabled?: boolean };
    data: Record<string, unknown>;
  }) => {
    if (where.enabled !== undefined && hook.enabled !== where.enabled)
      return { count: 0 };
    Object.assign(hook, data);
    return { count: 1 };
  },
);
const mockUserFindUnique = mock();
const mockPinnedPost = mock();
const mockAuditCreate = mock(async () => ({}));

const find = (id: string) => deliveries.find((d) => d.id === id);

mock.module("@/lib/db", () => ({
  db: {
    webhook: {
      findMany: mockWebhookFindMany,
      count: mockWebhookCount,
      update: mockWebhookUpdate,
      updateMany: mockWebhookUpdateMany,
      findUnique: async () => hook,
      findFirst: async () => hook,
    },
    eventDelivery: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `d-${deliveries.length + 1}`,
          status: "PENDING",
          attempts: 0,
          ...data,
        };
        deliveries.push(row);
        return { id: row.id };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = find(where.id);
        if (!row) return null;
        return { ...row, webhook: row.webhookId ? hook : null };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Object.assign(find(where.id) as Row, data),
      updateMany: async ({ where }: { where: { id: string } }) => {
        const row = find(where.id);
        const free =
          row?.status === "PENDING" &&
          (!row.lockedUntil || (row.lockedUntil as Date) < new Date());
        if (!row || !free) return { count: 0 };
        row.lockedUntil = new Date(Date.now() + 30_000);
        return { count: 1 };
      },
    },
    pluginActivation: {
      findMany: async () =>
        activations.filter((a) => a.enabled && !a.servicePausedAt),
      count: async () =>
        activations.filter((a) => a.enabled && !a.servicePausedAt).length,
      findUnique: async ({ where }: { where: { id: string } }) =>
        activations.find((a) => a.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) =>
        Object.assign(activations.find((a) => a.id === where.id) as Row, data),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; servicePausedAt?: null };
        data: Record<string, unknown>;
      }) => {
        const a = activations.find((x) => x.id === where.id);
        if (!a || a.servicePausedAt) return { count: 0 };
        Object.assign(a, data);
        return { count: 1 };
      },
    },
    plugin: { findMany: async () => pluginRows },
    project: {
      findUnique: async () => ({ visibility: projectVisibility }),
    },
    user: { findUnique: mockUserFindUnique },
    workspace: { findUnique: async () => ({ name: "Acme" }) },
    auditLog: { create: mockAuditCreate },
    mailTemplate: { findUnique: async () => null },
  },
}));

mock.module("@/lib/net/pinned-fetch", () => ({ pinnedPost: mockPinnedPost }));

import { sealSecret } from "@/lib/secret-box";
import {
  attemptDelivery,
  claimDelivery,
  deliverEvent,
  redeliver,
  sendLifecycle,
  signPayload,
} from "@/lib/webhooks/deliver";
import {
  buildEnvelope,
  dispatchEvent,
  hasEventListeners,
} from "@/lib/webhooks/emit";
import { DISABLE_AFTER_MS } from "@/lib/webhooks/retry";
import { runAsPlugin } from "@/lib/webhooks/source";

const ENVELOPE = {
  event: "issue.created" as const,
  workspaceId: "ws-1",
  projectId: null,
  via: null,
  data: { id: "i-1" },
};

function reset() {
  deliveries = [];
  activations = [];
  pluginRows = [];
  projectVisibility = "public";
  hook = {
    id: "wh-1",
    url: "https://example.com/hook",
    secret: "shh",
    enabled: true,
    failingSince: null,
    workspaceId: "ws-1",
    createdById: "u-1",
  };
  mockWebhookFindMany.mockReset();
  mockWebhookCount.mockReset();
  mockWebhookUpdate.mockClear();
  mockWebhookUpdateMany.mockClear();
  mockUserFindUnique.mockReset();
  mockPinnedPost.mockReset();
  mockAuditCreate.mockClear();
  mockWebhookFindMany.mockResolvedValue([{ id: "wh-1" }]);
  mockUserFindUnique.mockResolvedValue({
    id: "u-1",
    firstName: "Ada",
    lastName: "Rahman",
    email: "ada@acme.dev",
  });
  mockPinnedPost.mockResolvedValue({ status: 204, body: "", durationMs: 12 });
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

describe("deliverEvent() to webhooks (BARY-211)", () => {
  beforeEach(reset);

  it("does nothing when no webhook is subscribed to the event", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    await deliverEvent(ENVELOPE);
    expect(deliveries).toHaveLength(0);
    expect(mockPinnedPost).not.toHaveBeenCalled();
  });

  it("looks up only enabled webhooks subscribed to this event", async () => {
    mockWebhookFindMany.mockResolvedValue([]);
    await deliverEvent({ ...ENVELOPE, event: "comment.created" });
    expect(mockWebhookFindMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        enabled: true,
        events: { has: "comment.created" },
      },
      select: { id: true },
    });
  });

  it("queues the delivery, sends it signed at once and logs the answer", async () => {
    await deliverEvent(ENVELOPE);

    const [call] = mockPinnedPost.mock.calls[0] as [
      { url: string; body: string; headers: Record<string, string> },
    ];
    expect(call.url).toBe("https://example.com/hook");
    expect(JSON.parse(call.body)).toEqual(ENVELOPE);
    const h = call.headers;
    expect(h["x-barynt-signature"]).toBe(
      createHmac("sha256", "shh")
        .update(`${h["x-barynt-timestamp"]}.${call.body}`)
        .digest("hex"),
    );
    expect(h["x-barynt-event"]).toBe("issue.created");
    expect(h["x-barynt-delivery"]).toBe("d-1");
    expect(h["x-barynt-attempt"]).toBe("1");

    expect(deliveries[0]).toMatchObject({
      status: "SUCCEEDED",
      attempts: 1,
      nextAttemptAt: null,
      lockedUntil: null,
      lastStatus: 204,
      lastError: null,
      lastDurationMs: 12,
    });
    expect(hook).toMatchObject({
      lastDeliveryStatus: 204,
      lastDeliveryError: null,
      failingSince: null,
    });
  });

  it("schedules a retry after a server error and keeps the webhook on", async () => {
    mockPinnedPost.mockResolvedValue({
      status: 503,
      body: "down for maintenance",
      durationMs: 40,
    });
    const before = Date.now();
    await deliverEvent(ENVELOPE);

    const row = deliveries[0];
    expect(row.status).toBe("PENDING");
    expect(row.attempts).toBe(1);
    expect(row.lastResponse).toBe("down for maintenance");
    const due = (row.nextAttemptAt as Date).getTime() - before;
    expect(due).toBeGreaterThanOrEqual(60_000);
    expect(due).toBeLessThan(65_000);
    expect(hook.failingSince).toBeInstanceOf(Date);
    expect(hook.enabled).toBe(true);
  });

  it("gives up at once on a 4xx and on a blocked address", async () => {
    mockPinnedPost.mockResolvedValue({ status: 404, body: "", durationMs: 5 });
    await deliverEvent(ENVELOPE);
    expect(deliveries[0]).toMatchObject({ status: "FAILED", attempts: 1 });

    mockPinnedPost.mockResolvedValue({
      error: "blocked",
      message: "The address is on a private network",
      durationMs: 1,
    });
    await deliverEvent(ENVELOPE);
    expect(deliveries[1]).toMatchObject({
      status: "FAILED",
      lastStatus: null,
      lastError: "The address is on a private network",
    });
    expect(hook.lastDeliveryError).toBe("The address is on a private network");
  });

  it("gives up after the sixth attempt", async () => {
    mockPinnedPost.mockResolvedValue({
      error: "timeout",
      message: "No answer within 10 s",
      durationMs: 10_000,
    });
    await deliverEvent(ENVELOPE);
    for (let i = 2; i <= 6; i++) {
      deliveries[0].lockedUntil = null;
      expect(await claimDelivery("d-1")).toBe(true);
      await attemptDelivery("d-1");
    }
    expect(deliveries[0]).toMatchObject({
      status: "FAILED",
      attempts: 6,
      nextAttemptAt: null,
    });
    // Nothing more to take.
    expect(await claimDelivery("d-1")).toBe(false);
  });

  it("leaves a held delivery to whoever holds it", async () => {
    mockPinnedPost.mockResolvedValue({ status: 500, body: "", durationMs: 3 });
    await deliverEvent(ENVELOPE);
    deliveries[0].lockedUntil = new Date(Date.now() + 10_000);
    expect(await claimDelivery("d-1")).toBe(false);
  });

  it("stops sending to a webhook that was turned off meanwhile", async () => {
    mockPinnedPost.mockResolvedValue({ status: 500, body: "", durationMs: 3 });
    await deliverEvent(ENVELOPE);
    hook.enabled = false;
    deliveries[0].lockedUntil = null;
    await claimDelivery("d-1");
    await attemptDelivery("d-1");
    expect(mockPinnedPost).toHaveBeenCalledTimes(1);
    expect(deliveries[0]).toMatchObject({
      status: "FAILED",
      lastError: "The webhook is turned off",
    });
  });

  it("turns the webhook off after a day of failures and logs it once", async () => {
    hook.failingSince = new Date(Date.now() - DISABLE_AFTER_MS - 1000);
    mockPinnedPost.mockResolvedValue({ status: 502, body: "", durationMs: 3 });

    await deliverEvent(ENVELOPE);
    expect(hook.enabled).toBe(false);
    expect(hook.autoDisabledAt).toBeInstanceOf(Date);
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const [{ data }] = mockAuditCreate.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({
      action: "webhook.disabled",
      actorId: null,
      targetType: "webhook",
      targetId: "wh-1",
    });

    // Only the process that actually flipped it tells anyone.
    expect(mockWebhookUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wh-1", enabled: true } }),
    );
  });

  it("starts the day of failures over after a success", async () => {
    hook.failingSince = new Date(Date.now() - 60 * 60_000);
    await deliverEvent(ENVELOPE);
    expect(hook.failingSince).toBeNull();
  });

  it("sends a delivery again on request, same body and id", async () => {
    mockPinnedPost.mockResolvedValue({ status: 410, body: "", durationMs: 3 });
    await deliverEvent(ENVELOPE);
    expect(deliveries[0].status).toBe("FAILED");

    mockPinnedPost.mockResolvedValue({
      status: 200,
      body: "ok",
      durationMs: 3,
    });
    await redeliver("d-1");
    expect(deliveries[0]).toMatchObject({ status: "SUCCEEDED", attempts: 2 });
    const [first, second] = mockPinnedPost.mock.calls.map(
      (c) => (c as [{ body: string; headers: Record<string, string> }])[0],
    );
    expect(second.body).toBe(first.body);
    expect(second.headers["x-barynt-delivery"]).toBe("d-1");
    expect(second.headers["x-barynt-attempt"]).toBe("2");
  });

  it("never throws, whatever the network does", async () => {
    mockPinnedPost.mockRejectedValue(new Error("boom"));
    await expect(deliverEvent(ENVELOPE)).resolves.toBeUndefined();
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
    await dispatchEvent(
      "member.added",
      { id: "u-2" },
      {
        workspaceId: "ws-1",
        actorId: "u-1",
      },
    );
    const [call] = mockPinnedPost.mock.calls[0] as [{ body: string }];
    expect(JSON.parse(call.body)).toMatchObject({
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

// ── Plugins' servers (BARY-212) ───────────────────────────────────────────────

const SERVICE_SECRET = "plugin-server-secret";

function servicePlugin(
  events: string[],
  capabilities: string[],
  extra: Partial<Row> = {},
) {
  process.env.AUTH_SECRET ||= "x".repeat(40);
  const manifest = {
    id: "ci-bridge",
    name: "CI Bridge",
    version: "1.0.0",
    minBaryntVersion: "0.1.0",
    author: "Acme",
    description: "Builds on status changes.",
    license: "MIT",
    kind: "service",
    levels: ["workspace", "project"],
    capabilities,
    network: ["ci.acme.dev"],
    service: { url: "https://ci.acme.dev/barynt", events },
  };
  pluginRows = [{ pluginId: "ci-bridge", manifest }];
  activations.push({
    id: "act-1",
    pluginId: "ci-bridge",
    workspaceId: "ws-1",
    projectId: null,
    enabled: true,
    capabilities,
    serviceSecret: sealSecret(SERVICE_SECRET, "plugin-service"),
    serviceFailingSince: null,
    servicePausedAt: null,
    ...extra,
  });
}

const ISSUE = {
  event: "issue.status_changed" as const,
  workspaceId: "ws-1",
  projectId: "p-1",
  via: null,
  data: {
    id: "i-1",
    ref: "WEB-1",
    title: "Secret plan",
    project: { id: "p-1" },
  },
  changes: { status: { from: "todo", to: "done" } },
};

const sent = () =>
  mockPinnedPost.mock.calls.map(
    (c) =>
      (
        c as [{ url: string; body: string; headers: Record<string, string> }]
      )[0],
  );

describe("deliverEvent() to plugins' servers (BARY-212)", () => {
  beforeEach(() => {
    reset();
    mockWebhookFindMany.mockResolvedValue([]);
  });

  it("sends what a plugin subscribed to, signed with its own secret", async () => {
    servicePlugin(["issue.status_changed"], ["events:issue", "issues:read"]);
    await deliverEvent(ISSUE);

    const [call] = sent();
    expect(call.url).toBe("https://ci.acme.dev/barynt");
    expect(JSON.parse(call.body)).toMatchObject({
      event: "issue.status_changed",
      data: { title: "Secret plan" },
      changes: { status: { to: "done" } },
    });
    const h = call.headers;
    expect(h["x-barynt-signature"]).toBe(
      createHmac("sha256", SERVICE_SECRET)
        .update(`${h["x-barynt-timestamp"]}.${call.body}`)
        .digest("hex"),
    );
    expect(deliveries[0]).toMatchObject({
      activationId: "act-1",
      status: "SUCCEEDED",
    });
  });

  it("leaves out what the plugin may not read", async () => {
    servicePlugin(["issue.status_changed"], ["events:issue"]);
    await deliverEvent(ISSUE);
    const body = JSON.parse(sent()[0].body);
    expect(body.data).toEqual({ id: "i-1", ref: "WEB-1", projectId: "p-1" });
    expect(body.changes).toBeUndefined();
  });

  it("sends nothing the plugin didn't subscribe to or confirm", async () => {
    servicePlugin(["issue.created"], ["events:issue", "issues:read"]);
    await deliverEvent(ISSUE);
    expect(mockPinnedPost).not.toHaveBeenCalled();

    reset();
    mockWebhookFindMany.mockResolvedValue([]);
    servicePlugin(["issue.status_changed"], ["issues:read"]);
    await deliverEvent(ISSUE);
    expect(mockPinnedPost).not.toHaveBeenCalled();
  });

  it("keeps a project's plugin to its project and a workspace's out of private ones", async () => {
    servicePlugin(["issue.status_changed"], ["events:issue"], {
      projectId: "p-2",
    });
    await deliverEvent(ISSUE);
    expect(mockPinnedPost).not.toHaveBeenCalled();

    reset();
    mockWebhookFindMany.mockResolvedValue([]);
    servicePlugin(["issue.status_changed"], ["events:issue"]);
    projectVisibility = "private";
    await deliverEvent(ISSUE);
    expect(mockPinnedPost).not.toHaveBeenCalled();
  });

  it("doesn't tell a plugin about its own change", async () => {
    servicePlugin(["issue.status_changed"], ["events:issue"]);
    await deliverEvent({ ...ISSUE, via: { plugin: { id: "ci-bridge" } } });
    expect(mockPinnedPost).not.toHaveBeenCalled();
  });

  it("hands the secret over with app.installed", async () => {
    servicePlugin(["issue.created"], ["events:issue"]);
    await sendLifecycle("act-1", "app.installed");
    const body = JSON.parse(sent()[0].body);
    expect(body).toMatchObject({
      event: "app.installed",
      workspaceId: "ws-1",
      data: {
        installationId: "act-1",
        pluginId: "ci-bridge",
        secret: SERVICE_SECRET,
      },
    });

    // Switched off: the goodbye still goes out, without the secret.
    activations[0].enabled = false;
    await sendLifecycle("act-1", "app.uninstalled");
    const bye = JSON.parse(sent()[1].body);
    expect(bye.event).toBe("app.uninstalled");
    expect(bye.data.secret).toBeUndefined();
  });

  it("pauses a plugin's deliveries after a day of failures, once", async () => {
    servicePlugin(["issue.status_changed"], ["events:issue"], {
      serviceFailingSince: new Date(Date.now() - DISABLE_AFTER_MS - 1000),
    });
    mockPinnedPost.mockResolvedValue({ status: 500, body: "", durationMs: 2 });
    await deliverEvent(ISSUE);

    expect(activations[0].servicePausedAt).toBeInstanceOf(Date);
    expect(activations[0].enabled).toBe(true);
    const [{ data }] = mockAuditCreate.mock.calls[0] as unknown as [
      { data: Record<string, unknown> },
    ];
    expect(data).toMatchObject({
      action: "plugin.service.paused",
      targetId: "ci-bridge",
    });

    // Paused: a retry that comes due goes nowhere.
    deliveries[0].lockedUntil = null;
    await claimDelivery("d-1");
    await attemptDelivery("d-1");
    expect(mockPinnedPost).toHaveBeenCalledTimes(1);
    expect(deliveries[0]).toMatchObject({
      status: "FAILED",
      lastError: "Deliveries to the plugin are paused",
    });
  });
});
