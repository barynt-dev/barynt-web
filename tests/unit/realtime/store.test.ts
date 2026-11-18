import { describe, expect, it } from "bun:test";
import {
  getLastChange,
  PLUGIN_DATA_KEEP_MS,
  PLUGIN_DATA_MAX,
  pluginDataChangesSince,
  recordPluginDataChange,
  recordProjectChange,
} from "@/lib/realtime/store";

describe("realtime store (BARY-26)", () => {
  it("returns null for a workspace with no recorded change", () => {
    expect(getLastChange("ws-never-changed")).toBeNull();
  });

  it("records the actor and a timestamp", () => {
    const before = Date.now();
    recordProjectChange("ws-a", "u1");
    const change = getLastChange("ws-a");

    expect(change).not.toBeNull();
    expect(change?.actorId).toBe("u1");
    expect(change?.at).toBeGreaterThanOrEqual(before);
  });

  it("keeps changes for different workspaces independent", () => {
    recordProjectChange("ws-b", "u1");
    recordProjectChange("ws-c", "u2");

    expect(getLastChange("ws-b")?.actorId).toBe("u1");
    expect(getLastChange("ws-c")?.actorId).toBe("u2");
  });

  it("only keeps the most recent change per workspace", () => {
    recordProjectChange("ws-d", "u1");
    recordProjectChange("ws-d", "u2");

    expect(getLastChange("ws-d")?.actorId).toBe("u2");
  });
});

describe("plugin data changes (BARY-225)", () => {
  const change = (issueId: string, pluginId = "ci") => ({
    pluginId,
    issueId,
    projectId: "p1",
  });

  it("answers what changed from a time on, by plugin and issue", () => {
    recordPluginDataChange("ws-p1", change("i1"), 1_000);
    recordPluginDataChange("ws-p1", change("i2", "other"), 2_000);
    expect(
      pluginDataChangesSince("ws-p1", 1_500).map((c) => [
        c.pluginId,
        c.issueId,
      ]),
    ).toEqual([["other", "i2"]]);
    expect(pluginDataChangesSince("ws-p1", 0)).toHaveLength(2);
    expect(pluginDataChangesSince("ws-never", 0)).toEqual([]);
  });

  it("keeps one entry per plugin and issue, the latest", () => {
    recordPluginDataChange("ws-p2", change("i1"), 1_000);
    recordPluginDataChange("ws-p2", change("i1"), 2_000);
    expect(pluginDataChangesSince("ws-p2", 0)).toEqual([
      { ...change("i1"), at: 2_000 },
    ]);
  });

  it("forgets old ones and keeps a busy workspace small", () => {
    recordPluginDataChange("ws-p3", change("old"), 1_000);
    recordPluginDataChange(
      "ws-p3",
      change("new"),
      1_000 + PLUGIN_DATA_KEEP_MS + 1,
    );
    expect(pluginDataChangesSince("ws-p3", 0).map((c) => c.issueId)).toEqual([
      "new",
    ]);
    for (let i = 0; i < PLUGIN_DATA_MAX + 10; i++)
      recordPluginDataChange("ws-p4", change(`i${i}`), 5_000 + i);
    const kept = pluginDataChangesSince("ws-p4", 0);
    expect(kept).toHaveLength(PLUGIN_DATA_MAX);
    expect(kept.at(-1)?.issueId).toBe(`i${PLUGIN_DATA_MAX + 9}`);
  });
});
