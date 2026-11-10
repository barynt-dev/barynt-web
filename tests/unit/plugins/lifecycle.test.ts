import { describe, expect, it } from "bun:test";
import {
  activationState,
  allowsLevel,
  confirmsExactly,
  pendingCapabilities,
  rollbackTarget,
  unblockTarget,
  type VersionRow,
} from "@/lib/plugins/lifecycle";

const v = (version: string, status: VersionRow["status"]): VersionRow => ({
  version,
  status,
});

describe("confirmation", () => {
  it("must be exactly what's asked, order aside", () => {
    expect(confirmsExactly(["a", "b"], ["b", "a"])).toBe(true);
    expect(confirmsExactly(["a", "b"], ["a"])).toBe(false);
    expect(confirmsExactly(["a"], ["a", "b"])).toBe(false);
    expect(confirmsExactly([], [])).toBe(true);
  });

  it("names what an update added", () => {
    expect(pendingCapabilities(["a", "b", "c"], ["a"])).toEqual(["b", "c"]);
    expect(pendingCapabilities(["a"], ["a", "b"])).toEqual([]);
  });
});

describe("activationState", () => {
  const on = { enabled: true, capabilities: ["issues:read"] };
  it("runs with what was confirmed", () => {
    expect(activationState(on, [v("1.0.0", "active")], ["issues:read"])).toBe(
      "active",
    );
  });

  it("waits for confirmation after an update asked for more", () => {
    expect(
      activationState(
        on,
        [v("1.0.0", "superseded"), v("1.1.0", "active")],
        ["issues:read", "issues:write"],
      ),
    ).toBe("needsConfirmation");
  });

  it("reports blocked before anything else", () => {
    expect(activationState(on, [v("1.0.0", "blocked")], null)).toBe("blocked");
  });

  it("knows a switched-off and an uninstalled plugin", () => {
    expect(
      activationState(
        { ...on, enabled: false },
        [v("1.0.0", "active")],
        ["issues:read"],
      ),
    ).toBe("disabled");
    expect(activationState(on, [], null)).toBe("notInstalled");
  });
});

describe("rollback and unblock", () => {
  it("goes back to the newest older version", () => {
    expect(
      rollbackTarget([
        v("1.0.0", "superseded"),
        v("1.2.0", "superseded"),
        v("1.3.0", "active"),
      ]),
    ).toBe("1.2.0");
  });

  it("never 'rolls back' to a newer version", () => {
    // After a rollback the newer one is superseded too.
    expect(
      rollbackTarget([v("1.3.0", "superseded"), v("1.2.0", "active")]),
    ).toBe(null);
  });

  it("has nowhere to go without an active or an older version", () => {
    expect(rollbackTarget([v("1.0.0", "active")])).toBe(null);
    expect(rollbackTarget([v("1.0.0", "superseded")])).toBe(null);
  });

  it("unblocks the newest blocked version", () => {
    expect(
      unblockTarget([v("1.0.0", "superseded"), v("1.1.0", "blocked")]),
    ).toBe("1.1.0");
    expect(unblockTarget([v("1.0.0", "active")])).toBe(null);
  });
});

describe("allowsLevel", () => {
  it("follows the manifest's levels", () => {
    expect(allowsLevel(["project"], { projectId: "p1" })).toBe(true);
    expect(allowsLevel(["project"], {})).toBe(false);
    expect(allowsLevel(["workspace"], { projectId: null })).toBe(true);
  });
});
