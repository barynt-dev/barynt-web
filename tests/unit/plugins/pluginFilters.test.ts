import { describe, expect, it } from "bun:test";
import { parseIssueFilter } from "@/features/issues/filter";
import {
  filterToParams,
  parseFilterParams,
} from "@/features/issues/filter-url";
import {
  type FilterContext,
  toIssueWhere,
} from "@/features/issues/filter-where";
import {
  filterOptions,
  matchTerms,
  type PluginFilterDef,
  valuesAt,
} from "@/lib/plugins/filters";
import { validateManifest } from "@/lib/plugins/manifest";

// A plugin's filters in Barynt's filter menu (BARY-238): declared in the
// manifest, matched against what it keeps on issues.

const pr = (issueId: string, state: string, review: string | null = null) => ({
  issueId,
  value: { kind: "pull_request", state, review, repo: "acme/web" },
});
const checks = (issueId: string, state: string, names: string[]) => ({
  issueId,
  value: {
    kind: "checks",
    state,
    runs: names.map((name) => ({ name, state })),
  },
});

const status: PluginFilterDef = {
  id: "pr-status",
  title: "PR status",
  kind: "pull_request",
  options: [
    {
      id: "approved",
      label: "Approved",
      when: { state: "open", review: "approved" },
    },
    {
      id: "open",
      label: "Open, no review",
      when: { state: "open", review: null },
    },
    { id: "done", label: "Done", when: { state: ["merged", "closed"] } },
    { id: "none", label: "Without", absent: true },
  ],
};
const action: PluginFilterDef = {
  id: "action",
  title: "Action",
  kind: "checks",
  values: { field: "runs.name" },
};

const entries = [
  pr("i1", "open", "approved"),
  pr("i2", "open"),
  pr("i3", "merged"),
  checks("i1", "failure", ["build", "test"]),
  checks("i2", "success", ["lint"]),
];

describe("a plugin's filter, matched", () => {
  it("walks dotted paths through arrays", () => {
    expect(valuesAt(entries[3].value, "runs.name")).toEqual(["build", "test"]);
    expect(valuesAt({ a: { b: 1 } }, "a.b")).toEqual([1]);
    expect(valuesAt({ a: 1 }, "a.b")).toEqual([]);
  });

  it("takes the issues with an entry meeting the option's conditions", () => {
    expect(matchTerms(status, ["approved"], entries)).toEqual([
      { issueIds: ["i1"], except: false },
    ]);
    // `null` matches a missing review.
    expect(matchTerms(status, ["open"], entries)[0].issueIds).toEqual(["i2"]);
    expect(matchTerms(status, ["done"], entries)[0].issueIds).toEqual(["i3"]);
  });

  it("turns round for an option that wants none", () => {
    expect(matchTerms(status, ["none"], entries)).toEqual([
      { issueIds: ["i1", "i2", "i3"], except: true },
    ]);
  });

  it("drops an option it doesn't have", () => {
    expect(matchTerms(status, ["gone"], entries)).toEqual([]);
  });

  it("offers the values found, sorted, for a filter of values", () => {
    expect(filterOptions(action, entries)).toEqual([
      { id: "build", label: "build", found: true },
      { id: "lint", label: "lint", found: true },
      { id: "test", label: "test", found: true },
    ]);
    expect(matchTerms(action, ["lint"], entries)[0].issueIds).toEqual(["i2"]);
  });
});

describe("a filter with its own options and the values found", () => {
  const branches: PluginFilterDef = {
    id: "branch",
    title: "Branch",
    kind: "branch",
    options: [{ id: "none", label: "Without", absent: true }],
    values: {
      field: "name",
      label: "{name} ({repo})",
      when: { deleted: false },
    },
  };
  const found = [
    {
      issueId: "i1",
      value: {
        kind: "branch",
        name: "web-10",
        repo: "acme/web",
        deleted: false,
      },
    },
    {
      issueId: "i2",
      value: {
        kind: "branch",
        name: "web-9",
        repo: "acme/web",
        deleted: false,
      },
    },
    {
      issueId: "i3",
      value: { kind: "branch", name: "old", repo: "acme/web", deleted: true },
    },
  ];

  it("offers its own first, then the values — named, numbers in order, the gone ones left out", () => {
    expect(filterOptions(branches, found)).toEqual([
      { id: "none", label: "Without" },
      { id: "web-9", label: "web-9 (acme/web)", found: true },
      { id: "web-10", label: "web-10 (acme/web)", found: true },
    ]);
  });

  it("matches an option of its own, or a value", () => {
    expect(matchTerms(branches, ["web-9"], found)).toEqual([
      { issueIds: ["i2"], except: false },
    ]);
    // A deleted branch's name isn't one to pick.
    expect(matchTerms(branches, ["old"], found)[0].issueIds).toEqual([]);
    expect(matchTerms(branches, ["none"], found)[0].except).toBe(true);
  });
});

describe("a rule on a plugin's filter", () => {
  const ctx = (def: PluginFilterDef): FilterContext => ({
    userId: null,
    now: new Date(),
    statusIdsIn: async () => [],
    searchIds: async () => [],
    pluginFilter: async (pluginId, filterId) =>
      pluginId === "github" && filterId === def.id ? { def, entries } : null,
  });

  it("is checked: its field, any/none, option ids", () => {
    const ok = {
      op: "and",
      rules: [{ field: "pl:github:pr-status", is: "any", value: ["approved"] }],
    };
    expect(parseIssueFilter(ok)).not.toBeNull();
    expect(
      parseIssueFilter({
        op: "and",
        rules: [{ field: "pl:github:pr-status", is: "gte", value: 3 }],
      }),
    ).toBeNull();
    expect(
      parseIssueFilter({
        op: "and",
        rules: [{ field: "pl:GitHub!:x", is: "any", value: ["a"] }],
      }),
    ).toBeNull();
  });

  it("goes through the URL and back", () => {
    const tree = parseFilterParams(
      new URLSearchParams(
        "pl.github.pr-status=approved,open&pl.github.action.not=lint",
      ),
    );
    expect(tree.rules).toEqual([
      { field: "pl:github:pr-status", is: "any", value: ["approved", "open"] },
      { field: "pl:github:action", is: "none", value: ["lint"] },
    ]);
    expect(new URLSearchParams(filterToParams(tree)).toString()).toBe(
      "pl.github.pr-status=approved%2Copen&pl.github.action.not=lint",
    );
  });

  it("becomes a where: the matching issues — every other one with is not", async () => {
    const any = await toIssueWhere(
      {
        op: "and",
        rules: [
          {
            field: "pl:github:pr-status",
            is: "any",
            value: ["approved", "none"],
          },
        ],
      },
      ctx(status),
    );
    expect(any).toEqual({
      AND: [
        {
          OR: [{ id: { in: ["i1"] } }, { id: { notIn: ["i1", "i2", "i3"] } }],
        },
      ],
    });
    const none = await toIssueWhere(
      {
        op: "and",
        rules: [{ field: "pl:github:pr-status", is: "none", value: ["done"] }],
      },
      ctx(status),
    );
    expect(none).toEqual({ AND: [{ NOT: { id: { in: ["i3"] } } }] });
  });

  it("drops out for a filter that's gone", async () => {
    const where = await toIssueWhere(
      {
        op: "and",
        rules: [{ field: "pl:github:gone", is: "any", value: ["x"] }],
      },
      ctx(status),
    );
    // Nothing to narrow by.
    expect(where).toEqual({});
  });
});

describe("filters in a manifest", () => {
  const base = {
    id: "ci-filters",
    name: "CI filters",
    version: "1.0.0",
    minBaryntVersion: "0.1.0",
    author: "Acme GmbH",
    description: { short: "Filters for CI." },
    license: "MIT",
    kind: "declarative",
    levels: ["project"],
    capabilities: [],
    network: [],
  };
  const errors = (filters: unknown) => {
    const r = validateManifest({ ...base, contributes: { filters } });
    return r.ok ? [] : r.errors;
  };

  it("takes options, values or both — no capability needed", () => {
    expect(
      errors([
        {
          id: "ci",
          title: "CI",
          kind: "checks",
          values: { field: "runs.name" },
        },
      ]),
    ).toEqual([]);
    expect(
      errors([
        {
          id: "ci",
          title: "CI",
          kind: "checks",
          options: [{ id: "red", label: "Red", when: { state: "failure" } }],
        },
      ]),
    ).toEqual([]);
    expect(errors([{ id: "ci", title: "CI", kind: "checks" }])).not.toEqual([]);
    expect(
      errors([
        {
          id: "ci",
          title: "CI",
          kind: "checks",
          values: { field: "a..b" },
        },
      ]),
    ).not.toEqual([]);
  });
});
