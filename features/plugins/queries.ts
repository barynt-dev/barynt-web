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
  /** What the directory says about it for the start page (BARY-200). */
  categories: string[];
  featured: boolean;
  /** Since when it's listed (`YYYY-MM-DD`), if the directory says. */
  added: string | null;
  /** Release notes per version, as the directory gives them. */
  notes: Record<string, string>;
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
 * What the enabled sources list, by plugin id — the first source that lists
 * a plugin wins. Read through `readSourceRecent`, so at most one request
 * per source every few minutes. No permission check: callers have theirs.
 */
async function readListings(): Promise<{
  listings: Map<string, StoreListing & { entry: DirectoryEntry }>;
  unreadable: StoreView["unreadable"];
}> {
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
        categories: entry.categories ?? [],
        featured: entry.featured ?? false,
        added: entry.added ?? null,
        notes: entry.notes ?? {},
      });
    }
  }

  return { listings, unreadable };
}

/**
 * The admin store: what's installed next to what the enabled sources list.
 * The directories are read through `readSourceRecent`, so a visit costs at
 * most one request per source every few minutes. `plugin.manage` only.
 */
export async function getPluginStoreView(): Promise<StoreView | null> {
  const admin = await getAdminPluginsView();
  if (!admin) return null;
  const { listings, unreadable } = await readListings();

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

// ─── The workspace's store (BARY-201) ───────────────────────────────────────

/** Where in a workspace a plugin is on, and how it stands there. */
export interface ScopeActivation {
  state: ActivationState;
  /** Capabilities an update added that wait for a confirmation. */
  pending: string[];
  /** Whether its manifest has a settings form (`contributes.settings`). */
  hasSettings: boolean;
}

export interface ScopeStorePlugin extends PluginSummary {
  version: string | null;
  blocked: boolean;
  /** From the directory, when a source lists it. */
  categories: string[];
  /** The workspace released it for its projects. */
  granted: boolean;
  /** On in the workspace itself; `null` when it never was. */
  workspace: ScopeActivation | null;
  /** On in a project, by project id. */
  projects: Record<string, ScopeActivation>;
}

export interface ScopeStoreProject {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface ScopeStoreView {
  workspaceId: string;
  /** `plugin.enable` in the workspace: switch on here, release for projects. */
  canWorkspace: boolean;
  /** The projects the person may switch plugins on in. */
  projects: ScopeStoreProject[];
  plugins: ScopeStorePlugin[];
}

const hasSettingsForm = (manifest: unknown) => {
  const parsed = validateManifest(manifest);
  return parsed.ok && (parsed.manifest.contributes.settings?.length ?? 0) > 0;
};

/** The projects of the current workspace the person may switch plugins on
 *  in — a separate check per project, as roles differ per project. */
async function manageableProjects(
  projects: ScopeStoreProject[],
): Promise<ScopeStoreProject[]> {
  const allowed = await Promise.all(
    projects.map((p) => hasPermission("plugin.enable", { projectId: p.id })),
  );
  return projects.filter((_, i) => allowed[i]);
}

/**
 * Whether the person may open the workspace's plugin store: `plugin.enable`
 * in the workspace, or in one of its projects they can see.
 */
export async function canUsePluginStore(
  workspaceId: string,
  projects: ScopeStoreProject[],
): Promise<boolean> {
  if (await hasPermission("plugin.enable", { workspaceId })) return true;
  return (await manageableProjects(projects)).length > 0;
}

/**
 * The workspace's store: every plugin the platform has installed, with
 * where in this workspace it's on. `projects` are the ones the person can
 * see; only those they may manage come back. `null` when they may manage
 * neither the workspace nor any project.
 */
export async function getScopeStoreView(
  workspaceId: string,
  projects: ScopeStoreProject[],
): Promise<ScopeStoreView | null> {
  const [canWorkspace, manageable] = await Promise.all([
    hasPermission("plugin.enable", { workspaceId }),
    manageableProjects(projects),
  ]);
  if (!canWorkspace && manageable.length === 0) return null;

  const [rows, activations, grants, { listings }] = await Promise.all([
    db.plugin.findMany({ where: { status: { in: ["active", "blocked"] } } }),
    db.pluginActivation.findMany({ where: { workspaceId } }),
    db.pluginGrant.findMany({ where: { workspaceId } }),
    readListings(),
  ]);
  const plugins: ScopeStorePlugin[] = [];
  for (const { versions, current } of byPlugin(rows as Row[])) {
    if (!current) continue;
    const summary = summaryOf(current.pluginId, current.manifest, current.id);
    const parsed = validateManifest(current.manifest);
    const capabilities = parsed.ok ? parsed.manifest.capabilities : null;
    const settings = hasSettingsForm(current.manifest);
    const stateOf = (a: { enabled: boolean; capabilities: string[] }) => ({
      state: activationState(a, versions, capabilities),
      pending: capabilities
        ? pendingCapabilities(capabilities, a.capabilities)
        : [],
      hasSettings: settings,
    });
    const mine = activations.filter((a) => a.pluginId === current.pluginId);
    const ws = mine.find((a) => !a.projectId);
    const byProject: Record<string, ScopeActivation> = {};
    for (const a of mine)
      if (a.projectId && manageable.some((p) => p.id === a.projectId))
        byProject[a.projectId] = stateOf(a);
    plugins.push({
      ...summary,
      version: current.version,
      blocked: current.status === "blocked",
      categories: listings.get(current.pluginId)?.categories ?? [],
      granted: grants.some((g) => g.pluginId === current.pluginId),
      workspace: ws ? stateOf(ws) : null,
      projects: byProject,
    });
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  return { workspaceId, canWorkspace, projects: manageable, plugins };
}

// ─── A switched-on plugin's settings (BARY-201) ─────────────────────────────

/** One field of a plugin's settings form, from its manifest. */
export interface PluginSettingField {
  key: string;
  type: "text" | "number" | "boolean" | "select";
  label: string;
  description: string | null;
  default: string | number | boolean | null;
  options: { id: string; label: string }[];
}

/** The plugins switched on here that have settings — the settings nav's
 *  "Plugins" group. No permission check: the layout only shows it to whom
 *  it shows the section, and every page checks again. */
export async function getPluginSettingsNav(scope: {
  workspaceId: string;
  projectId: string | null;
}): Promise<{ pluginId: string; name: string }[]> {
  const activations = await db.pluginActivation.findMany({
    where: { scopeKey: activationScopeKey(scope), enabled: true },
    select: { pluginId: true },
  });
  if (activations.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: activations.map((a) => a.pluginId) },
      status: "active",
    },
    select: { pluginId: true, manifest: true },
  });
  return rows
    .filter((r) => hasSettingsForm(r.manifest))
    .map((r) => ({
      pluginId: r.pluginId,
      name: summaryOf(r.pluginId, r.manifest).name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PluginSettingsView {
  plugin: PluginSummary & { version: string };
  fields: PluginSettingField[];
  values: Record<string, unknown>;
  state: ActivationState;
}

/** A plugin's settings page in a workspace or project — `plugin.enable`
 *  there, and the plugin switched on there with a settings form. */
export async function getPluginSettingsView(
  scope: { workspaceId: string; projectId: string | null },
  pluginId: string,
): Promise<PluginSettingsView | null> {
  const allowed = await hasPermission(
    "plugin.enable",
    scope.projectId
      ? { projectId: scope.projectId }
      : { workspaceId: scope.workspaceId },
  );
  if (!allowed) return null;
  const [activation, versions] = await Promise.all([
    db.pluginActivation.findUnique({
      where: {
        pluginId_scopeKey: { pluginId, scopeKey: activationScopeKey(scope) },
      },
      include: { settings: true },
    }),
    db.plugin.findMany({ where: { pluginId } }),
  ]);
  const active = versions.find((v) => v.status === "active");
  if (!activation || !active) return null;
  const parsed = validateManifest(active.manifest);
  if (!parsed.ok) return null;
  const settings = parsed.manifest.contributes.settings ?? [];
  if (settings.length === 0) return null;
  return {
    plugin: {
      ...summaryOf(pluginId, active.manifest, active.id),
      version: active.version,
    },
    fields: settings.map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      description: f.description ?? null,
      default: f.default ?? null,
      options: (f.options ?? []).map((o) => ({ id: o.id, label: o.label })),
    })),
    values: (activation.settings?.values ?? {}) as Record<string, unknown>,
    state: activationState(
      activation,
      versions as {
        version: string;
        status: "active" | "superseded" | "blocked";
      }[],
      parsed.manifest.capabilities,
    ),
  };
}
