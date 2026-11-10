"use server";

import { revalidatePath } from "next/cache";
import {
  fetchRelease,
  readDirectory,
  readSource,
  sealSourceToken,
} from "@/features/plugins/directory";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PLATFORM, requirePermission } from "@/lib/permissions";
import { activationScopeKey } from "@/lib/plugins/activation";
import { isDevUrl } from "@/lib/plugins/dev";
import type { PreviewFileName } from "@/lib/plugins/directory";
import {
  detectProvider,
  type GitProvider,
  isGitProvider,
  parseGitRepo,
  repoUrl,
} from "@/lib/plugins/git-hosts";
import {
  allowsLevel,
  confirmsExactly,
  rollbackTarget,
  unblockTarget,
} from "@/lib/plugins/lifecycle";
import { validateManifest } from "@/lib/plugins/manifest";
import { compareSemver } from "@/lib/plugins/semver";

// The plugin lifecycle (BARY-142). The platform admin (`plugin.manage`)
// manages sources and installs, updates, rolls back, blocks and removes
// versions; a workspace or project admin (`plugin.enable`, checked in that
// scope) switches an installed plugin on or off where they are. Every step
// writes an audit entry. Code of a plugin never runs here — installing only
// stores files that passed the directory client's checks (BARY-141).

export type PluginResult<T = object> = ({ ok: true } & T) | { error: string };

const done = () => revalidatePath("/", "layout");

// ─── Sources ────────────────────────────────────────────────────────────────

/** What a source form sends: an address, and — when the address doesn't
 *  tell — which software runs there. */
interface SourceInput {
  url: string;
  provider?: string | null;
  ref?: string | null;
  token?: string | null;
}

/**
 * A source's repository as stored: the address normalized for its provider
 * (`lib/plugins/git-hosts`). Plain http only for the local demo directory.
 */
function cleanSource(
  input: SourceInput,
):
  | { url: string; provider: GitProvider; ref: string | null }
  | { error: string } {
  const raw = input.url.trim();
  let http = false;
  try {
    http = isDevUrl(new URL(raw));
  } catch {}
  const chosen = isGitProvider(input.provider) ? input.provider : null;
  if (!chosen) {
    try {
      if (!detectProvider(new URL(raw))) return { error: "provider_required" };
    } catch {
      // `owner/name` isn't a URL — GitHub's short form, parsed below.
    }
  }
  const repo = parseGitRepo(raw, chosen, { allowHttp: http });
  if (!repo) return { error: "invalid_url" };
  const ref = input.ref?.trim().slice(0, 200) || null;
  if (ref && !/^[A-Za-z0-9._/-]+$/.test(ref)) return { error: "invalid_ref" };
  return { url: repoUrl(repo), provider: repo.provider, ref };
}

/**
 * Reads a source's `plugins.json` before it's saved — "Check connection".
 * Tells which provider was used and how much it lists.
 */
export async function checkPluginSource(input: SourceInput): Promise<
  PluginResult<{
    provider: GitProvider;
    plugins: number;
    versions: number;
    skipped: number;
  }>
> {
  await requirePermission("plugin.manage", PLATFORM);
  const clean = cleanSource(input);
  if ("error" in clean) return clean;
  const read = await readDirectory({
    ...clean,
    token: input.token?.trim() || null,
  });
  if (!read.ok) return { error: read.error };
  return {
    ok: true,
    provider: clean.provider,
    plugins: read.entries.length,
    versions: read.entries.reduce(
      (n, e) => n + Object.keys(e.versions).length,
      0,
    ),
    skipped: read.issues.length,
  };
}

/** Adds a source: a repository with a `plugins.json` on any Git host, or
 *  the file's own address. A token makes private ones readable; it's stored
 *  sealed. Adding a source releases no code by itself. */
export async function addPluginSource(
  input: SourceInput & { name: string },
): Promise<PluginResult<{ id: string }>> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "name_required" };
  const clean = cleanSource(input);
  if ("error" in clean) return clean;
  const { url, provider, ref } = clean;
  if (await db.pluginSource.findUnique({ where: { url } }))
    return { error: "source_exists" };

  const source = await db.pluginSource.create({
    data: {
      name,
      url,
      provider,
      ref,
      tokenCipher: input.token?.trim()
        ? sealSourceToken(input.token.trim())
        : null,
      addedById: actorId,
    },
  });
  await recordAudit({
    action: "plugin.source.added",
    actorId,
    target: { type: "pluginSource", id: source.id, label: name },
    meta: { url, provider, ...(ref && { ref }), private: !!source.tokenCipher },
  });
  done();
  return { ok: true, id: source.id };
}

/** Renames, switches or re-keys a source. `token: null` removes the token,
 *  leaving it out keeps it. */
export async function updatePluginSource(
  id: string,
  input: {
    name?: string;
    enabled?: boolean;
    ref?: string | null;
    token?: string | null;
  },
): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const source = await db.pluginSource.findUnique({ where: { id } });
  if (!source) return { error: "not_found" };
  const name = input.name?.trim().slice(0, 80);
  if (input.name !== undefined && !name) return { error: "name_required" };

  const data: Prisma.PluginSourceUpdateInput = {};
  if (name) data.name = name;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  const ref =
    input.ref === undefined
      ? undefined
      : input.ref?.trim().slice(0, 200) || null;
  if (ref && !/^[A-Za-z0-9._/-]+$/.test(ref)) return { error: "invalid_ref" };
  if (ref !== undefined) data.ref = ref;
  if (input.token !== undefined)
    data.tokenCipher = input.token?.trim()
      ? sealSourceToken(input.token.trim())
      : null;
  await db.pluginSource.update({ where: { id }, data });
  await recordAudit({
    action: "plugin.source.updated",
    actorId,
    target: { type: "pluginSource", id, label: name ?? source.name },
    // What changed, never the token itself.
    meta: {
      ...(name && name !== source.name && { name }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(ref !== undefined && ref !== source.ref && { ref }),
      ...(input.token !== undefined && {
        token: input.token ? "set" : "removed",
      }),
    },
  });
  done();
  return { ok: true };
}

/** Removes a source. Installed plugins stay — they no longer have it. */
export async function removePluginSource(id: string): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const source = await db.pluginSource.findUnique({ where: { id } });
  if (!source) return { error: "not_found" };
  await db.pluginSource.delete({ where: { id } });
  await recordAudit({
    action: "plugin.source.removed",
    actorId,
    target: { type: "pluginSource", id, label: source.name },
    meta: { url: source.url },
  });
  done();
  return { ok: true };
}

// ─── Installed versions ─────────────────────────────────────────────────────

/**
 * Installs `version` of a plugin from a source — or updates to it, when
 * another version is active. The release is loaded and checked end to end
 * (`fetchRelease`), and the admin must have confirmed exactly the
 * capabilities its manifest asks for. The version before becomes
 * `superseded` and stays for a rollback.
 *
 * Activations keep what they confirmed: a new capability waits until each
 * workspace or project confirms again (`activationState`).
 */
export async function installPlugin(input: {
  sourceId: string;
  pluginId: string;
  version: string;
  capabilities: string[];
}): Promise<PluginResult<{ id: string; updatedFrom: string | null }>> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const rows = await db.plugin.findMany({
    where: { pluginId: input.pluginId },
    select: { version: true, status: true },
  });
  if (rows.some((r) => r.version === input.version))
    return { error: "already_installed" };
  if (rows.some((r) => r.status === "blocked")) return { error: "blocked" };

  const release = await fetchRelease(
    input.sourceId,
    input.pluginId,
    input.version,
  );
  if (!release.ok) return { error: release.error };
  const { manifest, files, hash } = release;
  if (!confirmsExactly(manifest.capabilities, input.capabilities))
    return { error: "capabilities_not_confirmed" };

  const previous = rows.find((r) => r.status === "active")?.version ?? null;
  const row = await db.$transaction(async (tx) => {
    await tx.plugin.updateMany({
      where: { pluginId: manifest.id, status: "active" },
      data: { status: "superseded" },
    });
    return tx.plugin.create({
      data: {
        pluginId: manifest.id,
        version: manifest.version,
        kind: manifest.kind,
        hash,
        manifest: manifest as unknown as Prisma.InputJsonValue,
        sourceId: input.sourceId,
        installedById: actorId,
        files: {
          // Code, styles and preview images; the manifest is a column.
          create: (Object.keys(files) as (keyof typeof files)[]).flatMap(
            (name) => {
              const content = name === "manifest.json" ? null : files[name];
              return content
                ? [
                    {
                      name,
                      content: Buffer.from(content),
                      size: content.byteLength,
                    },
                  ]
                : [];
            },
          ),
        },
      },
      select: { id: true },
    });
  });

  await recordAudit({
    action: previous ? "plugin.updated" : "plugin.installed",
    actorId,
    target: { type: "plugin", id: manifest.id, label: manifest.name },
    meta: {
      version: manifest.version,
      ...(previous && { from: previous }),
      kind: manifest.kind,
      capabilities: manifest.capabilities,
      network: manifest.network,
      hash,
    },
  });
  done();
  return { ok: true, id: row.id, updatedFrom: previous };
}

/** The active version's manifest name, for audit labels. */
async function pluginLabel(pluginId: string): Promise<string> {
  const row = await db.plugin.findFirst({
    where: { pluginId },
    orderBy: { installedAt: "desc" },
    select: { manifest: true },
  });
  const parsed = row ? validateManifest(row.manifest) : null;
  return parsed?.ok ? parsed.manifest.name : pluginId;
}

/** Back to the version before the active one. */
export async function rollbackPlugin(
  pluginId: string,
): Promise<PluginResult<{ version: string }>> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const rows = await db.plugin.findMany({
    where: { pluginId },
    select: { version: true, status: true },
  });
  const target = rollbackTarget(rows);
  const from = rows.find((r) => r.status === "active")?.version;
  if (!target || !from) return { error: "no_previous_version" };

  await db.$transaction([
    db.plugin.update({
      where: { pluginId_version: { pluginId, version: from } },
      data: { status: "superseded" },
    }),
    db.plugin.update({
      where: { pluginId_version: { pluginId, version: target } },
      data: { status: "active" },
    }),
  ]);
  await recordAudit({
    action: "plugin.rolledback",
    actorId,
    target: {
      type: "plugin",
      id: pluginId,
      label: await pluginLabel(pluginId),
    },
    meta: { from, to: target },
  });
  done();
  return { ok: true, version: target };
}

/**
 * The kill switch: a blocked plugin runs nowhere, whatever was activated.
 * Unblocking brings back the newest blocked version. Activations are left
 * as they are — they apply again once it's unblocked.
 */
export async function setPluginBlocked(
  pluginId: string,
  blocked: boolean,
): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const rows = await db.plugin.findMany({
    where: { pluginId },
    select: { version: true, status: true },
  });
  if (!rows.length) return { error: "not_found" };

  if (blocked) {
    const active = rows.find((r) => r.status === "active");
    if (!active) return { error: "not_active" };
    await db.plugin.update({
      where: { pluginId_version: { pluginId, version: active.version } },
      data: { status: "blocked" },
    });
  } else {
    const target = unblockTarget(rows);
    if (!target) return { error: "not_blocked" };
    await db.plugin.update({
      where: { pluginId_version: { pluginId, version: target } },
      data: { status: "active" },
    });
  }
  await recordAudit({
    action: blocked ? "plugin.blocked" : "plugin.unblocked",
    actorId,
    target: {
      type: "plugin",
      id: pluginId,
      label: await pluginLabel(pluginId),
    },
  });
  done();
  return { ok: true };
}

/**
 * Removes every version of a plugin. With `deleteData`, its activations go
 * too, and with them their settings and storage; without, they stay switched
 * off — installing the plugin again picks them up.
 */
export async function uninstallPlugin(
  pluginId: string,
  { deleteData }: { deleteData: boolean },
): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  if (!(await db.plugin.count({ where: { pluginId } })))
    return { error: "not_found" };
  const label = await pluginLabel(pluginId);
  const [removed, activations] = await db.$transaction([
    db.plugin.deleteMany({ where: { pluginId } }),
    deleteData
      ? db.pluginActivation.deleteMany({ where: { pluginId } })
      : db.pluginActivation.updateMany({
          where: { pluginId },
          data: { enabled: false },
        }),
  ]);
  await recordAudit({
    action: "plugin.uninstalled",
    actorId,
    target: { type: "plugin", id: pluginId, label },
    meta: {
      versions: removed.count,
      deleteData,
      activations: activations.count,
    },
  });
  done();
  return { ok: true };
}

// ─── Activations ────────────────────────────────────────────────────────────

type ActivationInput = {
  pluginId: string;
  workspaceId: string;
  projectId?: string | null;
};

/** The permission scope and, for a project, its workspace — taken from the
 *  project, never from the caller. */
async function resolveScope(input: ActivationInput) {
  if (!input.projectId)
    return { workspaceId: input.workspaceId, projectId: null } as const;
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { workspaceId: true },
  });
  return project
    ? ({
        workspaceId: project.workspaceId,
        projectId: input.projectId,
      } as const)
    : null;
}

const permissionCtx = (scope: {
  workspaceId: string;
  projectId: string | null;
}) =>
  scope.projectId
    ? { projectId: scope.projectId }
    : { workspaceId: scope.workspaceId };

const auditScope = (scope: {
  workspaceId: string;
  projectId: string | null;
}) => ({
  workspaceId: scope.workspaceId,
  projectId: scope.projectId,
});

/**
 * Switches an installed plugin on in a workspace or project — or confirms
 * it again after an update asked for more. The capabilities confirmed must
 * be exactly the active version's; they're what the plugin may use here.
 */
export async function activatePlugin(
  input: ActivationInput & { capabilities: string[] },
): Promise<PluginResult> {
  const scope = await resolveScope(input);
  if (!scope) return { error: "not_found" };
  const actorId = await requirePermission(
    "plugin.enable",
    permissionCtx(scope),
  );

  const row = await db.plugin.findFirst({
    where: { pluginId: input.pluginId, status: "active" },
    select: { manifest: true },
  });
  const parsed = row ? validateManifest(row.manifest) : null;
  if (!parsed?.ok) return { error: "not_installed" };
  const manifest = parsed.manifest;
  if (!allowsLevel(manifest.levels, scope))
    return { error: "level_not_allowed" };
  // A project may only switch on what its workspace released for projects.
  if (
    scope.projectId &&
    !(await db.pluginGrant.findUnique({
      where: {
        pluginId_workspaceId: {
          pluginId: manifest.id,
          workspaceId: scope.workspaceId,
        },
      },
    }))
  )
    return { error: "not_granted" };
  if (!confirmsExactly(manifest.capabilities, input.capabilities))
    return { error: "capabilities_not_confirmed" };

  const scopeKey = activationScopeKey(scope);
  await db.pluginActivation.upsert({
    where: { pluginId_scopeKey: { pluginId: manifest.id, scopeKey } },
    create: {
      pluginId: manifest.id,
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      scopeKey,
      capabilities: manifest.capabilities,
      activatedById: actorId,
    },
    update: {
      enabled: true,
      capabilities: manifest.capabilities,
      activatedById: actorId,
      activatedAt: new Date(),
    },
  });
  await recordAudit({
    action: "plugin.activated",
    actorId,
    target: { type: "plugin", id: manifest.id, label: manifest.name },
    ...auditScope(scope),
    meta: { version: manifest.version, capabilities: manifest.capabilities },
  });
  done();
  return { ok: true };
}

/** Switches a plugin off here. Its settings and storage stay. */
export async function deactivatePlugin(
  input: ActivationInput,
): Promise<PluginResult> {
  const scope = await resolveScope(input);
  if (!scope) return { error: "not_found" };
  const actorId = await requirePermission(
    "plugin.enable",
    permissionCtx(scope),
  );
  const scopeKey = activationScopeKey(scope);
  const { count } = await db.pluginActivation.updateMany({
    where: { pluginId: input.pluginId, scopeKey },
    data: { enabled: false },
  });
  if (count === 0) return { error: "not_activated" };
  await recordAudit({
    action: "plugin.deactivated",
    actorId,
    target: {
      type: "plugin",
      id: input.pluginId,
      label: await pluginLabel(input.pluginId),
    },
    ...auditScope(scope),
  });
  done();
  return { ok: true };
}

/** Removes a plugin's activation here, with its settings and storage. */
export async function deletePluginData(
  input: ActivationInput,
): Promise<PluginResult> {
  const scope = await resolveScope(input);
  if (!scope) return { error: "not_found" };
  const actorId = await requirePermission(
    "plugin.enable",
    permissionCtx(scope),
  );
  const scopeKey = activationScopeKey(scope);
  const { count } = await db.pluginActivation.deleteMany({
    where: { pluginId: input.pluginId, scopeKey },
  });
  if (count === 0) return { error: "not_activated" };
  await recordAudit({
    action: "plugin.data.deleted",
    actorId,
    target: {
      type: "plugin",
      id: input.pluginId,
      label: await pluginLabel(input.pluginId),
    },
    ...auditScope(scope),
  });
  done();
  return { ok: true };
}

// ─── Release for projects (BARY-143) ────────────────────────────────────────

/**
 * Lets the projects of a workspace switch a plugin on themselves — or stops
 * them. Taking it back switches the projects' activations off; their
 * settings and storage stay, so granting again brings them back as they were
 * once someone switches them on.
 */
export async function setPluginGrant(input: {
  pluginId: string;
  workspaceId: string;
  granted: boolean;
}): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.enable", {
    workspaceId: input.workspaceId,
  });
  const key = { pluginId: input.pluginId, workspaceId: input.workspaceId };
  let switchedOff = 0;
  if (input.granted) {
    const row = await db.plugin.findFirst({
      where: { pluginId: input.pluginId, status: "active" },
      select: { manifest: true },
    });
    const parsed = row ? validateManifest(row.manifest) : null;
    if (!parsed?.ok) return { error: "not_installed" };
    if (!parsed.manifest.levels.includes("project"))
      return { error: "level_not_allowed" };
    await db.pluginGrant.upsert({
      where: { pluginId_workspaceId: key },
      create: { ...key, grantedById: actorId },
      update: {},
    });
  } else {
    const [, off] = await db.$transaction([
      db.pluginGrant.deleteMany({ where: key }),
      db.pluginActivation.updateMany({
        where: { ...key, projectId: { not: null } },
        data: { enabled: false },
      }),
    ]);
    switchedOff = off.count;
  }
  await recordAudit({
    action: input.granted ? "plugin.granted" : "plugin.grant.revoked",
    actorId,
    target: {
      type: "plugin",
      id: input.pluginId,
      label: await pluginLabel(input.pluginId),
    },
    workspaceId: input.workspaceId,
    ...(!input.granted && { meta: { projectsSwitchedOff: switchedOff } }),
  });
  done();
  return { ok: true };
}

// ─── Looking before installing (BARY-143) ───────────────────────────────────

export interface DirectoryPlugin {
  id: string;
  name: string;
  author: string;
  description: string;
  repo: string;
  kind: string;
  levels: string[];
  /** Every version the directory lists, newest first. */
  versions: string[];
  /** The installed version that's active (or blocked), if any. */
  installed: string | null;
  blocked: boolean;
}

/** What a source offers, next to what's installed. Reading it also notes
 *  the outcome on the source (`lastSyncAt`). */
export async function browseSource(
  sourceId: string,
): Promise<PluginResult<{ plugins: DirectoryPlugin[]; skipped: number }>> {
  await requirePermission("plugin.manage", PLATFORM);
  const read = await readSource(sourceId);
  done();
  if (!read.ok) return { error: read.error };
  const rows = await db.plugin.findMany({
    where: {
      pluginId: { in: read.entries.map((e) => e.id) },
      status: { in: ["active", "blocked"] },
    },
    select: { pluginId: true, version: true, status: true },
  });
  return {
    ok: true,
    skipped: read.issues.length,
    plugins: read.entries.map((e) => {
      const row = rows.find((r) => r.pluginId === e.id);
      return {
        id: e.id,
        name: e.name,
        author: e.author,
        description: e.description,
        repo: e.repo,
        kind: e.kind,
        levels: e.levels,
        versions: Object.keys(e.versions).sort((a, b) => compareSemver(b, a)),
        installed: row?.version ?? null,
        blocked: row?.status === "blocked",
      };
    }),
  };
}

export interface ReleasePreview {
  id: string;
  name: string;
  version: string;
  author: string;
  authorUrl: string | null;
  description: string;
  license: string;
  kind: string;
  levels: string[];
  capabilities: string[];
  network: string[];
  minBaryntVersion: string;
  hash: string;
  /** Size of the code, in bytes. */
  codeSize: number;
  /** The release's screenshots as data URLs — it isn't stored yet, so
   *  there's nowhere else to serve them from. */
  previews: { title: string; src: string }[];
}

/**
 * Loads and checks a release without installing it — what the install
 * dialog shows before anyone confirms. Installing loads it again: the
 * server never trusts what a dialog was shown.
 */
export async function previewRelease(input: {
  sourceId: string;
  pluginId: string;
  version: string;
}): Promise<PluginResult<{ preview: ReleasePreview }>> {
  await requirePermission("plugin.manage", PLATFORM);
  const release = await fetchRelease(
    input.sourceId,
    input.pluginId,
    input.version,
  );
  if (!release.ok) return { error: release.error };
  const m = release.manifest;
  return {
    ok: true,
    preview: {
      id: m.id,
      name: m.name,
      version: m.version,
      author: m.author,
      authorUrl: m.authorUrl ?? null,
      description: m.description,
      license: m.license,
      kind: m.kind,
      levels: m.levels,
      capabilities: m.capabilities,
      network: m.network,
      minBaryntVersion: m.minBaryntVersion,
      hash: release.hash,
      codeSize: release.files["main.js"]?.byteLength ?? 0,
      previews: (m.previews ?? []).map(({ file, title }) => ({
        title,
        src: `data:image/${file.endsWith(".png") ? "png" : "webp"};base64,${Buffer.from(
          release.files[file as PreviewFileName] as Uint8Array,
        ).toString("base64")}`,
      })),
    },
  };
}
