import type { WebhookEvent } from "./events";

// What changed on an issue between two snapshots (BARY-210) — the
// `changes` of `issue.updated`, and which of the named events it makes.
// Works on the REST shape (`ApiIssue`), so a receiver reads the same
// fields it gets from the API. No dependencies.

/** The part of an issue this compares — `ApiIssue` has all of it. */
export interface IssueSnapshot {
  title: string;
  status: string;
  statusCategory: string | null;
  priority: number;
  type: string;
  labels: { id: string; name: string }[];
  assignee: { id: string; name: string } | null;
  description: string;
  dueDate: Date | string | null;
  storyPoints: number | null;
  estimateHours: number | null;
  estimateUnit: string | null;
  parent: { id: string; ref: string } | null;
  customFields: Record<string, unknown>;
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

/** Field → from/to. A custom field is `customFields.<key>`. */
export type IssueChanges = Record<string, FieldChange>;

const PLAIN = [
  "title",
  "status",
  "statusCategory",
  "priority",
  "type",
  "description",
  "storyPoints",
  "estimateHours",
  "estimateUnit",
] as const;

const time = (d: Date | string | null) =>
  d === null ? null : new Date(d).toISOString();

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function issueChanges(
  before: IssueSnapshot,
  after: IssueSnapshot,
): IssueChanges {
  const changes: IssueChanges = {};
  for (const key of PLAIN) {
    if (!same(before[key], after[key]))
      changes[key] = { from: before[key], to: after[key] };
  }
  if (time(before.dueDate) !== time(after.dueDate))
    changes.dueDate = { from: time(before.dueDate), to: time(after.dueDate) };
  const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();
  if (!same(ids(before.labels), ids(after.labels)))
    changes.labels = { from: before.labels, to: after.labels };
  if ((before.assignee?.id ?? null) !== (after.assignee?.id ?? null))
    changes.assignee = { from: before.assignee, to: after.assignee };
  if ((before.parent?.id ?? null) !== (after.parent?.id ?? null))
    changes.parent = { from: before.parent, to: after.parent };
  const keys = new Set([
    ...Object.keys(before.customFields),
    ...Object.keys(after.customFields),
  ]);
  for (const key of [...keys].sort()) {
    const from = before.customFields[key] ?? null;
    const to = after.customFields[key] ?? null;
    if (!same(from, to)) changes[`customFields.${key}`] = { from, to };
  }
  return changes;
}

/** The events a change makes: `issue.updated` for anything, plus the named
 *  ones whose field is among the changes. None when nothing changed. */
export function issueChangeEvents(changes: IssueChanges): WebhookEvent[] {
  const keys = Object.keys(changes);
  if (keys.length === 0) return [];
  const events: WebhookEvent[] = ["issue.updated"];
  if ("status" in changes) events.push("issue.status_changed");
  if ("assignee" in changes) events.push("issue.assigned");
  if (keys.some((k) => k.startsWith("customFields.")))
    events.push("issue.fields_changed");
  return events;
}

/** The changes one named event carries — only its own fields. */
export function changesFor(
  event: WebhookEvent,
  changes: IssueChanges,
): IssueChanges {
  const pick = (test: (key: string) => boolean) =>
    Object.fromEntries(Object.entries(changes).filter(([k]) => test(k)));
  switch (event) {
    case "issue.status_changed":
      return pick((k) => k === "status" || k === "statusCategory");
    case "issue.assigned":
      return pick((k) => k === "assignee");
    case "issue.fields_changed":
      return pick((k) => k.startsWith("customFields."));
    default:
      return changes;
  }
}
