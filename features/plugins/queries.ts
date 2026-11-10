import "server-only";
import { db } from "@/lib/db";
import { hasPermission, PLATFORM } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import {
  type ActivationState,
  activationState,
  pendingCapabilities,
  rollbackTarget,
} from "@/lib/plugins/lifecycle";
import { type PluginManifest, validateManifest } from "@/lib/plugins/manifest";
import { compareSemver } from "@/lib/plugins/semver";

// What the plugin pages show (BARY-143). Every view checks its own
// permission and answers `null` without it — the page then 404s; a hidden
// nav entry is no access control.

export interface PluginSummary {
  pluginId: string;
  name: string;
  author: string;
  authorUrl: string | null;
  description: string;
  kind: string;
  levels: string[];
  capabilities: string[];
  network: string[];
}

function summaryOf(pluginId: string, manifest: unknown): PluginSummary {
  const parsed = validateManifest(manifest);
  const m: Partial<PluginManifest> = parsed.ok ? parsed.manifest : {};
  return {
    pluginId,
    name: m.name ?? pluginId,
    author: m.author ?? "",
    authorUrl: m.authorUrl ?? null,
    description: m.description ?? "",
    kind: m.kind ?? "",
    levels: m.levels ?? [],
    capabilities: m.capabilities ?? [],
    network: m.network ?? [],
  };
}

type Row = {
  pluginId: string;
  version: string;
  status: "active" | "superseded" | "blocked";
  manifest: unknown;
  installedAt: Date;
  sourceId: string | null;
};

/** One entry per plugin: its current version (active or blocked) first. */
function byPlugin(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows)
    groups.set(row.pluginId, [...(groups.get(row.pluginId) ?? []), row]);
  return [...groups.values()].map((versions) => {
    versions.sort((a, b) => compareSemver(b.version, a.version));
    const current =
      versions.find((v) => v.status === "active") ??
      versions.find((v) => v.status === "blocked") ??
      null;
    return { versions, current };
  });
}

// ─── Platform ───────────────────────────────────────────────────────────────

export interface PluginSourceRow {
  id: string;
  name: string;
  url: string;
  /** `lib/plugins/git-hosts` — github, gitlab, gitea, bitbucket, https. */
  provider: string;
  ref: string | null;
  enabled: boolean;
  private: boolean;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

export interface InstalledPlugin extends PluginSummary {
  version: string | null;
  blocked: boolean;
  versions: { version: string; status: string; installedAt: Date }[];
  sourceId: string | null;
  /** The version a rollback would return to. */
  rollbackTo: string | null;
  /** Where it's switched on. */
  activations: number;
}

export interface AdminPluginsView {
  sources: PluginSourceRow[];
  installed: InstalledPlugin[];
}

export async function getAdminPluginsView(): Promise<AdminPluginsView | null> {
  if (!(await hasPermission("plugin.manage", PLATFORM))) return null;
  const [sources, rows, counts] = await Promise.all([
    db.pluginSource.findMany({ orderBy: { createdAt: "asc" } }),
    db.plugin.findMany(),
    db.pluginActivation.groupBy({
      by: ["pluginId"],
      where: { enabled: true },
      _count: { _all: true },
    }),
  ]);
  return {
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      provider: s.provider,
      ref: s.ref,
      enabled: s.enabled,
      private: !!s.tokenCipher,
      lastSyncAt: s.lastSyncAt,
      lastSyncError: s.lastSyncError,
    })),
    installed: byPlugin(rows as Row[])
      .map(({ versions, current }) => {
        const shown = current ?? versions[0];
        return {
          ...summaryOf(shown.pluginId, shown.manifest),
          version: current?.version ?? null,
          blocked: current?.status === "blocked",
          versions: versions.map((v) => ({
            version: v.version,
            status: v.status,
            installedAt: v.installedAt,
          })),
          sourceId: shown.sourceId,
          rollbackTo: rollbackTarget(versions),
          activations:
            counts.find((c) => c.pluginId === shown.pluginId)?._count._all ?? 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─── Workspace and project ──────────────────────────────────────────────────

export interface ScopePlugin extends PluginSummary {
  version: string | null;
  /** Switched on here, and how it stands; `null` when it never was. */
  activation: {
    state: ActivationState;
    /** Capabilities an update added that wait for a confirmation. */
    pending: string[];
  } | null;
  /** Workspace only: the projects may switch it on themselves. */
  granted?: boolean;
  /** Workspace only: how many of its projects have it on. */
  projectsOn?: number;
  /** Whether it can be switched on at this level at all. */
  offered: boolean;
}

export interface ScopePluginsView {
  plugins: ScopePlugin[];
}

async function scopePlugins(scope: {
  workspaceId: string;
  projectId: string | null;
}): Promise<ScopePlugin[]> {
  const level = scope.projectId ? "project" : "workspace";
  const [rows, activations, grants, projectCounts] = await Promise.all([
    db.plugin.findMany({ where: { status: { in: ["active", "blocked"] } } }),
    db.pluginActivation.findMany({
      where: { scopeKey: activationScopeKey(scope) },
    }),
    db.pluginGrant.findMany({ where: { workspaceId: scope.workspaceId } }),
    scope.projectId
      ? Promise.resolve([])
      : db.pluginActivation.groupBy({
          by: ["pluginId"],
          where: {
            workspaceId: scope.workspaceId,
            projectId: { not: null },
            enabled: true,
          },
          _count: { _all: true },
        }),
  ]);
  const granted = new Set(grants.map((g) => g.pluginId));
  const groups = byPlugin(rows as Row[]);
  const ids = new Set([
    ...groups.map((g) => g.versions[0].pluginId),
    ...activations.map((a) => a.pluginId),
  ]);

  const out: ScopePlugin[] = [];
  for (const pluginId of ids) {
    const group = groups.find((g) => g.versions[0].pluginId === pluginId);
    const activation = activations.find((a) => a.pluginId === pluginId);
    const summary = group
      ? summaryOf(
          pluginId,
          group.current?.manifest ?? group.versions[0].manifest,
        )
      : summaryOf(pluginId, null);
    const blocked = group?.current?.status === "blocked";
    const offered =
      !blocked &&
      summary.levels.includes(level) &&
      (level === "workspace" || granted.has(pluginId));
    // A project sees only what it may switch on — or still holds data of.
    // The workspace also sees what it can release for its projects.
    const relevant =
      activation ||
      offered ||
      (level === "workspace" && summary.levels.includes("project"));
    if (!relevant) continue;
    const versions = group?.versions ?? [];
    out.push({
      ...summary,
      version: group?.current?.version ?? null,
      offered,
      activation: activation
        ? {
            state: activationState(
              activation,
              versions,
              group?.current?.status === "active" ? summary.capabilities : null,
            ),
            pending: pendingCapabilities(
              summary.capabilities,
              activation.capabilities,
            ),
          }
        : null,
      ...(level === "workspace" && {
        granted: granted.has(pluginId),
        projectsOn:
          projectCounts.find((c) => c.pluginId === pluginId)?._count._all ?? 0,
      }),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getWorkspacePluginsView(
  workspaceId: string,
): Promise<ScopePluginsView | null> {
  if (!(await hasPermission("plugin.enable", { workspaceId }))) return null;
  return { plugins: await scopePlugins({ workspaceId, projectId: null }) };
}

export async function getProjectPluginsView(
  projectId: string,
): Promise<(ScopePluginsView & { workspaceId: string }) | null> {
  if (!(await hasPermission("plugin.enable", { projectId }))) return null;
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return null;
  return {
    workspaceId: project.workspaceId,
    plugins: await scopePlugins({
      workspaceId: project.workspaceId,
      projectId,
    }),
  };
}
