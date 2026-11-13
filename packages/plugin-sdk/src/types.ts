// What a plugin gets from Barynt and sends to it — the shapes of the host
// bridge's methods (`docs/dev/plugins-host-api.md`). Kept to the fields a plugin
// is likely to use; the objects carry more.

/** Where a plugin's frame runs. */
export interface Context {
  /** Which of its views or pages this frame is for. */
  slot: {
    kind:
      | "projectView"
      | "page"
      | "widget"
      | "block"
      | "issuePanel"
      | "badges"
      | "settings";
    id: string;
  };
  /** In an issue panel: the issue it's about — `api.issues.get(issueId)`. */
  issueId?: string;
  workspaceId: string;
  /** `null` for a workspace's plugin. */
  projectId: string | null;
  /** The person's language, e.g. `de`. */
  locale: string;
  /** A building block's own settings, as the widget's builder set them. */
  config?: Record<string, string | number | boolean>;
}

/**
 * What a building block shows, for Barynt to draw like its own blocks
 * (`registerBlock`). Texts are cut to 200 characters, lists and bars to 20,
 * links to `http(s)`, colours to a `#hex` or a `var(--token)`.
 */
export type BlockData =
  | {
      kind: "kpi";
      value: string | number;
      label: string;
      trend?: { text: string; good?: boolean };
    }
  | {
      kind: "list";
      items: { title: string; meta?: string; href?: string }[];
      /** Shown when there are no items. */
      empty?: string;
    }
  | { kind: "bars"; bars: { label: string; value: number; color?: string }[] }
  | { kind: "progress"; value: number; max?: number; label?: string };

/** An issue a board shows, as `registerBadges` gets it: always id and
 *  reference; with `issues:read` confirmed, what the card shows too. */
export interface BadgeIssue {
  id: string;
  /** `PREFIX-123`. */
  ref: string;
  title?: string;
  priority?: number;
  dueDate?: string | null;
  /** When it was created, ISO. */
  created?: string;
}

/** The icons a badge may carry — Barynt's own, nothing is loaded. */
export type BadgeIcon =
  | "clock"
  | "timer"
  | "calendar"
  | "check"
  | "circle-check"
  | "circle-x"
  | "triangle-alert"
  | "info"
  | "flag"
  | "star"
  | "bug"
  | "zap"
  | "lock"
  | "eye"
  | "link"
  | "user"
  | "message-square"
  | "git-pull-request"
  | "git-merge"
  | "git-branch"
  | "rocket"
  | "package";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

/** A step of a row's pipeline — a build, a review, a check. */
export type StepState =
  | "success"
  | "running"
  | "warning"
  | "danger"
  | "pending";

/** What a row across the card is made of, left to right, in the order you
 *  choose — Barynt draws each part. At most 8 parts. */
export type RowPart =
  | { type: "icon"; icon: BadgeIcon; tone?: BadgeTone }
  | {
      type: "text";
      /** Up to 40 characters. */
      text: string;
      tone?: BadgeTone | "subtle";
      /** In the monospace font — a number, a hash. */
      mono?: boolean;
      strong?: boolean;
    }
  | { type: "chip"; text: string; tone?: BadgeTone }
  | { type: "avatar"; name: string }
  | { type: "steps"; steps: StepState[] }
  | { type: "progress"; value: number; max: number }
  | { type: "status"; status: "success" | "danger" | "warning" | "pending" }
  /** Pushes what follows to the row's right end. */
  | { type: "spacer" };

/** On a card or row: a small chip (up to 3 per issue, `text` up to 24
 *  characters) — or, `kind: "row"`, a line across the card made of `parts`
 *  (up to 2 per issue). */
export interface Badge {
  /** Which of your `contributes.issueBadges` — what people can hide. */
  badge: string;
  kind?: "chip" | "row";
  /** A chip's text. A row's summary — shown where there's no room for the
   *  row (the list) and read out; without it, the row's texts. */
  text?: string;
  icon?: BadgeIcon;
  tone?: BadgeTone;
  /** Up to 120 characters. */
  tooltip?: string;
  /** A row's parts, left to right. */
  parts?: RowPart[];
}

/** The object Barynt hands a plugin's default export. */
export interface Host {
  call(method: string, params?: unknown): Promise<unknown>;
  readonly context: Context;
  readonly root: HTMLElement;
  /** Hands a building block's data to Barynt to draw. */
  show?(data: BlockData): void;
  /** What answers a board's batches of issues with badges. */
  serveBadges?(
    handler: (
      issues: BadgeIssue[],
    ) => Record<string, Badge[]> | Promise<Record<string, Badge[]>>,
  ): void;
}

export interface Person {
  id: string;
  name: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  /** `null` for a workspace-wide label. */
  projectId: string | null;
}

export type StatusCategory =
  | "backlog"
  | "unstarted"
  | "started"
  | "completed"
  | "canceled";

export interface Issue {
  id: string;
  /** `PREFIX-123`. */
  ref: string;
  title: string;
  status: string;
  statusCategory: StatusCategory | null;
  priority: number;
  type: string;
  labels: { id: string; name: string; color: string }[];
  assignee: Person | null;
  reporter: Person;
  project: { id: string; name: string };
  /** Markdown. */
  description: string;
  created: string;
  updated: string;
  closedAt: string | null;
  dueDate: string | null;
  storyPoints: number | null;
}

export interface Comment {
  id: string;
  issueId: string;
  /** Markdown. */
  body: string;
  created: string;
}

export interface Project {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  name: string;
}

export interface CustomField {
  id: string;
  key: string;
  name: string;
  type: string;
}

/** Fields an issue can be created or changed with — as in Barynt's REST
 *  API (`POST /api/v1/projects/:id/issues`, `PATCH /api/v1/issues/:id`). */
export interface IssueInput {
  title?: string;
  /** Markdown. */
  description?: string;
  status?: string;
  priority?: number;
  assignee?: string | null;
  labels?: string[];
  type?: string;
  parentId?: string | null;
  dueDate?: string | null;
  storyPoints?: number | null;
  /** Needs `fields:write` too. */
  customFields?: Record<string, unknown>;
}

/** Any JSON value — what the plugin's storage keeps. */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/** Each method of the host bridge: what it takes and what it gives. */
export interface Methods {
  "issues.list": [
    {
      projectId?: string;
      q?: string;
      status?: string;
      cursor?: string;
      take?: number;
    },
    { issues: Issue[]; nextCursor: string | null },
  ];
  "issues.get": [{ id: string }, Issue];
  "issues.create": [IssueInput & { title: string; projectId?: string }, Issue];
  "issues.update": [IssueInput & { id: string }, { id: string }];
  "comments.list": [{ issueId: string }, Comment[]];
  "comments.create": [
    { issueId: string; body: string; parentId?: string },
    Comment,
  ];
  "labels.list": [{ projectId?: string }, Label[]];
  "projects.list": [Record<string, never>, Project[]];
  "members.list": [{ projectId?: string }, Member[]];
  "fields.list": [{ projectId?: string }, CustomField[]];
  "storage.get": [{ key: string }, Json];
  "storage.set": [{ key: string; value: Json }, null];
  "storage.delete": [{ key: string }, null];
  "storage.list": [Record<string, never>, string[]];
  "settings.get": [Record<string, never>, Record<string, Json>];
  "settings.set": [{ values: Record<string, Json> }, null];
  "net.fetch": [
    {
      url: string;
      method?: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
    },
    {
      status: number;
      headers: Record<string, string>;
      /** The body, when it's text (JSON, XML, text/*). */
      text?: string;
      /** The body, base64, when it isn't. */
      base64?: string;
    },
  ];
}

export type Method = keyof Methods;

/** Why Barynt refused a request. */
export type ErrorCode =
  | "unknown_method"
  | "invalid_params"
  | "not_active"
  | "capability_not_confirmed"
  | "forbidden"
  | "not_found"
  | "storage_full"
  | "host_not_allowed"
  | "credential_missing"
  | "upstream_failed"
  | "timeout"
  | "too_many_requests";
