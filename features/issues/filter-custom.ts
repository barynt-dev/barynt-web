// ─── Custom fields in the filter tree (BARY-196) ───────────────────────────
//
// A rule on a custom field names it as `cf:<fieldId>` (`filter.ts`). The
// tree's schema can't know the field's type, so this decides what a rule
// means for it: which operators it offers, and whether a stored value
// satisfies a rule. No dependencies — runs in the client (editor, chips),
// the server (`filter-where.ts`) and the tests alike.

import type {
  CustomFieldType,
  DateMode,
  FieldValue,
} from "@/lib/custom-fields";
import {
  type FilterOp,
  type FilterRule,
  ME,
  NONE_VALUE,
  RELATIVE_DATES,
  type RelativeDate,
} from "./filter";

/** What a rule needs to know about its field. */
export interface CustomFilterFieldShape {
  type: CustomFieldType;
  dateMode: DateMode;
}

/** A checkbox's two answers, as the values of an `any` rule. */
export const CHECKBOX_YES = "yes";
export const CHECKBOX_NO = "no";

/**
 * The operators a field offers, in the order people reach for them. A time
 * of day has nothing to be "before" or "overdue" by — only set or not.
 */
export function customFilterOps(field: CustomFilterFieldShape): FilterOp[] {
  switch (field.type) {
    case "SELECT":
    case "USER":
      return ["any", "none", "empty", "notEmpty"];
    case "MULTI_SELECT":
      return ["any", "none", "all", "empty", "notEmpty"];
    case "CHECKBOX":
      return ["any"];
    case "NUMBER":
      return ["gte", "lte", "empty", "notEmpty"];
    case "DATE":
      return field.dateMode === "TIME"
        ? ["empty", "notEmpty"]
        : ["within", "before", "after", "empty", "notEmpty"];
    case "TEXT":
    case "URL":
      return ["contains", "empty", "notEmpty"];
  }
}

/** Fields with a list of answers to tick — the ones that get a chip. */
export function hasChoiceList(field: Pick<CustomFilterFieldShape, "type">) {
  return (
    field.type === "SELECT" ||
    field.type === "MULTI_SELECT" ||
    field.type === "USER" ||
    field.type === "CHECKBOX"
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` of a moment in local time — the convention the due date's
 *  ranges follow (`filter-where.ts`). */
function dayString(date: Date, plusDays = 0): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + plusDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `[from, to)` of a relative range as days — either end may be open. */
function relativeDays(
  token: RelativeDate,
  now: Date,
): { from?: string; to?: string } {
  const today = dayString(now);
  switch (token) {
    case "overdue":
      return { to: today };
    case "today":
      return { from: today, to: dayString(now, 1) };
    case "next_7_days":
      return { from: today, to: dayString(now, 7) };
    case "last_7_days":
      return { from: dayString(now, -6), to: dayString(now, 1) };
    case "last_30_days":
      return { from: dayString(now, -29), to: dayString(now, 1) };
  }
}

function isEmptyValue(value: FieldValue | null): boolean {
  return (
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * A test for a field's stored value (`null` when the issue has none) — or
 * `null` when the rule constrains nothing: no values left, an operator the
 * field doesn't offer, a value of the wrong shape. Such a rule drops out
 * and widens the result, the same as a built-in one (`filter-where.ts`).
 *
 * "Is not" keeps the issues without a value, like "assignee is not Mara"
 * keeps the unassigned — unless "not set" is among what's excluded.
 */
export function customRuleTest(
  field: CustomFilterFieldShape,
  rule: Pick<FilterRule, "is" | "value">,
  ctx: { userId: string | null; now: Date },
): ((value: FieldValue | null) => boolean) | null {
  const { is, value } = rule;
  if (!customFilterOps(field).includes(is)) return null;

  if (is === "empty") return isEmptyValue;
  if (is === "notEmpty") return (v) => !isEmptyValue(v);

  if (is === "any" || is === "none" || is === "all") {
    const raw = Array.isArray(value) ? value.map(String) : [];
    const unset = raw.includes(NONE_VALUE);
    const wanted = raw.flatMap((v) =>
      v === NONE_VALUE ? [] : v === ME ? (ctx.userId ? [ctx.userId] : []) : [v],
    );
    if (!wanted.length && !unset) return null;

    if (field.type === "CHECKBOX") {
      // Unticked and never touched read the same: "no".
      const yes = wanted.includes(CHECKBOX_YES);
      const no = wanted.includes(CHECKBOX_NO);
      if (yes === no) return null;
      return yes ? (v) => v === true : (v) => v !== true;
    }

    const has = (v: FieldValue | null, one: string) =>
      Array.isArray(v) ? v.includes(one) : v === one;
    if (is === "all")
      return wanted.length ? (v) => wanted.every((w) => has(v, w)) : null;
    const anyOf = (v: FieldValue | null) =>
      (unset && isEmptyValue(v)) || wanted.some((w) => has(v, w));
    return is === "none" ? (v) => !anyOf(v) : anyOf;
  }

  if (is === "gte" || is === "lte") {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return (v) =>
      typeof v === "number" && (is === "gte" ? v >= value : v <= value);
  }

  if (is === "contains") {
    const needle = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!needle) return null;
    return (v) => typeof v === "string" && v.toLowerCase().includes(needle);
  }

  // Dates: the day part of what's stored — a date-time's instant included.
  const dayOf = (v: FieldValue | null) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)
      ? v.slice(0, 10)
      : null;

  if (is === "within") {
    if (!(RELATIVE_DATES as readonly unknown[]).includes(value)) return null;
    const { from, to } = relativeDays(value as RelativeDate, ctx.now);
    return (v) => {
      const day = dayOf(v);
      return (
        day !== null &&
        (from === undefined || day >= from) &&
        (to === undefined || day < to)
      );
    };
  }

  if (is === "before" || is === "after") {
    if (typeof value !== "string") return null;
    const at = value === "today" ? dayString(ctx.now) : value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return null;
    // The day itself belongs to neither side, as for the due date.
    return (v) => {
      const day = dayOf(v);
      return day !== null && (is === "before" ? day < at : day > at);
    };
  }

  return null;
}
