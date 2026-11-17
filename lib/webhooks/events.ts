// What Barynt tells the outside about (BARY-210): one list for workspace
// webhooks and, later, plugins' subscriptions. Grouped the way the
// settings show them. No dependencies.

export const WEBHOOK_EVENT_GROUPS = [
  {
    key: "issue",
    events: [
      "issue.created",
      // The full issue plus `changes` — what changed, from what to what.
      "issue.updated",
      // Also sent as `issue.updated`; these name the change for anyone who
      // only cares about it.
      "issue.status_changed",
      "issue.assigned",
      "issue.fields_changed",
      "issue.deleted",
    ],
  },
  {
    key: "comment",
    events: ["comment.created", "comment.updated", "comment.deleted"],
  },
  {
    key: "label",
    events: ["label.created", "label.updated", "label.deleted"],
  },
  {
    key: "project",
    events: [
      "project.created",
      "project.updated",
      "project.archived",
      "project.unarchived",
      "project.deleted",
    ],
  },
  {
    key: "member",
    events: ["member.added", "member.removed", "member.role_changed"],
  },
  {
    // Shared views only (BARY-172) — a private view is nobody else's news.
    key: "view",
    events: ["view.created", "view.updated", "view.deleted"],
  },
] as const;

export type WebhookEventGroup = (typeof WEBHOOK_EVENT_GROUPS)[number]["key"];

export type WebhookEvent =
  (typeof WEBHOOK_EVENT_GROUPS)[number]["events"][number];

export const WEBHOOK_EVENTS: readonly WebhookEvent[] =
  WEBHOOK_EVENT_GROUPS.flatMap((g) => g.events);

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}
