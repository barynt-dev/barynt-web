import { describe, expect, it } from "bun:test";
import {
  changesFor,
  type IssueSnapshot,
  issueChangeEvents,
  issueChanges,
} from "@/lib/webhooks/changes";
import {
  isWebhookEvent,
  WEBHOOK_EVENT_GROUPS,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks/events";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

const BASE: IssueSnapshot = {
  title: "Fix checkout",
  status: "todo",
  statusCategory: "unstarted",
  priority: 2,
  type: "bug",
  labels: [
    { id: "l-1", name: "frontend" },
    { id: "l-2", name: "safari" },
  ],
  assignee: null,
  description: "It breaks",
  dueDate: new Date("2026-11-20T00:00:00.000Z"),
  storyPoints: 3,
  estimateHours: null,
  estimateUnit: null,
  parent: null,
  customFields: { branch: "ada/web-42", sprint: { id: "o-1", label: "S1" } },
};

describe("issueChanges()", () => {
  it("is empty when nothing changed — dates compared as instants, labels as a set", () => {
    const same: IssueSnapshot = {
      ...BASE,
      dueDate: "2026-11-20T00:00:00.000Z",
      labels: [...BASE.labels].reverse(),
      customFields: {
        sprint: { id: "o-1", label: "S1" },
        branch: "ada/web-42",
      },
    };
    expect(issueChanges(BASE, same)).toEqual({});
    expect(issueChangeEvents({})).toEqual([]);
  });

  it("says what changed from what to what", () => {
    const changes = issueChanges(BASE, {
      ...BASE,
      title: "Fix checkout on Safari",
      status: "done",
      statusCategory: "completed",
      assignee: { id: "u-1", name: "Ada" },
      dueDate: null,
      parent: { id: "i-9", ref: "WEB-9" },
    });
    expect(changes).toEqual({
      title: { from: "Fix checkout", to: "Fix checkout on Safari" },
      status: { from: "todo", to: "done" },
      statusCategory: { from: "unstarted", to: "completed" },
      assignee: { from: null, to: { id: "u-1", name: "Ada" } },
      dueDate: { from: "2026-11-20T00:00:00.000Z", to: null },
      parent: { from: null, to: { id: "i-9", ref: "WEB-9" } },
    });
  });

  it("lists custom fields by key, including one that was set or cleared", () => {
    const changes = issueChanges(BASE, {
      ...BASE,
      customFields: { sprint: { id: "o-2", label: "S2" }, points: 5 },
    });
    expect(changes).toEqual({
      "customFields.branch": { from: "ada/web-42", to: null },
      "customFields.points": { from: null, to: 5 },
      "customFields.sprint": {
        from: { id: "o-1", label: "S1" },
        to: { id: "o-2", label: "S2" },
      },
    });
  });

  it("names a label change with the labels on both sides", () => {
    const after = { ...BASE, labels: [{ id: "l-1", name: "frontend" }] };
    expect(issueChanges(BASE, after).labels).toEqual({
      from: BASE.labels,
      to: after.labels,
    });
  });
});

describe("issueChangeEvents() and changesFor()", () => {
  const changes = {
    title: { from: "a", to: "b" },
    status: { from: "todo", to: "done" },
    statusCategory: { from: "unstarted", to: "completed" },
    assignee: { from: null, to: { id: "u-1", name: "Ada" } },
    "customFields.branch": { from: null, to: "x" },
  };

  it("always sends issue.updated, plus the named events for their fields", () => {
    expect(issueChangeEvents(changes)).toEqual([
      "issue.updated",
      "issue.status_changed",
      "issue.assigned",
      "issue.fields_changed",
    ]);
    expect(issueChangeEvents({ title: { from: "a", to: "b" } })).toEqual([
      "issue.updated",
    ]);
  });

  it("gives each named event only its own fields", () => {
    expect(changesFor("issue.updated", changes)).toEqual(changes);
    expect(Object.keys(changesFor("issue.status_changed", changes))).toEqual([
      "status",
      "statusCategory",
    ]);
    expect(Object.keys(changesFor("issue.assigned", changes))).toEqual([
      "assignee",
    ]);
    expect(Object.keys(changesFor("issue.fields_changed", changes))).toEqual([
      "customFields.branch",
    ]);
  });
});

describe("the event catalog", () => {
  it("has each event once, in the group its name starts with", () => {
    expect(new Set(WEBHOOK_EVENTS).size).toBe(WEBHOOK_EVENTS.length);
    for (const group of WEBHOOK_EVENT_GROUPS)
      for (const event of group.events)
        expect(event.startsWith(`${group.key}.`)).toBe(true);
    expect(isWebhookEvent("issue.status_changed")).toBe(true);
    expect(isWebhookEvent("issue.exploded")).toBe(false);
  });

  it("has a label for every group and event, in English and German", () => {
    for (const messages of [en, de]) {
      const hooks = messages.webhooks as unknown as {
        groups: Record<string, string>;
        events: Record<string, Record<string, string>>;
      };
      for (const group of WEBHOOK_EVENT_GROUPS) {
        expect(hooks.groups[group.key]).toBeTruthy();
        for (const event of group.events) {
          const [g, name] = event.split(".");
          expect(hooks.events[g]?.[name]).toBeTruthy();
        }
      }
    }
  });
});
