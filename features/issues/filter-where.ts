import { narrowFieldValue } from "@/lib/custom-fields";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  type FilterEntry,
  matchTerms,
  type PluginFilterDef,
} from "@/lib/plugins/filters";
import type { StatusCategory } from "@/lib/status-category";
import {
  customFieldRef,
  type FilterNode,
  type FilterRule,
  type IssueFilter,
  isCustomFilterField,
  isGroup,
  isPluginFilterField,
  ME,
  NONE_VALUE,
  type PluginFilterField,
  pluginFilterRef,
  type RelativeDate,
} from "./filter";
import { type CustomFilterFieldShape, customRuleTest } from "./filter-custom";

type Where = Prisma.IssueWhereInput;

/**
 * What `toIssueWhere` needs from outside. The two lookups are passed in
 * rather than imported so this file stays free of the database — the tests
 * hand in plain functions, `queries.ts` hands in the real ones.
 */
export interface FilterContext {
  /** Resolves `@me`. `null` (no session) drops `@me` from a rule. */
  userId: string | null;
  /** The moment relative dates are measured from. */
  now: Date;
  /** Ids of the statuses in these categories (`statusCategory` rules). */
  statusIdsIn: (categories: StatusCategory[]) => Promise<string[]>;
  /** Full-text matches for a search (`text` rules). */
  searchIds: (q: string) => Promise<string[]>;
  /** A custom field and every value stored for it (`cf:<id>` rules,
   *  BARY-196) — `null` for a field that's gone. Without it, those rules
   *  drop out. */
  customFieldValues?: (fieldId: string) => Promise<{
    field: CustomFilterFieldShape;
    rows: { issueId: string; value: unknown }[];
  } | null>;
  /** One of a plugin's filters and the entries it keeps of that filter's
   *  kind (`pl:<plugin>:<filter>` rules, BARY-238) — `null` for a filter
   *  that's gone. Without it, those rules drop out. */
  pluginFilter?: (
    pluginId: string,
    filterId: string,
  ) => Promise<{ def: PluginFilterDef; entries: FilterEntry[] } | null>;
}

/** Local midnight of `date`, plus `days`. Same local-time convention the
 *  due-date buckets used before BARY-162. */
function dayStart(date: Date, days = 0): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/** `[from, to)` for a relative range — either end may be open. */
function relativeRange(
  token: RelativeDate,
  now: Date,
): { gte?: Date; lt?: Date } {
  const today = dayStart(now);
  switch (token) {
    case "overdue":
      return { lt: today };
    case "today":
      return { gte: today, lt: dayStart(now, 1) };
    case "next_7_days":
      return { gte: today, lt: dayStart(now, 7) };
    case "last_7_days":
      return { gte: dayStart(now, -6), lt: dayStart(now, 1) };
    case "last_30_days":
      return { gte: dayStart(now, -29), lt: dayStart(now, 1) };
  }
}

/** `today` or `YYYY-MM-DD` as local midnight; `null` for anything else. */
function parseDay(value: string, now: Date): Date | null {
  if (value === "today") return dayStart(now);
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const DATE_COLUMN = {
  dueDate: "dueDate",
  created: "created",
  updated: "updated",
} as const;

/** The issue number a search may also mean: `ORB-12` or `12`. Capped at
 *  nine digits so nothing exceeds the column's int range. */
function issueKeyOf(q: string): number | undefined {
  const digits = q.match(/^(?:[a-z]+-)?(\d{1,9})$/i)?.[1];
  return digits ? Number(digits) : undefined;
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * One rule as a `where` condition, or `null` when it constrains nothing —
 * no values left (all ids gone, `@me` without a session), or a value of the
 * wrong shape. A rule that drops out widens the result rather than empty
 * it, the same rule a stale URL slug always followed.
 *
 * `none` on a nullable column keeps the rows where it's empty: "assignee
 * is not Mara" includes unassigned issues. A plain SQL `NOT IN` would drop
 * them, since `NULL NOT IN (…)` is never true.
 */
/**
 * A rule on a custom field. Its values are JSON of a type only the field
 * knows, so the match is made in memory over that field's stored values
 * (`customRuleTest`) and comes back as ids — the rows of one field are few.
 * When an issue without a value matches too ("is not", "is empty"), the
 * condition names the ones that don't instead: issues without a row have
 * no row to find.
 */
async function customRuleWhere(
  rule: FilterRule & { field: `cf:${string}` },
  ctx: FilterContext,
): Promise<Where | null> {
  const found = await ctx.customFieldValues?.(customFieldRef(rule.field));
  if (!found) return null;
  const test = customRuleTest(found.field, rule, ctx);
  if (!test) return null;
  const matching: string[] = [];
  const failing: string[] = [];
  for (const row of found.rows)
    (test(narrowFieldValue(row.value)) ? matching : failing).push(row.issueId);
  return test(null) ? { id: { notIn: failing } } : { id: { in: matching } };
}

/**
 * A rule on one of a plugin's filters. Matched in memory over what the
 * plugin keeps of that kind (`matchTerms`), like a custom field: each
 * option picked is a set of issues — or, for "has none", every issue but
 * a set — and "is not" turns the lot round.
 */
async function pluginRuleWhere(
  rule: FilterRule & { field: PluginFilterField },
  ctx: FilterContext,
): Promise<Where | null> {
  const { pluginId, filterId } = pluginFilterRef(rule.field);
  const found = await ctx.pluginFilter?.(pluginId, filterId);
  if (!found) return null;
  const picked = list<string>(rule.value).filter(
    (v): v is string => typeof v === "string",
  );
  if (picked.length === 0) return null;
  const terms = matchTerms(found.def, picked, found.entries).map(
    (t): Where =>
      t.except ? { id: { notIn: t.issueIds } } : { id: { in: t.issueIds } },
  );
  // None of its options known any more: nothing matches.
  const any: Where =
    terms.length === 0
      ? { id: { in: [] } }
      : terms.length === 1
        ? terms[0]
        : { OR: terms };
  return rule.is === "none" ? { NOT: any } : any;
}

async function ruleWhere(
  rule: FilterRule,
  ctx: FilterContext,
): Promise<Where | null> {
  if (isPluginFilterField(rule.field))
    return pluginRuleWhere(
      rule as FilterRule & { field: PluginFilterField },
      ctx,
    );
  if (isCustomFilterField(rule.field))
    return customRuleWhere(rule as FilterRule & { field: `cf:${string}` }, ctx);
  const { field, is, value } = rule;

  switch (field) {
    case "status":
    case "type": {
      const ids = list<string>(value);
      if (!ids.length) return null;
      return is === "none"
        ? { [field]: { notIn: ids } }
        : { [field]: { in: ids } };
    }

    case "statusCategory": {
      const categories = list<StatusCategory>(value);
      if (!categories.length) return null;
      const ids = await ctx.statusIdsIn(categories);
      return is === "none"
        ? { status: { notIn: ids } }
        : { status: { in: ids } };
    }

    case "priority": {
      if (is === "gte" || is === "lte")
        return typeof value === "number" ? { priority: { [is]: value } } : null;
      const values = list<number>(value);
      if (!values.length) return null;
      return is === "none"
        ? { priority: { notIn: values } }
        : { priority: { in: values } };
    }

    case "assignee":
    case "reporter": {
      const column = field === "assignee" ? "assigneeId" : "reporterId";
      if (is === "empty") return { [column]: null };
      if (is === "notEmpty") return { [column]: { not: null } };
      const raw = list<string>(value);
      // "Not set" in the list: nobody assigned (BARY-166).
      const unset = column === "assigneeId" && raw.includes(NONE_VALUE);
      const ids = raw.flatMap((v) =>
        v === NONE_VALUE
          ? []
          : v === ME
            ? ctx.userId
              ? [ctx.userId]
              : []
            : [v],
      );
      if (!ids.length && !unset) return null;
      if (is === "none") {
        if (column === "reporterId") return { reporterId: { notIn: ids } };
        // Excluding people keeps the unassigned — unless "not set" is
        // excluded too.
        if (unset)
          return ids.length
            ? {
                AND: [
                  { assigneeId: { notIn: ids } },
                  { assigneeId: { not: null } },
                ],
              }
            : { assigneeId: { not: null } };
        return { OR: [{ assigneeId: { notIn: ids } }, { assigneeId: null }] };
      }
      if (unset)
        return ids.length
          ? { OR: [{ assigneeId: { in: ids } }, { assigneeId: null }] }
          : { assigneeId: null };
      return { [column]: { in: ids } };
    }

    case "label": {
      if (is === "empty") return { labels: { isEmpty: true } };
      if (is === "notEmpty") return { labels: { isEmpty: false } };
      const raw = list<string>(value);
      const unset = raw.includes(NONE_VALUE);
      const ids = raw.filter((v) => v !== NONE_VALUE);
      if (!ids.length && !unset) return null;
      if (is === "all")
        return ids.length ? { labels: { hasEvery: ids } } : null;
      if (is === "none") {
        const parts: Where[] = [];
        if (ids.length) parts.push({ NOT: { labels: { hasSome: ids } } });
        if (unset) parts.push({ labels: { isEmpty: false } });
        return parts.length === 1 ? parts[0] : { AND: parts };
      }
      const parts: Where[] = [];
      if (ids.length) parts.push({ labels: { hasSome: ids } });
      if (unset) parts.push({ labels: { isEmpty: true } });
      return parts.length === 1 ? parts[0] : { OR: parts };
    }

    case "project": {
      const ids = list<string>(value);
      if (!ids.length) return null;
      return is === "none"
        ? { projectId: { notIn: ids } }
        : { projectId: { in: ids } };
    }

    case "storyPoints": {
      if (is === "empty") return { storyPoints: null };
      if (is === "notEmpty") return { storyPoints: { not: null } };
      if (is === "gte" || is === "lte")
        return typeof value === "number"
          ? { storyPoints: { [is]: value } }
          : null;
      const raw = list<number | string>(value);
      const unset = raw.includes(NONE_VALUE);
      const values = raw.filter((v): v is number => typeof v === "number");
      if (!values.length && !unset) return null;
      if (is === "none") {
        if (unset)
          return values.length
            ? {
                AND: [
                  { storyPoints: { notIn: values } },
                  { storyPoints: { not: null } },
                ],
              }
            : { storyPoints: { not: null } };
        return {
          OR: [{ storyPoints: { notIn: values } }, { storyPoints: null }],
        };
      }
      if (unset)
        return values.length
          ? { OR: [{ storyPoints: { in: values } }, { storyPoints: null }] }
          : { storyPoints: null };
      return { storyPoints: { in: values } };
    }

    case "estimate": {
      if (is === "empty") return { estimateHours: null };
      if (is === "notEmpty") return { estimateHours: { not: null } };
      return typeof value === "number"
        ? { estimateHours: { [is === "gte" ? "gte" : "lte"]: value } }
        : null;
    }

    case "dueDate":
    case "created":
    case "updated": {
      const column = DATE_COLUMN[field];
      if (is === "empty") return field === "dueDate" ? { dueDate: null } : null;
      if (is === "notEmpty")
        return field === "dueDate" ? { dueDate: { not: null } } : null;
      if (is === "within") {
        if (typeof value !== "string") return null;
        return { [column]: relativeRange(value as RelativeDate, ctx.now) };
      }
      const day = typeof value === "string" ? parseDay(value, ctx.now) : null;
      if (!day) return null;
      // "Before the 14th" ends at the start of the 14th; "after the 14th"
      // starts at the start of the 15th — the day itself belongs to neither.
      return is === "before"
        ? { [column]: { lt: day } }
        : { [column]: { gte: dayStart(day, 1) } };
    }

    case "parent": {
      if (is === "empty") return { parentId: null };
      if (is === "notEmpty") return { parentId: { not: null } };
      const ids = list<string>(value);
      return ids.length ? { parentId: { in: ids } } : null;
    }

    // A piece of text, anywhere in the field, whatever its case. The plain
    // text columns, not the documents: `contains` doesn't work on `Json`
    // (`descriptionText`/`bodyText` are kept in step on every write).
    case "title":
    case "description":
    case "comment": {
      const piece = typeof value === "string" ? value.trim() : "";
      if (!piece) return null;
      const match = { contains: piece, mode: "insensitive" as const };
      if (field === "title") return { title: match };
      if (field === "description") return { descriptionText: match };
      return { comments: { some: { bodyText: match } } };
    }

    case "text": {
      const q = typeof value === "string" ? value.trim() : "";
      if (!q) return null;
      // "By title or ID": full-text matches, plus the issue number itself.
      const key = issueKeyOf(q);
      const ids = await ctx.searchIds(q);
      return {
        OR: [{ id: { in: ids } }, ...(key !== undefined ? [{ key }] : [])],
      };
    }
  }
}

/** A rule or a group — groups nest, each joining its parts with AND or OR.
 *  A part that yields nothing (no values) drops out. */
async function nodeWhere(
  node: FilterNode,
  ctx: FilterContext,
): Promise<Where | null> {
  if (!isGroup(node)) return ruleWhere(node, ctx);
  const parts = (
    await Promise.all(node.rules.map((child) => nodeWhere(child, ctx)))
  ).filter((w): w is Where => w !== null);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return node.op === "or" ? { OR: parts } : { AND: parts };
}

/**
 * A filter tree as a Prisma `where` for `Issue` — the one path every board,
 * list and saved view queries through (BARY-162).
 *
 * The result is a single `AND`, so the caller can put its own scope
 * (project, visible projects, `parentId: null`) next to it without either
 * side overwriting the other's keys.
 */
export async function toIssueWhere(
  filter: IssueFilter,
  ctx: FilterContext,
): Promise<Where> {
  const parts = (
    await Promise.all(filter.rules.map((node) => nodeWhere(node, ctx)))
  ).filter((w): w is Where => w !== null);
  return parts.length ? { AND: parts } : {};
}
