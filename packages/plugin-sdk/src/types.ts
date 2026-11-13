// What a plugin gets from Barynt and sends to it — the shapes of the host
// bridge's methods (`docs/dev/plugins-host-api.md`). Kept to the fields a plugin
// is likely to use; the objects carry more.

/** Where a plugin's frame runs. */
export interface Context {
  /** Which of its views or pages this frame is for. */
  slot: { kind: "projectView" | "page"; id: string };
  workspaceId: string;
  /** `null` for a workspace's plugin. */
  projectId: string | null;
  /** The person's language, e.g. `de`. */
  locale: string;
}

/** The object Barynt hands a plugin's default export. */
export interface Host {
  call(method: string, params?: unknown): Promise<unknown>;
  readonly context: Context;
  readonly root: HTMLElement;
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
