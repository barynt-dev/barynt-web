import "server-only";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import {
  type GitHubAppAdminView,
  getConnectionView,
  getGitHubAppAdminView,
  type PluginConnectionView,
} from "@/features/github/queries";
import {
  pluginRepo,
  readSourceRecent,
  sourceRepo,
} from "@/features/plugins/directory";
import { openInboundSecret } from "@/features/plugins/inbound";
import { appUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import {
  accessFor,
  currentUserCanEnterWorkspace,
  currentUserId,
  hasPermission,
  PLATFORM,
} from "@/lib/permissions";
import { aboutDoc } from "@/lib/plugins/about";
import { activationScopeKey } from "@/lib/plugins/activation";
import type { DirectoryEntry } from "@/lib/plugins/directory";
import { releasePageUrl, repoUrl } from "@/lib/plugins/git-hosts";
import {
  type ActivationState,
  activationState,
  pendingCapabilities,
  rollbackTarget,
} from "@/lib/plugins/lifecycle";
import type { LinkTrigger } from "@/lib/plugins/link-rules";
import {
  type CredentialLevel,
  localizedAbout,
  localizedDescription,
  type PluginKind,
  type PluginLink,
  type PluginManifest,
  serviceAddressMode,
  validateManifest,
} from "@/lib/plugins/manifest";
import { compareSemver, updateTarget } from "@/lib/plugins/semver";
import {
  type ServiceAddressMode,
  type ServiceSummary,
  serviceSummary,
} from "@/lib/plugins/service";
import { settingLabelsOf } from "@/lib/plugins/setting-labels";
import type { SettingType, SettingValue } from "@/lib/plugins/settings";
import type { PMDoc } from "@/lib/richtext/types";
import {
  platformServiceUrl,
  serviceAddressOf,
} from "@/lib/webhooks/plugin-targets";
import { listDevPlugins } from "./dev";
import { linkRuleBases, linkRuleOptions, linkRuleStatuses } from "./link";
import { placeSettings, placeStatuses } from "./settings-options";

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
  /** Its own server and what it hears about (BARY-212). */
  service?: ServiceSummary | null;
  /** Screenshots, served from the installed version (BARY-199). */
  previews: { title: string; src: string }[];
  /** Its page text, in the person's language (BARY-237). */
  about: PMDoc | null;
  links: PluginLink[];
  /** The services it connects to (BARY-238), e.g. `["github"]`. */
  connections?: string[];
}

/** Where an installed version's preview image is served. */
export const previewUrl = (rowId: string, file: string) =>
  `/api/plugin-previews/${rowId}/${file}`;

function summaryOf(
  pluginId: string,
  manifest: unknown,
  rowId?: string,
  /** The person's language: the description in it, if the plugin has one
   *  (BARY-235). */
  locale = "en",
): PluginSummary {
  const parsed = validateManifest(manifest, locale);
  const m: Partial<PluginManifest> = parsed.ok ? parsed.manifest : {};
  return {
    pluginId,
    name: m.name ?? pluginId,
    author: m.author ?? "",
    authorUrl: m.authorUrl ?? null,
    description: localizedDescription(
      { description: m.description ?? "", locales: m.locales },
      locale,
    ),
    kind: m.kind ?? "",
    levels: m.levels ?? [],
    capabilities: m.capabilities ?? [],
    network: m.network ?? [],
    service: m.service ? serviceSummary(m.service) : null,
    about: aboutDoc(localizedAbout(m, locale)),
    links: m.links ?? [],
    connections: (m.contributes?.connections ?? []).map((c) => c.provider),
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
  /** For a server the operator runs (`platform`, BARY-223): its address,
   *  and whether `PLUGIN_SERVICE_URLS` sets it. `null` for any other. */
  serviceAddress: { url: string | null; fromEnv: boolean } | null;
  /** For a plugin that connects to GitHub: the instance's GitHub App, and
   *  how to create it (BARY-238). */
  githubApp?: GitHubAppAdminView | null;
}

export interface AdminPluginsView {
  sources: PluginSourceRow[];
  installed: InstalledPlugin[];
}

export async function getAdminPluginsView(): Promise<AdminPluginsView | null> {
  const locale = await getLocale();
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
    installed: await withServiceAddresses(
      byPlugin(rows as Row[]).map(({ versions, current }) => {
        const shown = current ?? versions[0];
        return {
          ...summaryOf(shown.pluginId, shown.manifest, shown.id, locale),
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
      }),
    )
      .then((list) =>
        Promise.all(
          list.map(async (p) =>
            p.connections?.includes("github")
              ? {
                  ...p,
                  githubApp: await getGitHubAppAdminView(
                    `/admin/plugins?plugin=${encodeURIComponent(p.pluginId)}`,
                  ),
                }
              : p,
          ),
        ),
      )
      .then((list) => list.sort((a, b) => a.name.localeCompare(b.name))),
  };
}

/** Adds where a `platform` plugin's server is — the admin gives it here. */
async function withServiceAddresses(
  plugins: Omit<InstalledPlugin, "serviceAddress">[],
): Promise<InstalledPlugin[]> {
  return Promise.all(
    plugins.map(async (p) => ({
      ...p,
      serviceAddress:
        p.service?.address === "platform"
          ? ((await platformServiceUrl(p.pluginId)) ?? {
              url: null,
              fromEnv: false,
            })
          : null,
    })),
  );
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
  /** The release to update to, if there is one (`updateTarget`). */
  update: string | null;
}

export interface StoreView {
  sources: PluginSourceRow[];
  entries: StoreEntry[];
  /** Sources whose directory couldn't be read just now. */
  unreadable: { sourceId: string; error: string }[];
  /** Plugins in local folders (`PLUGIN_DEV_DIRS`, BARY-221) — `null`
   *  without any, and always in production. */
  dev: DevListing[] | null;
}

/** A plugin in a local folder or dev server, as read just now. */
export type DevListing = {
  source: string;
  /** Installed from here, and loaded from here. */
  installed: boolean;
} & (
  | {
      ok: true;
      id: string;
      name: string;
      version: string;
      kind: PluginKind;
      capabilities: string[];
    }
  | { ok: false; errors: string[] }
);

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
  const locale = await getLocale();
  const admin = await getAdminPluginsView();
  if (!admin) return null;
  const { listings, unreadable } = await readListings();

  const entries: StoreEntry[] = [];
  for (const installed of admin.installed) {
    const found = listings.get(installed.pluginId);
    const { entry: _, ...listing } = found ?? { entry: null };
    entries.push({
      id: installed.pluginId,
      name: installed.name,
      author: installed.author,
      description: installed.description,
      kind: installed.kind,
      levels: installed.levels,
      installed,
      listing: found ? (listing as StoreListing) : null,
      // A real release first: a beta is only offered to someone on a beta.
      update:
        found && installed.version
          ? updateTarget(found.versions, installed.version)
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
      description: localizedDescription(entry, locale),
      kind: entry.kind,
      levels: entry.levels,
      installed: null,
      listing,
      update: null,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return {
    sources: admin.sources,
    entries,
    unreadable,
    dev: await devListings(),
  };
}

async function devListings(): Promise<DevListing[] | null> {
  const read = await listDevPlugins();
  if (read.length === 0) return null;
  const rows = await db.plugin.findMany({
    where: { status: "active", devSource: { in: read.map((r) => r.source) } },
    select: { devSource: true },
  });
  return read.map((r) => {
    const installed = rows.some((row) => row.devSource === r.source);
    return r.ok
      ? {
          source: r.source,
          installed,
          ok: true,
          id: r.manifest.id,
          name: r.manifest.name,
          version: r.manifest.version,
          kind: r.manifest.kind,
          capabilities: r.manifest.capabilities,
        }
      : { source: r.source, installed, ok: false, errors: r.errors };
  });
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
  /** The workspace's projects the person can see — where it's on, for the
   *  line under the header. */
  projects: ScopeStoreProject[];
  plugins: ScopeStorePlugin[];
}

/** Whether a plugin's settings page has something on it: a form, or the
 *  cards of its server and of the webhooks other services send it — a
 *  server run just for this place takes its address there (BARY-223). */
const hasSettingsForm = (manifest: unknown) => {
  const parsed = validateManifest(manifest);
  if (!parsed.ok) return false;
  const m = parsed.manifest;
  return (
    (m.contributes.settings?.length ?? 0) > 0 ||
    !!m.service ||
    (m.contributes.inboundHooks?.length ?? 0) > 0
  );
};

/**
 * Whether the person may open the workspace's plugin store: `plugin.enable`
 * in the workspace — the workspace's managers, who release plugins here; the
 * projects switch released ones on in their own settings. While the platform
 * has nothing installed, the store has nothing to offer either: then only a
 * platform admin (`plugin.manage`) sees it, with a start page on how to
 * install plugins.
 */
export async function canUsePluginStore(workspaceId: string): Promise<boolean> {
  if (!(await hasPermission("plugin.enable", { workspaceId }))) return false;
  const installed = await db.plugin.count({ where: { status: "active" } });
  return installed > 0 || hasPermission("plugin.manage", PLATFORM);
}

/**
 * The workspace's store: every plugin the platform has installed, whether
 * it's released here and where it's on. `projects` are the ones the person
 * can see. `null` without `plugin.enable` in the workspace.
 */
export async function getScopeStoreView(
  workspaceId: string,
  projects: ScopeStoreProject[],
): Promise<ScopeStoreView | null> {
  const locale = await getLocale();
  if (!(await canUsePluginStore(workspaceId))) return null;

  const [rows, activations, grants, { listings }] = await Promise.all([
    db.plugin.findMany({ where: { status: { in: ["active", "blocked"] } } }),
    db.pluginActivation.findMany({ where: { workspaceId } }),
    db.pluginGrant.findMany({ where: { workspaceId } }),
    readListings(),
  ]);
  const plugins: ScopeStorePlugin[] = [];
  for (const { versions, current } of byPlugin(rows as Row[])) {
    if (!current) continue;
    const summary = summaryOf(
      current.pluginId,
      current.manifest,
      current.id,
      locale,
    );
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
      if (a.projectId && projects.some((p) => p.id === a.projectId))
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
  return { workspaceId, projects, plugins };
}

// ─── A switched-on plugin's settings (BARY-201) ─────────────────────────────

/** One field of a plugin's settings form, from its manifest. */
export interface PluginSettingField {
  key: string;
  type: SettingType;
  label: string;
  description: string | null;
  default: SettingValue | null;
  /** A choice's options — for `member` and `label` the place's (BARY-204),
   *  for `repositories` what the place's connections reach (BARY-238). */
  options: {
    id: string;
    label: string;
    color?: string;
    private?: boolean;
    archived?: boolean;
    fork?: boolean;
    /** A repository's page on GitHub. */
    url?: string;
  }[];
  /** `repositories`: whether there's a connection to list them from, and
   *  the accounts GitHub didn't answer for. */
  connected?: boolean;
  failed?: string[];
  /** The heading it's shown under, with the settings next to it that
   *  share it. */
  group?: string;
  /** The icon beside that heading. */
  groupIcon?: string;
  /** `text`: ready-made values to pick from a menu beside the field. */
  suggestions?: {
    id: string;
    value: string;
    label: string;
    hint: string | null;
  }[];
}

/** The settings nav's "Plugins" group. In a project: every plugin its
 *  workspace released for projects — switched on or not, that's where a
 *  project turns it on. In the workspace: the ones on there with a settings
 *  form. No permission check: the layout only shows it to whom it shows the
 *  section, and every page checks again. */
export async function getPluginSettingsNav(scope: {
  workspaceId: string;
  projectId: string | null;
}): Promise<PluginNavRow[]> {
  const locale = await getLocale();
  const ids = scope.projectId
    ? (
        await db.pluginGrant.findMany({
          where: { workspaceId: scope.workspaceId },
          select: { pluginId: true },
        })
      ).map((g) => g.pluginId)
    : await workspaceSettingsIds(scope.workspaceId);
  if (ids.length === 0) return [];
  const [rows, running] = await Promise.all([
    db.plugin.findMany({
      where: { pluginId: { in: ids }, status: "active" },
      select: { pluginId: true, manifest: true },
    }),
    db.pluginActivation.findMany({
      where: {
        pluginId: { in: ids },
        scopeKey: activationScopeKey(scope),
        enabled: true,
      },
      select: { pluginId: true },
    }),
  ]);
  const level = scope.projectId ? "project" : "workspace";
  return rows
    .filter((r) =>
      scope.projectId
        ? true
        : hasSettingsForm(r.manifest) ||
          credentialsOf(r.manifest, "workspace").length > 0 ||
          connectsTo(r.manifest),
    )
    .map((r) => ({
      pluginId: r.pluginId,
      name: summaryOf(r.pluginId, r.manifest).name,
      settings: running.some((a) => a.pluginId === r.pluginId)
        ? settingLabelsOf(r.manifest, level, locale)
        : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A plugin in a settings nav, with the labels of the settings its page
 *  shows there — for the settings search. */
export interface PluginNavRow {
  pluginId: string;
  name: string;
  settings: string[];
}

/** In the workspace: the plugins on there, and those released for its
 *  projects that connect to GitHub — connected once for all of them. */
async function workspaceSettingsIds(workspaceId: string): Promise<string[]> {
  const [on, released] = await Promise.all([
    db.pluginActivation.findMany({
      where: {
        scopeKey: activationScopeKey({ workspaceId, projectId: null }),
        enabled: true,
      },
      select: { pluginId: true },
    }),
    db.pluginGrant.findMany({
      where: { workspaceId },
      select: { pluginId: true },
    }),
  ]);
  const onIds = new Set(on.map((a) => a.pluginId));
  const connecting = (
    await db.plugin.findMany({
      where: {
        pluginId: { in: released.map((g) => g.pluginId) },
        status: "active",
      },
      select: { pluginId: true, manifest: true },
    })
  )
    .filter((r) => connectsTo(r.manifest))
    .map((r) => r.pluginId);
  return [...new Set([...onIds, ...connecting])];
}

/** Does the manifest connect to another service (BARY-238)? */
function connectsTo(manifest: unknown): boolean {
  const parsed = validateManifest(manifest);
  return (
    parsed.ok && (parsed.manifest.contributes.connections ?? []).length > 0
  );
}

export interface PluginSettingsView {
  plugin: PluginSummary & { version: string };
  fields: PluginSettingField[];
  values: Record<string, unknown>;
  /** `off` in a project that never switched it on. */
  state: ActivationState | "off";
  /** The project views it contributes, while it runs here with them
   *  confirmed (BARY-144). */
  views: { id: string; title: string }[];
  /** The credentials kept at this level — whether each is, never what. */
  credentials: PluginCredentialField[];
  /** Draws its settings itself, in its own frame (BARY-149): instead of
   *  the form, or — `"section"` — below it (BARY-204). */
  settingsPage: false | "page" | "section";
  /** Its own server (BARY-212), while it has one here. */
  service: PluginServiceView | null;
  /** Webhooks other services send it through Barynt (BARY-215). */
  inbound: PluginInboundView[];
  /** Its connection to GitHub here (BARY-238). */
  connection: PluginConnectionView | null;
}

/** A hook another service calls, as its settings show it (BARY-215). */
export interface PluginInboundView {
  /** The hook's row — what a rule is saved on. */
  id: string;
  hookId: string;
  title: string;
  provider: "gitlab" | "github" | "generic";
  handle: "forward" | "link";
  /** The address to give the provider. */
  url: string;
  /** The secret to give it — shown to whoever may manage the plugin. */
  secret: string | null;
  last: {
    at: Date;
    event: string | null;
    status: number | null;
    error: string | null;
  } | null;
  /** A `link` hook's rules (BARY-227), each with the status it sets here —
   *  `null` while it's off. */
  rules: {
    id: string;
    title: string;
    on: LinkTrigger;
    status: string | null;
  }[];
  /** The target branches a pull request's rules count for — none: all. */
  bases: string[];
  /** A pull request gets a comment linking the issues it works on — only
   *  through a connection's app (`viaApp`). */
  prComment: boolean;
  /** What a rule can set: the workspace's statuses. Empty without rules. */
  statuses: { id: string; label: string; color?: string }[];
  /** Its calls come through a connection's app — no address to give. */
  viaApp: boolean;
}

/** A plugin's server, as its settings show it (BARY-212). */
export interface PluginServiceView {
  activationId: string;
  /** Where Barynt sends — `null` while nobody has given an address. */
  url: string | null;
  /** Who runs the server and gives its address (BARY-223). */
  address: ServiceAddressMode;
  /** The manifest's address, offered when one is to be given here. */
  suggestion: string | null;
  events: string[];
  /** Set while Barynt has stopped delivering after a day of failures. */
  pausedAt: Date | null;
  /** Since when every delivery fails. */
  failingSince: Date | null;
  last: {
    at: Date;
    status: number | null;
    error: string | null;
  } | null;
}

/** A credential a plugin declares, as its form shows it (BARY-147). */
export interface PluginCredentialField {
  key: string;
  label: string;
  description: string | null;
  host: string;
  /** When it was last kept; `null` while there's none. */
  updatedAt: Date | null;
}

/** The credentials a manifest declares at a level. */
function credentialsOf(
  manifest: unknown,
  level: CredentialLevel,
  locale?: string,
) {
  const parsed = validateManifest(manifest, locale);
  return parsed.ok
    ? (parsed.manifest.contributes.credentials ?? []).filter(
        (c) => c.level === level,
      )
    : [];
}

/** Those credentials with whether each is kept under `scopeKey`. */
async function credentialFields(
  pluginId: string,
  manifest: unknown,
  level: CredentialLevel,
  scopeKey: string,
  locale?: string,
): Promise<PluginCredentialField[]> {
  const declared = credentialsOf(manifest, level, locale);
  if (declared.length === 0) return [];
  const kept = await db.pluginCredential.findMany({
    where: { pluginId, scopeKey, key: { in: declared.map((c) => c.key) } },
    select: { key: true, updatedAt: true },
  });
  return declared.map((c) => ({
    key: c.key,
    label: c.label,
    description: c.description ?? null,
    host: c.host,
    updatedAt: kept.find((k) => k.key === c.key)?.updatedAt ?? null,
  }));
}

/** A plugin's page in a workspace or project — `plugin.enable` there. In a
 *  project: released by its workspace, on or not (the page switches it on).
 *  In the workspace: switched on there, with a settings form. */
export async function getPluginSettingsView(
  scope: { workspaceId: string; projectId: string | null },
  pluginId: string,
): Promise<PluginSettingsView | null> {
  const locale = await getLocale();
  const allowed = await hasPermission(
    "plugin.enable",
    scope.projectId
      ? { projectId: scope.projectId }
      : { workspaceId: scope.workspaceId },
  );
  if (!allowed) return null;
  const [activation, versions, grant] = await Promise.all([
    db.pluginActivation.findUnique({
      where: {
        pluginId_scopeKey: { pluginId, scopeKey: activationScopeKey(scope) },
      },
      include: { settings: true },
    }),
    db.plugin.findMany({ where: { pluginId } }),
    db.pluginGrant.findUnique({
      where: {
        pluginId_workspaceId: { pluginId, workspaceId: scope.workspaceId },
      },
    }),
  ]);
  const active = versions.find((v) => v.status === "active");
  if (!active) return null;
  const parsed = validateManifest(active.manifest, locale);
  if (!parsed.ok) return null;
  const settings = parsed.manifest.contributes.settings ?? [];
  const level = scope.projectId ? "project" : "workspace";
  const credentials = await credentialFields(
    pluginId,
    active.manifest,
    level,
    activationScopeKey(scope),
    locale,
  );
  const service = parsed.manifest.service;
  const hooks = parsed.manifest.contributes.inboundHooks ?? [];
  // A workspace connects to GitHub for its projects (BARY-238) — released
  // for them is enough, the plugin needn't be on in the workspace itself.
  const connects = (parsed.manifest.contributes.connections ?? []).length > 0;
  if (
    scope.projectId
      ? !grant
      : !(connects && grant) &&
        (!activation?.enabled ||
          (settings.length === 0 &&
            credentials.length === 0 &&
            !service &&
            hooks.length === 0))
  )
    return null;
  const connection = await getConnectionView(pluginId, parsed.manifest, scope);
  const inboundRows =
    activation?.enabled && hooks.length > 0
      ? await db.pluginInboundHook.findMany({
          where: { activationId: activation.id },
        })
      : [];
  const ruleStatuses = hooks.some((h) => h.rules?.length)
    ? await placeStatuses(scope.workspaceId)
    : [];
  const lastDelivery =
    service && activation
      ? await db.eventDelivery.findFirst({
          where: { activationId: activation.id, attempts: { gt: 0 } },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true, lastStatus: true, lastError: true },
        })
      : null;
  return {
    plugin: {
      ...summaryOf(pluginId, active.manifest, active.id, locale),
      version: active.version,
    },
    connection,
    fields: (await placeSettings(scope, settings, pluginId)).map((f) => ({
      key: f.key,
      type: f.type,
      label: f.label,
      description: f.description ?? null,
      default: f.default ?? null,
      options: (f.options ?? []).map((o) => ({
        id: o.id,
        label: o.label,
        ...(o.color && { color: o.color }),
        ...(o.private && { private: true }),
        ...(o.archived && { archived: true }),
        ...(o.fork && { fork: true }),
        ...(o.url && { url: o.url }),
      })),
      ...(f.type === "repositories" && {
        connected: f.connected ?? false,
        failed: f.failed ?? [],
      }),
      ...(f.group && { group: f.group }),
      ...(f.group && f.groupIcon && { groupIcon: f.groupIcon }),
      ...(f.suggestions?.length && {
        suggestions: f.suggestions.map((x) => ({
          id: x.id,
          value: x.value,
          label: x.label,
          hint: x.hint ?? null,
        })),
      }),
    })),
    inbound: hooks.flatMap((hook) => {
      const row = inboundRows.find((r) => r.hookId === hook.id);
      if (!row) return [];
      const stored = linkRuleStatuses(row.rules);
      return [
        {
          id: row.id,
          hookId: hook.id,
          title: hook.title,
          provider: hook.provider,
          handle: hook.handle,
          url: appUrl(`/api/plugins/hooks/${row.token}`),
          secret: openInboundSecret(row.secret),
          last: row.lastReceivedAt
            ? {
                at: row.lastReceivedAt,
                event: row.lastEvent,
                status: row.lastStatus,
                error: row.lastError,
              }
            : null,
          rules: (hook.rules ?? []).map((r) => ({
            ...r,
            status: stored[r.id] ?? null,
          })),
          bases: linkRuleBases(row.rules),
          prComment: linkRuleOptions(row.rules).prComment,
          statuses: hook.rules?.length ? ruleStatuses : [],
          // GitHub reports through the instance's GitHub App (BARY-238):
          // nothing to set up at GitHub, only the rules count.
          viaApp:
            hook.provider === "github" &&
            !!connection?.connections.some((c) => !c.broken),
        },
      ];
    }),
    service:
      service && activation?.enabled
        ? {
            activationId: activation.id,
            url:
              (await serviceAddressOf(activation, parsed.manifest))?.url ??
              null,
            address: serviceAddressMode(service),
            suggestion: service.url ?? null,
            events: service.events,
            pausedAt: activation.servicePausedAt,
            failingSince: activation.serviceFailingSince,
            last: lastDelivery
              ? {
                  at: lastDelivery.updatedAt,
                  status: lastDelivery.lastStatus,
                  error: lastDelivery.lastError,
                }
              : null,
          }
        : null,
    values: (activation?.settings?.values ?? {}) as Record<string, unknown>,
    state: activation
      ? activationState(
          activation,
          versions as {
            version: string;
            status: "active" | "superseded" | "blocked";
          }[],
          parsed.manifest.capabilities,
        )
      : "off",
    views:
      scope.projectId &&
      activation?.enabled &&
      parsed.manifest.kind === "sandbox" &&
      activation.capabilities.includes("ui:project-view")
        ? (parsed.manifest.contributes.projectViews ?? []).map((v) => ({
            id: v.id,
            title: v.title,
          }))
        : [],
    credentials,
    settingsPage:
      parsed.manifest.kind !== "sandbox" ||
      !parsed.manifest.contributes.settingsPage
        ? false
        : parsed.manifest.contributes.settingsPage === "section"
          ? "section"
          : "page",
  };
}

// ─── A person's own credentials (BARY-147) ──────────────────────────────────

/** The plugins that run somewhere in this workspace and ask each person for
 *  a credential of their own — the personal settings' "Plugins" group. */
export async function getUserCredentialPluginsNav(
  workspaceId: string,
): Promise<PluginNavRow[]> {
  if (!(await currentUserCanEnterWorkspace(workspaceId))) return [];
  const locale = await getLocale();
  const running = await db.pluginActivation.findMany({
    where: { workspaceId, enabled: true },
    select: { pluginId: true },
    distinct: ["pluginId"],
  });
  if (running.length === 0) return [];
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: running.map((r) => r.pluginId) },
      status: "active",
    },
    select: { pluginId: true, manifest: true },
  });
  return rows
    .filter((r) => credentialsOf(r.manifest, "user").length > 0)
    .map((r) => ({
      pluginId: r.pluginId,
      name: summaryOf(r.pluginId, r.manifest).name,
      settings: settingLabelsOf(r.manifest, "user", locale),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface UserCredentialsView {
  plugin: PluginSummary & { version: string };
  credentials: PluginCredentialField[];
}

/** A plugin's page in the personal settings: the credentials it asks each
 *  person for, and whether this person kept theirs. */
export async function getUserCredentialsView(
  workspaceId: string,
  pluginId: string,
): Promise<UserCredentialsView | null> {
  const locale = await getLocale();
  const userId = await currentUserId();
  if (!userId) return null;
  const nav = await getUserCredentialPluginsNav(workspaceId);
  if (!nav.some((p) => p.pluginId === pluginId)) return null;
  const active = await db.plugin.findFirst({
    where: { pluginId, status: "active" },
  });
  if (!active) return null;
  return {
    plugin: {
      ...summaryOf(pluginId, active.manifest, active.id, locale),
      version: active.version,
    },
    credentials: await credentialFields(
      pluginId,
      active.manifest,
      "user",
      `us:${userId}`,
      locale,
    ),
  };
}

// ─── Apps (BARY-213) ─────────────────────────────────────────────────────────

/** A plugin's bot, as the members' "Apps" tab lists it. */
export interface WorkspaceAppRow {
  botUserId: string;
  name: string;
  handle: string;
  color: string;
  pluginId: string;
  /** `null` for the workspace. */
  project: { id: string; name: string; slug: string } | null;
  enabled: boolean;
  capabilities: string[];
  /** When its token was last used — roughly, see `lib/api-auth.ts`. */
  lastUsedAt: Date | null;
}

/** The bots of a workspace's plugins — `null` without `member.view`. */
export async function getWorkspaceApps(
  workspaceId: string,
): Promise<WorkspaceAppRow[] | null> {
  const actorId = await currentUserId();
  const access = await accessFor(actorId, { workspaceId });
  if (!access.has("member.view")) return null;
  const rows = await db.pluginActivation.findMany({
    where: { workspaceId, botUserId: { not: null } },
    orderBy: { activatedAt: "desc" },
    select: {
      pluginId: true,
      enabled: true,
      capabilities: true,
      project: { select: { id: true, name: true, slug: true } },
      bot: { select: { id: true, firstName: true, handle: true, color: true } },
      appTokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { lastUsedAt: true },
      },
    },
  });
  return rows.flatMap((row) =>
    row.bot
      ? [
          {
            botUserId: row.bot.id,
            name: row.bot.firstName,
            handle: row.bot.handle,
            color: row.bot.color,
            pluginId: row.pluginId,
            project: row.project,
            enabled: row.enabled,
            capabilities: row.capabilities,
            lastUsedAt: row.appTokens[0]?.lastUsedAt ?? null,
          },
        ]
      : [],
  );
}

// ─── The plugins' area (BARY-238) ────────────────────────────────────────────

/** A project a plugin's project level can open. */
export interface PluginsAreaProject {
  id: string;
  slug: string;
  name: string;
  color: string;
  avatarUrl: string | null;
}

/** A plugin in the plugins' area: where this person can set it, and where
 *  it's on. */
export interface PluginsAreaPlugin {
  pluginId: string;
  name: string;
  description: string;
  /** Asks each person for a credential of their own. */
  personal: boolean;
  /** Its workspace page opens (`plugin.enable` there, and something to
   *  set). */
  workspace: boolean;
  /** The projects whose page for it opens — released for projects, and
   *  `plugin.enable` in each — with whether it's on there. */
  projects: (PluginsAreaProject & { on: boolean })[];
}

/**
 * Every plugin this person can set somewhere in the workspace — for
 * themselves, in a project, or in the workspace — each with those places,
 * sorted by name. `projects` are the ones the person can see.
 */
export const getPluginsArea = cache(pluginsArea);

async function pluginsArea(
  workspaceId: string,
  projects: PluginsAreaProject[],
): Promise<PluginsAreaPlugin[]> {
  const locale = await getLocale();
  const [personal, canWorkspace, manageable] = await Promise.all([
    getUserCredentialPluginsNav(workspaceId),
    hasPermission("plugin.enable", { workspaceId }),
    Promise.all(
      projects.map(async (p) =>
        (await hasPermission("plugin.enable", { projectId: p.id })) ? p : null,
      ),
    ).then((list) => list.filter((p) => p !== null)),
  ]);
  const [workspace, released] = await Promise.all([
    canWorkspace ? getPluginSettingsNav({ workspaceId, projectId: null }) : [],
    // What's released for projects is the same for each of them.
    manageable[0]
      ? getPluginSettingsNav({ workspaceId, projectId: manageable[0].id })
      : [],
  ]);
  const ids = [
    ...new Set([...personal, ...workspace, ...released].map((p) => p.pluginId)),
  ];
  if (ids.length === 0) return [];
  const [rows, on] = await Promise.all([
    db.plugin.findMany({
      where: { pluginId: { in: ids }, status: "active" },
      select: { pluginId: true, manifest: true },
    }),
    db.pluginActivation.findMany({
      where: { workspaceId, pluginId: { in: ids }, enabled: true },
      select: { pluginId: true, scopeKey: true },
    }),
  ]);
  const isOn = (pluginId: string, scopeKey: string) =>
    on.some((a) => a.pluginId === pluginId && a.scopeKey === scopeKey);
  return rows
    .map((r) => {
      const summary = summaryOf(r.pluginId, r.manifest, undefined, locale);
      const forProjects = released.some((p) => p.pluginId === r.pluginId);
      return {
        pluginId: r.pluginId,
        name: summary.name,
        description: summary.description,
        personal: personal.some((p) => p.pluginId === r.pluginId),
        workspace: workspace.some((p) => p.pluginId === r.pluginId),
        projects: forProjects
          ? manageable.map((p) => ({
              ...p,
              on: isOn(
                r.pluginId,
                activationScopeKey({ workspaceId, projectId: p.id }),
              ),
            }))
          : [],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
