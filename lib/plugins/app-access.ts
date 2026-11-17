import type { ApiScope } from "../api/scopes";
import type { Permission } from "../rbac";

// What a plugin's bot may do (BARY-213): its confirmed capabilities, turned
// into Barynt's permissions and the API scopes of its token. Deliberately
// narrow — a bot never manages anything (roles, members, settings, plugins),
// whatever it asked for. No dependencies.

/**
 * Where a plugin may act (BARY-213/214): its activation's workspace, or just
 * one project, and the capabilities confirmed there. A bot's only source of
 * rights; for a token acting for a person, the frame those rights are cut
 * down to.
 */
export interface AppScope {
  workspaceId: string;
  projectId: string | null;
  capabilities: string[];
}

/** Capabilities that let it read anything in a project at all. */
const SEES_PROJECT = [
  "issues:read",
  "issues:write",
  "comments:read",
  "comments:write",
  "labels:read",
  "projects:read",
  "members:read",
  "fields:read",
  "fields:write",
];

/** Its permissions in a project, or — `WORKSPACE` — in the workspace. */
export function appPermissions(
  capabilities: readonly string[],
  scope: "WORKSPACE" | "PROJECT",
): Set<Permission> {
  const has = (cap: string) => capabilities.includes(cap);
  const granted = new Set<Permission>();
  if (scope === "WORKSPACE") {
    if (has("members:read")) granted.add("member.view");
    return granted;
  }
  if (SEES_PROJECT.some(has)) granted.add("project.view");
  if (has("issues:write")) {
    granted.add("issue.create");
    granted.add("issue.update.any");
    granted.add("issue.assign");
  }
  // A custom field's value is written by changing the issue.
  if (has("fields:write")) granted.add("issue.update.any");
  if (has("comments:write")) {
    granted.add("comment.create");
    granted.add("comment.update.own");
    granted.add("comment.delete.own");
  }
  return granted;
}

/** The API scopes of its token — the same capabilities, as the REST API
 *  names them. It can always find its workspace and projects. */
export function appApiScopes(capabilities: readonly string[]): ApiScope[] {
  const scopes = new Set<ApiScope>(["workspaces:read", "projects:read"]);
  const map: Record<string, ApiScope> = {
    "issues:read": "issues:read",
    "issues:write": "issues:write",
    "comments:read": "comments:read",
    "comments:write": "comments:write",
    "labels:read": "labels:read",
    "members:read": "members:read",
  };
  for (const cap of capabilities) if (map[cap]) scopes.add(map[cap]);
  // Writing needs reading what it writes to.
  if (scopes.has("issues:write")) scopes.add("issues:read");
  if (scopes.has("comments:write")) scopes.add("comments:read");
  return [...scopes];
}
