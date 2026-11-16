import "server-only";
import { db } from "@/lib/db";
import { fullName } from "@/lib/utils/string";
import type { IssueChanges } from "./changes";
import { deliverEvent } from "./deliver";
import type { WebhookEvent } from "./events";
import { hasPluginListeners } from "./plugin-targets";
import { currentPlugin, type EventPlugin } from "./source";

// The one way Barynt announces that something happened (BARY-210). Every
// event goes out in the same envelope: where it happened, who did it,
// through which plugin, the resource as the REST API shows it, and for an
// update what changed.

export interface EventContext {
  workspaceId: string;
  /** `null` for a workspace-wide thing (a workspace label, a member). */
  projectId?: string | null;
  /** Who did it — `null` when nobody did (a system job). */
  actorId?: string | null;
}

export interface EventEnvelope {
  event: WebhookEvent;
  /** Milliseconds since the epoch. */
  timestamp: number;
  workspaceId: string;
  projectId: string | null;
  actor: { id: string; name: string } | null;
  /** The plugin the change came through, if any. */
  via: { plugin: EventPlugin } | null;
  data: unknown;
  changes?: IssueChanges;
}

/**
 * Announces an event. Fire-and-forget from the caller's point of view —
 * call it without `await`, after the change is written. Never throws.
 */
export function emitEvent(
  event: WebhookEvent,
  data: unknown,
  ctx: EventContext,
  extra?: { changes?: IssueChanges },
): void {
  dispatchEvent(event, data, ctx, extra).catch(() => {});
}

/** The awaited version of `emitEvent`, for tests and for callers that
 *  already run in the background. */
export async function dispatchEvent(
  event: WebhookEvent,
  data: unknown,
  ctx: EventContext,
  extra?: { changes?: IssueChanges },
): Promise<void> {
  await deliverEvent(await buildEnvelope(event, data, ctx, extra));
}

export async function buildEnvelope(
  event: WebhookEvent,
  data: unknown,
  ctx: EventContext,
  extra?: { changes?: IssueChanges },
): Promise<EventEnvelope> {
  const actor = ctx.actorId
    ? await db.user.findUnique({
        where: { id: ctx.actorId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          pluginBot: { select: { pluginId: true } },
        },
      })
    : null;
  // Through a plugin: its sandbox frame's request (`runAsPlugin`), or its
  // server acting as its app (BARY-213) — either way it doesn't hear about
  // it again.
  const plugin =
    currentPlugin() ??
    (actor?.pluginBot
      ? { id: actor.pluginBot.pluginId, name: fullName(actor) }
      : null);
  return {
    event,
    timestamp: Date.now(),
    workspaceId: ctx.workspaceId,
    projectId: ctx.projectId ?? null,
    actor: actor ? { id: actor.id, name: fullName(actor) } : null,
    via: plugin ? { plugin } : null,
    data,
    ...(extra?.changes && { changes: extra.changes }),
  };
}

/** Whether anything in the workspace listens at all — a webhook or a
 *  plugin's server — so a caller can skip the work of a snapshot nobody
 *  would get. */
export async function hasEventListeners(workspaceId: string): Promise<boolean> {
  const hooks = await db.webhook.count({
    where: { workspaceId, enabled: true },
  });
  return hooks > 0 || hasPluginListeners(workspaceId);
}
