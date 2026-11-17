import { describe, expect, it } from "bun:test";
import { appApiScopes, appPermissions } from "@/lib/plugins/app-access";

describe("appPermissions() (BARY-213)", () => {
  it("lets a bot see a project once it may read or write anything there", () => {
    expect([...appPermissions(["labels:read"], "PROJECT")]).toEqual([
      "project.view",
    ]);
    expect(appPermissions(["ui:issue-panel"], "PROJECT").size).toBe(0);
  });

  it("turns writing into creating and changing, never deleting", () => {
    const p = appPermissions(["issues:write", "comments:write"], "PROJECT");
    expect(p.has("issue.create")).toBe(true);
    expect(p.has("issue.update.any")).toBe(true);
    expect(p.has("comment.create")).toBe(true);
    expect(p.has("comment.update.own")).toBe(true);
    expect(p.has("issue.delete.any")).toBe(false);
    expect(p.has("comment.delete.any")).toBe(false);
  });

  it("gives the workspace nothing but seeing members", () => {
    expect([
      ...appPermissions(
        ["members:read", "issues:write", "storage:own"],
        "WORKSPACE",
      ),
    ]).toEqual(["member.view"]);
  });
});

describe("appApiScopes()", () => {
  const sorted = (list: readonly string[]) => [...list].sort();

  it("maps capabilities to the token's scopes, reading what it writes", () => {
    expect(sorted(appApiScopes(["issues:write", "comments:write"]))).toEqual(
      sorted([
        "comments:read",
        "comments:write",
        "issues:read",
        "issues:write",
        "projects:read",
        "workspaces:read",
      ]),
    );
    expect(sorted(appApiScopes(["ui:action"]))).toEqual(
      sorted(["projects:read", "workspaces:read"]),
    );
  });
});
