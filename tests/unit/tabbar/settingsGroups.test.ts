import { describe, expect, it } from "bun:test";
import {
  ACCOUNT_SETTINGS_NAV,
  type NavEntry,
  PROJECT_SETTINGS_NAV,
  WORKSPACE_SETTINGS_NAV,
} from "@/lib/nav";

// The settings navs sort their sections under headings (`group`). A
// heading over a single section is no group, and a group split in two
// would show its heading twice.

const navs: [string, NavEntry[]][] = [
  ["account", ACCOUNT_SETTINGS_NAV],
  ["project", PROJECT_SETTINGS_NAV],
  ["workspace", WORKSPACE_SETTINGS_NAV],
];

describe("settings nav groups", () => {
  for (const [name, nav] of navs) {
    it(`${name}: every section has a group`, () => {
      expect(nav.filter((e) => !e.group)).toEqual([]);
    });

    it(`${name}: each group holds at least two sections, side by side`, () => {
      const runs: { group: string; count: number }[] = [];
      for (const e of nav) {
        const last = runs.at(-1);
        if (last && last.group === e.group) last.count++;
        else runs.push({ group: e.group ?? "", count: 1 });
      }
      const groups = runs.map((r) => r.group);
      expect(new Set(groups).size).toBe(groups.length);
      for (const run of runs) expect(run.count).toBeGreaterThanOrEqual(2);
    });

    it(`${name}: the start page comes first`, () => {
      expect(nav[0]?.section).toBe("");
    });
  }
});
