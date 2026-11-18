import { beforeEach, describe, expect, it, mock } from "bun:test";

// The poll for what plugins' servers changed on issues (BARY-225): it starts
// from the server's clock and only names issues of projects one may see.

let userId: string | null = "u1";
let canEnter = true;
mock.module("@/lib/permissions", () => ({
  currentUserId: async () => userId,
  currentUserCanEnterWorkspace: async () => canEnter,
  accessibleProjectIds: async () => new Set(["p1"]),
}));

import { GET } from "@/app/api/workspaces/[id]/plugin-data/route";
import { recordPluginDataChange } from "@/lib/realtime/store";

const poll = async (since?: number) => {
  const url = `http://x/api/workspaces/ws-r/plugin-data${since ? `?since=${since}` : ""}`;
  const res = await GET(new Request(url), {
    params: Promise.resolve({ id: "ws-r" }),
  });
  return {
    status: res.status,
    body: res.status === 200 ? await res.json() : null,
  };
};

describe("GET /api/workspaces/[id]/plugin-data", () => {
  beforeEach(() => {
    userId = "u1";
    canEnter = true;
  });

  it("answers only the time to start from, at first", async () => {
    recordPluginDataChange("ws-r", {
      pluginId: "ci",
      issueId: "i0",
      projectId: "p1",
    });
    const { body } = await poll();
    expect(body.changes).toEqual([]);
    expect(body.at).toBeGreaterThan(0);
  });

  it("names what changed since, in projects one may see", async () => {
    const { body: start } = await poll();
    recordPluginDataChange("ws-r", {
      pluginId: "ci",
      issueId: "i1",
      projectId: "p1",
    });
    recordPluginDataChange("ws-r", {
      pluginId: "ci",
      issueId: "i2",
      projectId: "p2",
    });
    const { body } = await poll(start.at);
    // From `since` on, inclusive: an entry of that very millisecond may come too.
    expect(body.changes).toContainEqual({ pluginId: "ci", issueId: "i1" });
    expect(body.changes).not.toContainEqual({ pluginId: "ci", issueId: "i2" });
  });

  it("needs a session and the workspace", async () => {
    userId = null;
    expect((await poll()).status).toBe(401);
    userId = "u1";
    canEnter = false;
    expect((await poll()).status).toBe(404);
  });
});
