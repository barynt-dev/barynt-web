import "server-only";
import { createHmac } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendWebhookDisabledEmail } from "@/lib/mail";
import { pinnedPost } from "@/lib/net/pinned-fetch";
import type { LifecycleEvent } from "@/lib/plugins/service";
import type { WebhookEvent } from "@/lib/webhooks/events";
import {
  type AttemptOutcome,
  DELIVERY_TIMEOUT_MS,
  LOG_RETENTION_MS,
  nextAttemptAt,
  RESPONSE_KEEP_BYTES,
  shouldDisable,
  succeeded,
  webhookInternalHosts,
} from "@/lib/webhooks/retry";
import {
  lifecyclePayload,
  pluginTarget,
  pluginTargetsFor,
  recordOnActivation,
} from "./plugin-targets";

// Delivering events to webhooks (BARY-211) and plugins' servers (BARY-212). Every delivery is a row in
// `EventDelivery` first — the queue and the log in one — and then tried at
// once. One that fails is tried again by the worker (`./worker.ts`) on the
// schedule in `./retry.ts`; a webhook that has failed for a day is turned
// off and its creator told. Each attempt goes through `pinnedPost`: no
// private addresses, no redirects. Nothing here throws.

/** How long one attempt holds its row. */
const LOCK_MS = DELIVERY_TIMEOUT_MS + 20_000;

/**
 * Queues an event's envelope (`lib/webhooks/emit.ts`) for every enabled
 * webhook of the workspace subscribed to it and every switched-on plugin's
 * server that hears about it (BARY-212), and tries each at once.
 */
export async function deliverEvent(envelope: {
  event: WebhookEvent;
  workspaceId: string;
  projectId: string | null;
  via: { plugin: { id: string } } | null;
  data: unknown;
}): Promise<void> {
  const { event, workspaceId } = envelope;
  const [hooks, plugins] = await Promise.all([
    db.webhook.findMany({
      where: { workspaceId, enabled: true, events: { has: event } },
      select: { id: true },
    }),
    pluginTargetsFor(envelope),
  ]);
  if (hooks.length === 0 && plugins.length === 0) return;

  const payload = JSON.stringify(envelope);
  const ids = await Promise.all([
    ...hooks.map((hook) =>
      queue({ workspaceId, event, payload, webhookId: hook.id }),
    ),
    ...plugins.map((target) =>
      queue({
        workspaceId,
        event,
        payload: target.payload,
        activationId: target.activationId,
      }),
    ),
  ]);
  await Promise.all(ids.map(attemptDelivery));
}

/** One row, held for the attempt that follows right away. */
async function queue(data: {
  workspaceId: string;
  event: string;
  payload: string;
  webhookId?: string;
  activationId?: string;
}): Promise<string> {
  const now = new Date();
  const row = await db.eventDelivery.create({
    data: {
      ...data,
      nextAttemptAt: now,
      // Held for the attempt below, so the worker leaves it alone.
      lockedUntil: new Date(now.getTime() + LOCK_MS),
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Tells a plugin's server it was switched on (with the secret every later
 * message is signed with) or off (BARY-212). Queued and retried like any
 * delivery. Never throws.
 */
export async function sendLifecycle(
  activationId: string,
  event: LifecycleEvent,
): Promise<void> {
  try {
    const message = await lifecyclePayload(activationId, event);
    if (!message) return;
    const id = await queue({
      workspaceId: message.workspaceId,
      event,
      payload: message.stored,
      activationId,
    });
    await attemptDelivery(id);
  } catch (error) {
    console.error("[webhooks] lifecycle message failed:", error);
  }
}

/** Hex, no `sha256=` prefix — same convention as Linear's `Linear-Signature`
 *  header, over `<timestamp>.<body>` rather than the body alone, so a
 *  captured signature can't be replayed against a different payload sent
 *  at a different time. */
export function signPayload(
  secret: string,
  timestamp: string,
  payload: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

/** Takes a pending delivery for one attempt — `false` when it isn't
 *  pending or another process has it. */
export async function claimDelivery(id: string, now = new Date()) {
  const { count } = await db.eventDelivery.updateMany({
    where: {
      id,
      status: "PENDING",
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  return count === 1;
}

/** Due deliveries, taken for an attempt: rows no other process holds
 *  (`SKIP LOCKED`), each locked for the attempt. */
export async function claimDueDeliveries(limit = 20): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "EventDelivery" SET "lockedUntil" = now() + make_interval(secs => ${LOCK_MS / 1000})
    WHERE id IN (
      SELECT id FROM "EventDelivery"
      WHERE status = 'PENDING'
        AND "nextAttemptAt" <= now()
        AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
      ORDER BY "nextAttemptAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`;
  return rows.map((r) => r.id);
}

/**
 * One attempt of a delivery its caller holds (`deliverEvent`,
 * `claimDelivery`, `claimDueDeliveries`). Records the outcome on the row
 * and on the webhook. Never throws.
 */
export async function attemptDelivery(id: string): Promise<void> {
  try {
    const row = await db.eventDelivery.findUnique({
      where: { id },
      select: {
        event: true,
        payload: true,
        attempts: true,
        status: true,
        activationId: true,
        webhook: {
          select: {
            id: true,
            url: true,
            secret: true,
            enabled: true,
            failingSince: true,
          },
        },
      },
    });
    if (!row || row.status !== "PENDING") return;

    const target = row.webhook
      ? row.webhook.enabled
        ? {
            url: row.webhook.url,
            secret: row.webhook.secret,
            internalHosts: webhookInternalHosts(),
          }
        : { closed: "The webhook is turned off" }
      : row.activationId
        ? await pluginTarget(row.activationId, row.event)
        : { closed: "The delivery has no target" };

    // Nowhere to send it any more: nothing more goes out.
    if ("closed" in target) {
      await db.eventDelivery.update({
        where: { id },
        data: {
          status: "FAILED",
          nextAttemptAt: null,
          lockedUntil: null,
          lastError: target.closed,
        },
      });
      return;
    }

    // `app.installed` is kept without its secret; the body that goes out
    // is made again with it, for each attempt (BARY-212).
    const body =
      row.event === "app.installed" && row.activationId
        ? (await lifecyclePayload(row.activationId, "app.installed"))?.sent
        : row.payload;
    if (!body) return;

    const timestamp = Date.now().toString();
    const attempt = row.attempts + 1;
    const result = await pinnedPost({
      url: target.url,
      headers: {
        "content-type": "application/json",
        "user-agent": "Barynt-Webhooks",
        "x-barynt-event": row.event,
        "x-barynt-delivery": id,
        "x-barynt-attempt": String(attempt),
        "x-barynt-signature": signPayload(target.secret, timestamp, body),
        "x-barynt-timestamp": timestamp,
      },
      body,
      timeoutMs: DELIVERY_TIMEOUT_MS,
      keepBytes: RESPONSE_KEEP_BYTES,
      internalHosts: target.internalHosts,
    });

    const now = new Date();
    const outcome: AttemptOutcome =
      "status" in result
        ? { status: result.status }
        : { error: result.error, message: result.message };
    const ok = succeeded(outcome);
    const next = ok ? null : nextAttemptAt(attempt, outcome, now);

    await db.eventDelivery.update({
      where: { id },
      data: {
        attempts: attempt,
        status: ok ? "SUCCEEDED" : next ? "PENDING" : "FAILED",
        nextAttemptAt: next,
        lockedUntil: null,
        lastStatus: "status" in result ? result.status : null,
        lastError: "error" in result ? result.message : null,
        lastResponse: "status" in result ? result.body || null : null,
        lastDurationMs: result.durationMs,
      },
    });
    if (row.webhook) await recordOnWebhook(row.webhook, outcome, now);
    else if (row.activationId && "failingSince" in target)
      await recordOnActivation(
        row.activationId,
        target.failingSince,
        outcome,
        now,
      );
  } catch (error) {
    console.error("[webhooks] delivery failed:", error);
  }
}

/** The webhook's last result, and whether it has failed long enough to be
 *  turned off. */
async function recordOnWebhook(
  hook: { id: string; failingSince: Date | null },
  outcome: AttemptOutcome,
  now: Date,
) {
  const ok = succeeded(outcome);
  const failingSince = ok ? null : (hook.failingSince ?? now);
  await db.webhook.update({
    where: { id: hook.id },
    data: {
      lastDeliveryAt: now,
      lastDeliveryStatus: "status" in outcome ? outcome.status : null,
      lastDeliveryError: "error" in outcome ? outcome.message : null,
      failingSince,
    },
  });
  if (ok || !shouldDisable(failingSince, now)) return;

  // Only one process turns it off and tells anyone.
  const { count } = await db.webhook.updateMany({
    where: { id: hook.id, enabled: true },
    data: { enabled: false, autoDisabledAt: now },
  });
  if (count === 0) return;
  const off = await db.webhook.findUnique({
    where: { id: hook.id },
    select: { url: true, workspaceId: true, createdById: true },
  });
  if (!off) return;
  await recordAudit({
    action: "webhook.disabled",
    actorId: null,
    actorLabel: "Barynt",
    target: { type: "webhook", id: hook.id, label: off.url },
    workspaceId: off.workspaceId,
  });
  await sendWebhookDisabledEmail({
    userId: off.createdById,
    workspaceId: off.workspaceId,
    url: off.url,
    failingSince: failingSince ?? now,
  });
}

/** Sends a delivery once more, now — from the log's "Send again". */
export async function redeliver(id: string): Promise<void> {
  await db.eventDelivery.update({
    where: { id },
    data: { status: "PENDING", nextAttemptAt: new Date(), lockedUntil: null },
  });
  if (await claimDelivery(id)) await attemptDelivery(id);
}

/** Deletes what's older than the log keeps. */
export async function pruneDeliveries(now = new Date()): Promise<number> {
  const { count } = await db.eventDelivery.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - LOG_RETENTION_MS) } },
  });
  return count;
}
