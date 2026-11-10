import "server-only";
import {
  pluginRepo,
  readSourceRecent,
  sourceRepo,
} from "@/features/plugins/directory";
import { db } from "@/lib/db";
import { hasPermission, PLATFORM } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import type { DirectoryEntry } from "@/lib/plugins/directory";
import { releasePageUrl, repoUrl } from "@/lib/plugins/git-hosts";
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
  /** Screenshots, served from the installed version (BARY-199). */
  previews: { title: string; src: string }[];
}

/** Where an installed version's preview image is served. */
export const previewUrl = (rowId: string, file: string) =>
  `/api/plugin-previews/${rowId}/${file}`;

function summaryOf(
  pluginId: string,
  manifest: unknown,
  rowId?: string,
): PluginSummary {
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
    previews: rowId
      ? (m.previews ?? []).map(({ file, title }) => ({
          title,
          src: previewUrl(rowId, file),
        }))
      : [],
  };
}

type Row = {
  id: string;
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
          ...summaryOf(shown.pluginId, shown.manifest, shown.id),
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
          (group.current ?? group.versions[0]).manifest,
          (group.current ?? group.versions[0]).id,
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

// ─── The store (BARY-200) ───────────────────────────────────────────────────

/** Where a plugin can be had: the first enabled source that lists it. */
export interface StoreListing {
  sourceId: string;
  sourceName: string;
  /** Every version the source lists, newest first. */
  versions: string[];
  /** The repository's page, for "where the code comes from". */
  repoUrl: string | null;
  /** Per listed version, its release page on the Git host (if it has one). */
  releaseUrls: Record<string, string>;
}

/** One plugin in the store: installed, listed, or both. */
export interface StoreEntry {
  id: string;
  name: string;
  author: string;
  description: string;
  kind: string;
  levels: string[];
  installed: InstalledPlugin | null;
  listing: StoreListing | null;
  /** The newest listed version above the installed one, if any. */
  update: string | null;
}

export interface StoreView {
  sources: PluginSourceRow[];
  entries: StoreEntry[];
  /** Sources whose directory couldn't be read just now. */
  unreadable: { sourceId: string; error: string }[];
}

/**
 * The admin store: what's installed next to what the enabled sources list.
 * The directories are read through `readSourceRecent`, so a visit costs at
 * most one request per source every few minutes. `plugin.manage` only.
 */
export async function getPluginStoreView(): Promise<StoreView | null> {
  const admin = await getAdminPluginsView();
  if (!admin) return null;
  const stored = await db.pluginSource.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const reads = await Promise.all(
    stored.map(async (s) => ({
      source: s,
      read: await readSourceRecent(s.id),
    })),
  );

  const listings = new Map<string, StoreListing & { entry: DirectoryEntry }>();
  const unreadable: StoreView["unreadable"] = [];
  for (const { source, read } of reads) {
    if (!read.ok) {
      unreadable.push({ sourceId: source.id, error: read.error });
      continue;
    }
    const home = sourceRepo(source);
    for (const entry of read.entries) {
      if (listings.has(entry.id)) continue;
      const repo = home && pluginRepo(entry, home);
      const versions = Object.keys(entry.versions).sort((a, b) =>
        compareSemver(b, a),
      );
      const releaseUrls: Record<string, string> = {};
      for (const v of versions) {
        const url = repo && releasePageUrl(repo, v);
        if (url) releaseUrls[v] = url;
      }
      listings.set(entry.id, {
        entry,
        sourceId: source.id,
        sourceName: source.name,
        versions,
        repoUrl: repo ? repoUrl(repo) : null,
        releaseUrls,
      });
    }
  }

  const entries: StoreEntry[] = [];
  for (const installed of admin.installed) {
    const found = listings.get(installed.pluginId);
    const { entry: _, ...listing } = found ?? { entry: null };
    const newest = found?.versions[0] ?? null;
    entries.push({
      id: installed.pluginId,
      name: installed.name,
      author: installed.author,
      description: installed.description,
      kind: installed.kind,
      levels: installed.levels,
      installed,
      listing: found ? (listing as StoreListing) : null,
      update:
        newest &&
        installed.version &&
        compareSemver(newest, installed.version) > 0
          ? newest
          : null,
    });
  }
  for (const [id, found] of listings) {
    if (entries.some((e) => e.id === id)) continue;
    const { entry, ...listing } = found;
    entries.push({
      id,
      name: entry.name,
      author: entry.author,
      description: entry.description,
      kind: entry.kind,
      levels: entry.levels,
      installed: null,
      listing,
      update: null,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { sources: admin.sources, entries, unreadable };
}

/** A workspace, with where in it a plugin is switched on. */
export interface PluginPlace {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  /** Its projects may switch the plugin on. */
  granted: boolean;
  /** The workspace's own activation, if any. */
  state: ActivationState | null;
  projects: {
    projectId: string;
    name: string;
    color: string | null;
    state: ActivationState;
    by: string | null;
    at: Date;
  }[];
}

/** Every workspace that has the plugin on, released it for projects, or
 *  has projects with it on — for the store's "Where it's on". */
export async function getPluginPlaces(
  pluginId: string,
): Promise<PluginPlace[] | null> {
  if (!(await hasPermission("plugin.manage", PLATFORM))) return null;
  const [versions, activations, grants] = await Promise.all([
    db.plugin.findMany({
      where: { pluginId },
      select: { version: true, status: true, manifest: true },
    }),
    db.pluginActivation.findMany({
      where: { pluginId },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, name: true, color: true } },
        activatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { activatedAt: "asc" },
    }),
    db.pluginGrant.findMany({
      where: { pluginId },
      include: { workspace: { select: { id: true, name: true, slug: true } } },
    }),
  ]);
  const active = versions.find((v) => v.status === "active");
  const parsed = active ? validateManifest(active.manifest) : null;
  const capabilities = parsed?.ok ? parsed.manifest.capabilities : null;
  const stateOf = (a: { enabled: boolean; capabilities: string[] }) =>
    activationState(a, versions, capabilities);

  const places = new Map<string, PluginPlace>();
  const place = (w: { id: string; name: string; slug: string }) => {
    let p = places.get(w.id);
    if (!p) {
      p = {
        workspaceId: w.id,
        workspaceName: w.name,
        workspaceSlug: w.slug,
        granted: grants.some((g) => g.workspaceId === w.id),
        state: null,
        projects: [],
      };
      places.set(w.id, p);
    }
    return p;
  };
  for (const g of grants) place(g.workspace);
  for (const a of activations) {
    const p = place(a.workspace);
    if (!a.project) {
      p.state = stateOf(a);
      continue;
    }
    p.projects.push({
      projectId: a.project.id,
      name: a.project.name,
      color: a.project.color,
      state: stateOf(a),
      by: a.activatedBy
        ? `${a.activatedBy.firstName} ${a.activatedBy.lastName}`.trim()
        : null,
      at: a.activatedAt,
    });
  }
  return [...places.values()].sort((a, b) =>
    a.workspaceName.localeCompare(b.workspaceName),
  );
}
