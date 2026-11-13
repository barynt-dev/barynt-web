import type { DashboardScope } from "@/features/dashboard/scope";
import type {
  CustomWidgetEntry,
  NotePage,
  ShortcutKey,
  TimeBy,
  Widget,
} from "@/features/dashboard/widgets";
import type { AuditEntry } from "@/lib/audit/actions";
import type { BucketUnit, RangeKey } from "@/lib/buckets";
import type { FramePolicy } from "@/lib/net/embed-check";
import type { User } from "@/types";

// What a dashboard's widgets display — fully computed on the server, as
// everywhere in this project. The widgets just render.

/** Which dashboard: a project's, the workspace's, or a dashboard view's. */
export type DashboardTarget =
  | { kind: "project"; id: string }
  | { kind: "workspace"; id: string }
  | { kind: "view"; id: string };

/** Why an issue appears in "needs attention" — most severe first. */
export type AttentionReason = "overdue" | "unassigned" | "urgent" | "stale";

/** An issue as the list widgets show it. */
export interface DashboardIssue {
  id: string;
  /** `NIM-142`. */
  ref: string;
  title: string;
  statusName: string;
  statusColor: string;
  priority: number;
  assignee: User | null;
  /** Milliseconds. */
  updated: number;
  dueDate: number | null;
  reason?: AttentionReason;
  storyPoints?: number | null;
  /** Only when the list shows its labels column. */
  labels?: { name: string; color: string }[];
}

/** One part of a distribution or one axis entry of a matrix. */
export interface Slice {
  key: string;
  label: string;
  color: string;
  count: number;
  /** For the assignee axis. */
  user?: User | null;
  /** The board filtered to this value (distributions). */
  href?: string | null;
}

/** One line or bar series of a time series (BARY-170). */
export interface Series {
  /** "created"/"closed" for the classic pair, "all" for one date, or the
   *  group's key when split. */
  key: string;
  label: string;
  color: string;
  /** One value per bucket. */
  values: number[];
  total: number;
  /** The board filtered to each bucket; `null` where it's empty. */
  hrefs: (string | null)[];
}

export interface BurnupPoint {
  date: string;
  /** Every issue that existed by the bucket's end. */
  total: number;
  /** Of those, closed by then. */
  done: number;
  /** New in this bucket — the burndown marks when work came in. */
  added?: number;
}

/** One band of a cumulative flow chart (BARY-171): a category or a status,
 *  how many issues sat there at each bucket's end. */
export interface FlowBand {
  key: string;
  /** A status's name; empty for a category (the client names those). */
  label: string;
  color: string;
  values: number[];
}

/** How long issues stayed in one status or category, on average. */
export interface StatusStay {
  key: string;
  label: string;
  color: string;
  /** Average stay in days. */
  days: number;
  /** Stays that ended in the range. */
  count: number;
}

export interface CyclePoint {
  id: string;
  ref: string;
  title: string;
  /** Closed at, milliseconds. */
  closed: number;
  days: number;
}

export interface WorkloadRow {
  /** `null` is the unassigned pile. */
  user: User | null;
  open: number;
  inProgress: number;
  /** The board with this person's (or nobody's) open issues. */
  href?: string | null;
}

export interface AboutData {
  kind: "project" | "workspace";
  name: string;
  desc: string;
  color: string;
  avatarUrl: string | null;
  /** The project's issue prefix; `null` for the workspace. */
  prefix: string | null;
  createdAt: number;
  members: User[];
  memberCount: number;
  open: number;
  /** Projects in the workspace; `null` for a project. */
  projects: number | null;
  /** Teams working on it. */
  teams: number;
  /** All issues except canceled ones, and how far they've come. */
  progress: { done: number; inProgress: number; total: number };
  links: { id: string; label: string; url: string }[];
  /** Settings — only for who may change name and description. */
  editHref: string | null;
}

export interface MemberRow {
  user: User;
  /** Their open issues as a list. */
  href: string;
}

export interface RoleGroup {
  key: string;
  name: string;
  rank: number;
  members: MemberRow[];
}

export interface TeamRow {
  id: string;
  name: string;
  key: string;
  color: string;
  members: number;
  lead: User | null;
  /** Its people, for the face stack. */
  people: User[];
  /** The open issues of everyone in it, as a list. */
  href: string | null;
}

export interface LabelRow {
  id: string;
  name: string;
  color: string;
  /** Open issues carrying it, within the dashboard's projects. */
  open: number;
  /** Belongs to the project alone, not the whole workspace. */
  own: boolean;
  /** Its open issues as a list. */
  href: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  prefix: string;
  color: string;
  avatarUrl: string | null;
  open: number;
  href: string;
}

export interface Shortcut {
  key: ShortcutKey;
  /** Shown while the widget has no choice of its own. */
  default: boolean;
  icon: string;
  href: string;
}

export type WidgetData =
  | {
      type: "kpi";
      value: number | null;
      /** The same over the previous range — `null` for stocks without
       *  history and when there's nothing to compare with. */
      previous: number | null;
      /** One value per bucket, oldest first. */
      spark: number[] | null;
      /** The board filtered to what this number counts. */
      href: string | null;
      /** Elements: the "second number", the mini list. */
      second?: { value: number; href: string | null } | null;
      list?: DashboardIssue[];
    }
  | {
      type: "progress";
      done: number;
      inProgress: number;
      total: number;
      href: string | null;
      second?: { value: number; href: string | null } | null;
      /** Days until done at the range's pace; `null` without a pace. */
      forecastDays?: number | null;
    }
  | { type: "distribution"; slices: Slice[]; total: number }
  | { type: "attention"; issues: DashboardIssue[]; total: number }
  | {
      type: "issues";
      issues: DashboardIssue[];
      total: number;
      href?: string | null;
    }
  | {
      type: "flow";
      /** Bucket starts, `YYYY-MM-DD`. */
      dates: string[];
      timeBy: TimeBy;
      series: Series[];
      /** The main series one range earlier (element "previous"). */
      previous?: number[] | null;
    }
  | { type: "burnup"; points: BurnupPoint[] }
  | {
      type: "blocks";
      /** Each block's own data, by block id (BARY-170). */
      blocks: Record<string, WidgetData>;
    }
  | {
      type: "cycle";
      avg: number | null;
      previous: number | null;
      p50: number | null;
      p75: number | null;
      p95: number | null;
      points: CyclePoint[];
      /** Average per bucket, `null` where nothing closed. */
      spark: (number | null)[];
      /** Measured from the first start (cycle) or from creation (lead). */
      by?: "cycle" | "lead";
      /** Closed in the range but never started — not in a cycle time. */
      unstarted?: number;
    }
  | {
      type: "cfd";
      /** Bucket starts, `YYYY-MM-DD`. */
      dates: string[];
      /** Bottom to top. */
      bands: FlowBand[];
    }
  | { type: "timeInStatus"; rows: StatusStay[] }
  | { type: "workload"; rows: WorkloadRow[] }
  | {
      type: "matrix";
      rows: Slice[];
      cols: Slice[];
      cells: number[][];
      max: number;
    }
  | {
      type: "age";
      /** <1 W, 1–2 W, 2–4 W, 1–3 M, >3 M. */
      buckets: number[];
      avg: number | null;
      oldest: DashboardIssue[];
    }
  | { type: "about"; about: AboutData | null }
  | { type: "activity"; entries: AuditEntry[] }
  | {
      type: "members";
      groups: RoleGroup[];
      total: number;
      /** The member list — `null` without the permission to see it. */
      href: string | null;
    }
  | { type: "teams"; teams: TeamRow[]; href: string | null }
  | {
      type: "labels";
      labels: LabelRow[];
      /** Where a new label goes: the project, or the workspace (`null`). */
      projectId: string | null;
      workspaceId: string;
      canCreate: boolean;
      href: string | null;
    }
  | { type: "projects"; projects: ProjectRow[]; href: string }
  | {
      type: "links";
      links: { id: string; label: string; url: string }[];
      href: string | null;
    }
  | { type: "shortcuts"; items: Shortcut[] }
  | {
      type: "embed";
      /** Whether the page lets itself be framed here (BARY-183) — only
       *  checked for websites; `unknown` when the server can't tell. */
      framing: FramePolicy | null;
    }
  | {
      type: "note";
      /** This person's own pages — nobody else's. */
      pages: NotePage[];
    }
  | {
      /** A plugin's widget (BARY-149): drawn by its own frame. */
      type: "plugin";
      pluginId: string;
      widgetId: string;
      /** `null` while it doesn't run here (switched off, removed, not
       *  confirmed) — the widget says so instead of a frame. */
      plugin: { name: string; title: string } | null;
      workspaceId: string;
      projectId: string | null;
    }
  | {
      type: "pluginBlock";
      pluginId: string;
      blockId: string;
      /** `null` while it doesn't run here — the block says so; the rest
       *  of the widget stays. `draw`: Barynt draws its data, or the plugin
       *  draws it in its frame (BARY-205). */
      plugin: { name: string; title: string; draw: "barynt" | "plugin" } | null;
      workspaceId: string;
      projectId: string | null;
    };

/** Widget id → its data. */
export type WidgetDataMap = Record<string, WidgetData>;

/** Where the widgets came from and who may change what. */
export interface DashboardLayoutInfo {
  widgets: Widget[];
  /** Read from the person's own row. */
  personal: boolean;
  /** Admins have set a default for everyone (project/workspace only). */
  hasShared: boolean;
  /** May change their own layout (everyone who sees a project/workspace
   *  dashboard; for a view: whoever may edit it). */
  canEdit: boolean;
  /** May save the default for everyone (`project.update`/`workspace.update`). */
  canEditShared: boolean;
}

/** A plugin's widget as a dashboard's gallery offers it. */
export interface PluginWidgetEntry {
  pluginId: string;
  pluginName: string;
  widgetId: string;
  title: string;
  /** Made of Barynt's blocks (`widgetTemplates`, BARY-203): added as the
   *  custom widget it starts, no frame. Missing for a widget the plugin
   *  draws itself. */
  template?: Widget;
}

/** A plugin's building block, as the widget builder offers it (BARY-205). */
export interface PluginBlockEntry {
  pluginId: string;
  pluginName: string;
  blockId: string;
  title: string;
  description: string | null;
  draw: "barynt" | "plugin";
  /** Set per block in the builder. */
  settings: {
    key: string;
    type: "text" | "number" | "boolean" | "select";
    label: string;
    description: string | null;
    default: string | number | boolean | null;
    options: { id: string; label: string }[];
  }[];
}

export interface DashboardView {
  /** The viewer's custom widgets and the shared ones of others. */
  customWidgets: CustomWidgetEntry[];
  /** Widgets the plugins switched on here bring (BARY-149, BARY-203). */
  pluginWidgets: PluginWidgetEntry[];
  /** Building blocks they bring, for custom widgets (BARY-205). */
  pluginBlocks: PluginBlockEntry[];
  target: DashboardTarget;
  range: RangeKey;
  unit: BucketUnit;
  /** The scope actually applied — "mine" without `dashboard.view.all`. */
  scope: DashboardScope;
  canViewAll: boolean;
  layout: DashboardLayoutInfo;
  data: WidgetDataMap;
}
