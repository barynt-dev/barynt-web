import { describe, expect, it } from "bun:test";
import {
  type FilterRule,
  type IssueFilter,
  parseIssueFilter,
} from "@/features/issues/filter";
import {
  type CustomFilterFieldShape,
  customFilterOps,
  customRuleTest,
} from "@/features/issues/filter-custom";
import {
  filterToParams,
  idToSlug,
  mapFilterValues,
  parseFilterParams,
  slugToId,
} from "@/features/issues/filter-url";
import {
  type FilterContext,
  toIssueWhere,
} from "@/features/issues/filter-where";

// A Wednesday, mid-afternoon local time.
const NOW = new Date(2026, 9, 14, 15, 30);
const ctx = { userId: "me", now: NOW };

const shape = (
  type: CustomFilterFieldShape["type"],
  dateMode: CustomFilterFieldShape["dateMode"] = "DATE",
): CustomFilterFieldShape => ({ type, dateMode });

const test = (
  type: CustomFilterFieldShape["type"],
  rule: Pick<FilterRule, "is" | "value">,
) => customRuleTest(shape(type), rule, ctx);

describe("customFilterOps", () => {
  it("offers what suits each type", () => {
    expect(customFilterOps(shape("SELECT"))).toEqual([
      "any",
      "none",
      "empty",
      "notEmpty",
    ]);
    expect(customFilterOps(shape("MULTI_SELECT"))).toContain("all");
    expect(customFilterOps(shape("CHECKBOX"))).toEqual(["any"]);
    expect(customFilterOps(shape("NUMBER"))).toContain("gte");
    expect(customFilterOps(shape("TEXT"))).toContain("contains");
    expect(customFilterOps(shape("DATE"))).toContain("within");
    // A time of day has nothing to be "before".
    expect(customFilterOps(shape("DATE", "TIME"))).toEqual([
      "empty",
      "notEmpty",
    ]);
  });
});

describe("customRuleTest", () => {
  it("matches a choice, and keeps the empty ones for 'is not'", () => {
    const any = test("SELECT", { is: "any", value: ["o1"] });
    expect(any?.("o1")).toBe(true);
    expect(any?.("o2")).toBe(false);
    expect(any?.(null)).toBe(false);
    const none = test("SELECT", { is: "none", value: ["o1"] });
    expect(none?.("o1")).toBe(false);
    expect(none?.(null)).toBe(true);
  });

  it("reads 'not set' in the list", () => {
    const any = test("SELECT", { is: "any", value: ["_none"] });
    expect(any?.(null)).toBe(true);
    expect(any?.("o1")).toBe(false);
    const none = test("USER", { is: "none", value: ["_none"] });
    expect(none?.(null)).toBe(false);
    expect(none?.("u1")).toBe(true);
  });

  it("checks every value of a multi-choice", () => {
    const any = test("MULTI_SELECT", { is: "any", value: ["a", "b"] });
    expect(any?.(["b", "c"])).toBe(true);
    const all = test("MULTI_SELECT", { is: "all", value: ["a", "b"] });
    expect(all?.(["a", "c"])).toBe(false);
    expect(all?.(["a", "b", "c"])).toBe(true);
    const empty = test("MULTI_SELECT", { is: "empty" });
    expect(empty?.([])).toBe(true);
    expect(empty?.(null)).toBe(true);
  });

  it("resolves @me to whoever looks", () => {
    const mine = test("USER", { is: "any", value: ["@me"] });
    expect(mine?.("me")).toBe(true);
    expect(mine?.("u2")).toBe(false);
    expect(
      customRuleTest(
        shape("USER"),
        { is: "any", value: ["@me"] },
        { userId: null, now: NOW },
      ),
    ).toBeNull();
  });

  it("treats an untouched checkbox as 'no'", () => {
    const yes = test("CHECKBOX", { is: "any", value: ["yes"] });
    expect(yes?.(true)).toBe(true);
    expect(yes?.(null)).toBe(false);
    const no = test("CHECKBOX", { is: "any", value: ["no"] });
    expect(no?.(false)).toBe(true);
    expect(no?.(null)).toBe(true);
    // Both at once is no condition.
    expect(test("CHECKBOX", { is: "any", value: ["yes", "no"] })).toBeNull();
  });

  it("compares numbers", () => {
    const atLeast = test("NUMBER", { is: "gte", value: 5 });
    expect(atLeast?.(5)).toBe(true);
    expect(atLeast?.(4.5)).toBe(false);
    expect(atLeast?.(null)).toBe(false);
  });

  it("finds text regardless of case", () => {
    const has = test("TEXT", { is: "contains", value: "Acme" });
    expect(has?.("ACME Corp")).toBe(true);
    expect(has?.("Other")).toBe(false);
    expect(test("TEXT", { is: "contains", value: "  " })).toBeNull();
  });

  it("measures dates by their day, date-times included", () => {
    const overdue = test("DATE", { is: "within", value: "overdue" });
    expect(overdue?.("2026-10-13")).toBe(true);
    expect(overdue?.("2026-10-14")).toBe(false);
    const week = test("DATE", { is: "within", value: "next_7_days" });
    expect(week?.("2026-10-20")).toBe(true);
    expect(week?.("2026-10-21")).toBe(false);
    const before = test("DATE", { is: "before", value: "2026-10-14" });
    expect(before?.("2026-10-13T23:00:00.000Z")).toBe(true);
    expect(before?.("2026-10-14")).toBe(false);
  });

  it("drops a rule the field doesn't offer or without values", () => {
    expect(test("NUMBER", { is: "any", value: ["1"] })).toBeNull();
    expect(test("SELECT", { is: "any", value: [] })).toBeNull();
    expect(test("NUMBER", { is: "gte", value: "x" })).toBeNull();
  });
});

describe("toIssueWhere with custom fields", () => {
  const rows = [
    { issueId: "i1", value: "o1" },
    { issueId: "i2", value: "o2" },
  ];
  const fieldCtx: FilterContext = {
    userId: "me",
    now: NOW,
    statusIdsIn: async () => [],
    searchIds: async () => [],
    customFieldValues: async (id) =>
      id === "f1" ? { field: shape("SELECT"), rows } : null,
  };
  const where = (rule: FilterRule) =>
    toIssueWhere({ op: "and", rules: [rule] }, fieldCtx);

  it("names the matching issues", async () => {
    expect(await where({ field: "cf:f1", is: "any", value: ["o1"] })).toEqual({
      AND: [{ id: { in: ["i1"] } }],
    });
  });

  it("names the failing ones when an issue without a value matches", async () => {
    expect(await where({ field: "cf:f1", is: "none", value: ["o1"] })).toEqual({
      AND: [{ id: { notIn: ["i1"] } }],
    });
    expect(await where({ field: "cf:f1", is: "empty" })).toEqual({
      AND: [{ id: { notIn: ["i1", "i2"] } }],
    });
  });

  it("drops a rule on a field that's gone", async () => {
    expect(await where({ field: "cf:gone", is: "any", value: ["o1"] })).toEqual(
      {},
    );
  });

  it("drops custom rules without a lookup", async () => {
    const { customFieldValues: _, ...plain } = fieldCtx;
    expect(
      await toIssueWhere(
        { op: "and", rules: [{ field: "cf:f1", is: "any", value: ["o1"] }] },
        plain,
      ),
    ).toEqual({});
  });
});

describe("custom fields in the address", () => {
  const lookups = {
    priorities: [],
    members: [{ id: "u1", handle: "mara" }],
    labels: [],
    customFields: [
      { id: "f1", key: "customer", type: "SELECT" },
      { id: "f2", key: "owner", type: "USER" },
      { id: "f3", key: "points", type: "NUMBER" },
      { id: "f4", key: "notes", type: "TEXT" },
    ],
  };
  const read = (query: string): IssueFilter =>
    mapFilterValues(
      parseFilterParams(new URLSearchParams(query)),
      slugToId(lookups),
    );
  const write = (filter: IssueFilter) =>
    new URLSearchParams(
      filterToParams(mapFilterValues(filter, idToSlug(lookups))),
    ).toString();

  it("reads keys and handles into ids", () => {
    expect(
      read("cf.customer=o1,_none&cf.owner.not=mara,@me&cf.points.gte=5"),
    ).toEqual({
      op: "and",
      rules: [
        { field: "cf:f1", is: "any", value: ["o1", "_none"] },
        { field: "cf:f2", is: "none", value: ["u1", "@me"] },
        { field: "cf:f3", is: "gte", value: 5 },
      ],
    });
  });

  it("reads text, and drops a field that doesn't exist", () => {
    expect(read("cf.notes.contains=acme&cf.gone=x").rules).toEqual([
      { field: "cf:f4", is: "contains", value: "acme" },
    ]);
  });

  it("round-trips, inside an OR group too", () => {
    const query = "cf.customer.empty=1&or=cf.owner%3Amara%3Bcf.points.lte%3A3";
    const filter = read(query);
    expect(filter.rules[1]).toEqual({
      op: "or",
      rules: [
        { field: "cf:f2", is: "any", value: ["u1"] },
        { field: "cf:f3", is: "lte", value: 3 },
      ],
    });
    expect(write(filter)).toBe(query);
  });

  it("is a valid stored filter", () => {
    expect(
      parseIssueFilter(read("cf.customer=o1&cf.points.gte=5")),
    ).not.toBeNull();
    expect(
      parseIssueFilter({
        op: "and",
        rules: [{ field: "cf:", is: "any", value: ["x"] }],
      }),
    ).toBeNull();
  });
});
