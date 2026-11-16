import "server-only";
import { createHmac } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendWebhookDisabledEmail } from "@/lib/mail";
import { pinnedPost } from "@/lib/net/pinned-fetch";
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

// Delivering events to webhooks (BARY-211). Every delivery is a row in
// `EventDelivery` first — the queue and the log in one — and then tried at
// once. One that fails is tried again by the worker (`./worker.ts`) on the
// schedule in `./retry.ts`; a webhook that has failed for a day is turned
// off and its creator told. Each attempt goes through `pinnedPost`: no
// private addresses, no redirects. Nothing here throws.

/** How long one attempt holds its row. */
const LOCK_MS = DELIVERY_TIMEOUT_MS + 20_000;

/**
 * Queues an event's envelope (`lib/webhooks/emit.ts`) for every enabled
 * webhook of a workspace that's subscribed to it, and tries each at once.
 */
export async function deliverWebhookEvent(
  workspaceId: string,
  event: WebhookEvent,
  envelope: object,
): Promise<void> {
  const hooks = await db.webhook.findMany({
    where: { workspaceId, enabled: true, events: { has: event } },
    select: { id: true },
  });
  if (hooks.length === 0) return;

  const payload = JSON.stringify(envelope);
  const now = new Date();
  const rows = await Promise.all(
    hooks.map((hook) =>
      db.eventDelivery.create({
        data: {
          workspaceId,
          webhookId: hook.id,
          event,
          payload,
          nextAttemptAt: now,
          // Held for the attempt below, so the worker leaves it alone.
          lockedUntil: new Date(now.getTime() + LOCK_MS),
        },
        select: { id: true },
      }),
    ),
  );
  await Promise.all(rows.map((row) => attemptDelivery(row.id)));
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
 * One attempt of a delivery its caller holds (`deliverWebhookEvent`,
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
    const hook = row.webhook;

    // Turned off in the meantime: nothing more goes out.
    if (!hook.enabled) {
      await db.eventDelivery.update({
        where: { id },
        data: {
          status: "FAILED",
          nextAttemptAt: null,
          lockedUntil: null,
          lastError: "The webhook is turned off",
        },
      });
      return;
    }

    const timestamp = Date.now().toString();
    const attempt = row.attempts + 1;
    const result = await pinnedPost({
      url: hook.url,
      headers: {
        "content-type": "application/json",
        "user-agent": "Barynt-Webhooks",
        "x-barynt-event": row.event,
        "x-barynt-delivery": id,
        "x-barynt-attempt": String(attempt),
        "x-barynt-signature": signPayload(hook.secret, timestamp, row.payload),
        "x-barynt-timestamp": timestamp,
      },
      body: row.payload,
      timeoutMs: DELIVERY_TIMEOUT_MS,
      keepBytes: RESPONSE_KEEP_BYTES,
      internalHosts: webhookInternalHosts(),
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
    await recordOnWebhook(hook, outcome, now);
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
