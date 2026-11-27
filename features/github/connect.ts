import "server-only";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { GitHubAccount } from "@/lib/github/state";
import { pluginSettingsPath } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import { validateManifest } from "@/lib/plugins/manifest";

// Connecting a workspace or project to GitHub (BARY-238): who may, and
// keeping the connection. The round at GitHub is in `app/api/github/*`.

export interface ConnectTarget {
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  scopeKey: string;
  /** The plugin's settings page there. */
  back: string;
  pluginName: string;
}

/**
 * Where a person may connect: the plugin is installed and connects to
 * GitHub, is released for the workspace (or on there), and the person may
 * manage plugins in that place (`plugin.enable`). `null` otherwise.
 */
export async function connectTarget(
  userId: string,
  input: { pluginId: string; workspaceId: string; projectId: string | null },
): Promise<ConnectTarget | null> {
  const { pluginId, workspaceId } = input;
  let projectSlug: string | null = null;
  if (input.projectId) {
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      select: { workspaceId: true, slug: true },
    });
    if (!project || project.workspaceId !== workspaceId) return null;
    projectSlug = project.slug;
    if (!(await can(userId, "plugin.enable", { projectId: input.projectId })))
      return null;
  } else if (!(await can(userId, "plugin.enable", { workspaceId })))
    return null;

  const [row, grant, activation] = await Promise.all([
    db.plugin.findFirst({
      where: { pluginId, status: "active" },
      select: { manifest: true },
    }),
    db.pluginGrant.findUnique({
      where: { pluginId_workspaceId: { pluginId, workspaceId } },
      select: { pluginId: true },
    }),
    db.pluginActivation.findUnique({
      where: {
        pluginId_scopeKey: {
          pluginId,
          scopeKey: activationScopeKey({ workspaceId, projectId: null }),
        },
      },
      select: { enabled: true },
    }),
  ]);
  const parsed = row ? validateManifest(row.manifest) : null;
  if (!parsed?.ok) return null;
  if (
    !parsed.manifest.contributes.connections?.some(
      (c) => c.provider === "github",
    )
  )
    return null;
  if (!grant && !activation?.enabled) return null;
  return {
    pluginId,
    workspaceId,
    projectId: input.projectId,
    scopeKey: activationScopeKey(input),
    back: pluginSettingsPath(workspaceId, projectSlug, pluginId),
    pluginName: parsed.manifest.name,
  };
}

/** Keeps the connection — again is fine — and notes it in the audit log. */
export async function saveConnection(
  target: ConnectTarget,
  account: GitHubAccount,
  userId: string,
): Promise<void> {
  await db.pluginConnection.upsert({
    where: {
      pluginId_scopeKey_installationId: {
        pluginId: target.pluginId,
        scopeKey: target.scopeKey,
        installationId: account.id,
      },
    },
    create: {
      pluginId: target.pluginId,
      provider: "github",
      workspaceId: target.workspaceId,
      projectId: target.projectId,
      scopeKey: target.scopeKey,
      installationId: account.id,
      account: account.account,
      accountType: account.accountType,
      accountAvatar: account.avatar,
      connectedById: userId,
    },
    update: {
      account: account.account,
      accountType: account.accountType,
      accountAvatar: account.avatar,
    },
  });
  await recordAudit({
    action: "plugin.connection.added",
    actorId: userId,
    target: { type: "plugin", id: target.pluginId, label: target.pluginName },
    workspaceId: target.workspaceId,
    ...(target.projectId && { projectId: target.projectId }),
    meta: { provider: "github", account: account.account },
  });
}
