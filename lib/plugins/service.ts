import { WEBHOOK_EVENT_GROUPS, type WebhookEvent } from "../webhooks/events";

// A plugin's own server (BARY-212): which events it may subscribe to, which
// capability each needs, and what of an event it gets to see. No
// dependencies, used by the manifest check and by delivery alike.

/** Events a plugin may subscribe to — everything but saved views, which
 *  are people's own arrangement, not workspace data. */
export const PLUGIN_EVENTS = WEBHOOK_EVENT_GROUPS.filter(
  (g) => g.key !== "view",
).flatMap((g) => g.events) as Exclude<WebhookEvent, `view.${string}`>[];

export type PluginEvent = (typeof PLUGIN_EVENTS)[number];

/** Lifecycle messages Barynt sends to a service, outside any subscription. */
export const LIFECYCLE_EVENTS = ["app.installed", "app.uninstalled"] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

/** The capability an event needs. Labels go with issues — they are part of
 *  them. */
export function eventCapability(
  event: PluginEvent,
): "events:issue" | "events:comment" | "events:project" | "events:member" {
  if (event.startsWith("comment.")) return "events:comment";
  if (event.startsWith("project.")) return "events:project";
  if (event.startsWith("member.")) return "events:member";
  return "events:issue";
}

/** Whether a service URL is a local one — allowed in a manifest only so a
 *  plugin can be built on one's own machine; delivery reaches it only in
 *  development (`lib/plugins/dev.ts`). */
export function isLocalServiceUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

interface Envelope {
  event: string;
  data: unknown;
  changes?: unknown;
  [key: string]: unknown;
}

/**
 * What a plugin gets of an event: everything its confirmed capabilities
 * let it read, the rest left out. Without `issues:read` an issue is only
 * its id and reference (and no `changes`, which carry field values);
 * without `comments:read` a comment has no body.
 */
export function eventForPlugin<T extends Envelope>(
  envelope: T,
  capabilities: readonly string[],
): T {
  const event = envelope.event;
  const data = envelope.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return envelope;

  if (event.startsWith("issue.") && !capabilities.includes("issues:read")) {
    const { changes: _changes, ...rest } = envelope;
    const project = data.project as { id?: string } | undefined;
    return {
      ...rest,
      data: {
        id: data.id,
        ref: data.ref,
        projectId: data.projectId ?? project?.id ?? null,
      },
    } as T;
  }
  if (event.startsWith("comment.") && !capabilities.includes("comments:read")) {
    const { body: _body, ...rest } = data;
    return { ...envelope, data: rest };
  }
  return envelope;
}
