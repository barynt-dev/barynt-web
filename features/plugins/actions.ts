"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { devVersion, readDevPlugin, storedFiles } from "@/features/plugins/dev";
import {
  fetchRelease,
  forgetSource,
  readDirectory,
  readSource,
  sealSourceToken,
} from "@/features/plugins/directory";
import { ensureInboundHooks } from "@/features/plugins/inbound";
import { linkRuleStatuses } from "@/features/plugins/link";
import { getPluginIssueActions } from "@/features/plugins/slots";
import { DELIVERY_SELECT } from "@/features/webhooks/deliveries";
import type { WebhookDelivery } from "@/features/webhooks/types";
import { APP_VERSION } from "@/lib/app-info";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  currentUserId,
  hasPermission,
  PLATFORM,
  requirePermission,
} from "@/lib/permissions";
import { aboutDoc } from "@/lib/plugins/about";
import { activationScopeKey } from "@/lib/plugins/activation";
import {
  isDevUrl,
  pluginDevBase,
  pluginDevSources,
  pluginInternalHosts,
} from "@/lib/plugins/dev";
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
import {
  isCompatible,
  localizedAbout,
  localizedDescription,
  type PluginLink,
  type PluginManifest,
  serviceAddressMode,
  validateManifest,
} from "@/lib/plugins/manifest";
import type { PluginActionEntry } from "@/lib/plugins/plugin-actions";
import { credentialScopeKey } from "@/lib/plugins/proxy";
import { compareSemver } from "@/lib/plugins/semver";
import {
  checkServiceAddress,
  type ServiceAddressMode,
  type ServiceSummary,
  serviceSummary,
} from "@/lib/plugins/service";
import { checkSettings } from "@/lib/plugins/settings";
import type { PMDoc } from "@/lib/richtext/types";
import { sealSecret } from "@/lib/secret-box";
import { sendLifecycle } from "@/lib/webhooks/deliver";
import {
  ensureBot,
  ensureServiceIdentity,
  revokeAppTokens,
} from "@/lib/webhooks/plugin-targets";
import { placeSettings } from "./settings-options";

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
  forgetSource(id);
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

/** Reads a source's directory right now, not what the store kept from a
 *  few minutes ago ("Fetch now"). */
export async function refreshPluginSource(id: string): Promise<PluginResult> {
  await requirePermission("plugin.manage", PLATFORM);
  forgetSource(id);
  const read = await readSource(id);
  done();
  return read.ok ? { ok: true } : { error: read.error };
}

/** Removes a source. Installed plugins stay — they no longer have it. */
export async function removePluginSource(id: string): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const source = await db.pluginSource.findUnique({ where: { id } });
  if (!source) return { error: "not_found" };
  await db.pluginSource.delete({ where: { id } });
  forgetSource(id);
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

/**
 * A plugin from a local folder or dev server (BARY-221), development only:
 * read and checked like a release, minus the hash, and installed as the
 * active version — its row then follows the folder (`features/plugins/dev.ts`).
 * Another dev install of the same plugin is replaced.
 */
export async function installDevPlugin(input: {
  source: string;
  capabilities: string[];
}): Promise<PluginResult<{ id: string }>> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  if (!pluginDevSources().includes(input.source))
    return { error: "not_in_directory" };
  const read = await readDevPlugin(input.source);
  if (!read.ok) return { error: "invalid_manifest" };
  const { manifest, files, fingerprint } = read;
  if (!confirmsExactly(manifest.capabilities, input.capabilities))
    return { error: "capabilities_not_confirmed" };
  const blocked = await db.plugin.count({
    where: { pluginId: manifest.id, status: "blocked" },
  });
  if (blocked > 0) return { error: "blocked" };

  const row = await db.$transaction(async (tx) => {
    await tx.plugin.deleteMany({
      where: { pluginId: manifest.id, devSource: { not: null } },
    });
    await tx.plugin.updateMany({
      where: { pluginId: manifest.id, status: "active" },
      data: { status: "superseded" },
    });
    return tx.plugin.create({
      data: {
        pluginId: manifest.id,
        version: devVersion(manifest),
        kind: manifest.kind,
        hash: fingerprint,
        manifest: manifest as unknown as Prisma.InputJsonValue,
        devSource: input.source,
        installedById: actorId,
        // Kept like a release's, though frames read the folder.
        files: { create: storedFiles(files) },
      },
      select: { id: true },
    });
  });

  await recordAudit({
    action: "plugin.installed",
    actorId,
    target: { type: "plugin", id: manifest.id, label: manifest.name },
    meta: {
      version: devVersion(manifest),
      kind: manifest.kind,
      capabilities: manifest.capabilities,
      network: manifest.network,
      dev: input.source,
    },
  });
  done();
  return { ok: true, id: row.id };
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
  const activation = await db.pluginActivation.upsert({
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
    select: { id: true },
  });
  // A plugin with its own server hears that it's on — and gets the secret
  // its messages are signed with (BARY-212) and its bot's token (BARY-213). In the background: a slow
  // server doesn't hold up switching it on.
  // Hooks other services call it through (BARY-215) — the same addresses
  // each time it's switched on again.
  if (manifest.contributes.inboundHooks?.length)
    await ensureInboundHooks(activation.id, manifest);
  // Rules of a `link` hook act as the plugin's app, server or not (BARY-227).
  if (manifest.contributes.inboundHooks?.some((h) => h.rules?.length))
    await ensureBot(activation.id, manifest);
  if (
    manifest.service &&
    (await ensureServiceIdentity(activation.id, manifest))
  )
    void sendLifecycle(activation.id, "app.installed");
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
  const off = await db.pluginActivation.findUnique({
    where: { pluginId_scopeKey: { pluginId: input.pluginId, scopeKey } },
    select: { id: true, serviceSecret: true },
  });
  if (off?.serviceSecret) {
    // Its bot stops at once; the server hears it's off.
    await revokeAppTokens(off.id);
    void sendLifecycle(off.id, "app.uninstalled");
  }
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

/**
 * Saves a switched-on plugin's settings here (BARY-201). Only what its
 * active version's manifest declares is kept, checked by type
 * (`checkSettings`); the form's other fields are ignored.
 */
export async function savePluginSettings(
  input: ActivationInput & { values: Record<string, unknown> },
): Promise<PluginResult> {
  const scope = await resolveScope(input);
  if (!scope) return { error: "not_found" };
  const actorId = await requirePermission(
    "plugin.enable",
    permissionCtx(scope),
  );
  const [activation, active] = await Promise.all([
    db.pluginActivation.findUnique({
      where: {
        pluginId_scopeKey: {
          pluginId: input.pluginId,
          scopeKey: activationScopeKey(scope),
        },
      },
      select: { id: true },
    }),
    db.plugin.findFirst({
      where: { pluginId: input.pluginId, status: "active" },
      select: { manifest: true },
    }),
  ]);
  if (!activation) return { error: "not_activated" };
  const parsed = active ? validateManifest(active.manifest) : null;
  if (!parsed?.ok) return { error: "not_installed" };
  const checked = checkSettings(
    await placeSettings(scope, parsed.manifest.contributes.settings ?? []),
    input.values,
  );
  if (!checked.ok) return { error: "invalid_setting" };
  await db.pluginSettings.upsert({
    where: { activationId: activation.id },
    create: { activationId: activation.id, values: checked.values },
    update: { values: checked.values },
  });
  await recordAudit({
    action: "plugin.settings.updated",
    actorId,
    target: {
      type: "plugin",
      id: input.pluginId,
      label: await pluginLabel(input.pluginId),
    },
    ...auditScope(scope),
    // Which settings changed hands, not what they hold — a channel name or
    // an address may be nobody else's business.
    meta: { keys: Object.keys(checked.values) },
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
  // Its credentials here go with its data (BARY-147).
  await db.pluginCredential.deleteMany({
    where: { pluginId: input.pluginId, scopeKey },
  });
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

// ─── Credentials (BARY-147) ─────────────────────────────────────────────────

/** A secret's longest value — an access token is far shorter. */
const CREDENTIAL_MAX = 4000;

interface CredentialInput {
  pluginId: string;
  key: string;
  workspaceId: string;
  projectId?: string | null;
}

/**
 * Who may change a credential, and where it's kept: a workspace's needs
 * `plugin.enable` in the workspace, a project's in the project; a person's
 * own (`user`) only them. The credential must be one the plugin's active
 * version declares.
 */
async function credentialTarget(input: CredentialInput) {
  const row = await db.plugin.findFirst({
    where: { pluginId: input.pluginId, status: "active" },
    select: { manifest: true },
  });
  const parsed = row ? validateManifest(row.manifest) : null;
  if (!parsed?.ok) return { error: "not_installed" } as const;
  const credential = (parsed.manifest.contributes.credentials ?? []).find(
    (c) => c.key === input.key,
  );
  if (!credential) return { error: "not_found" } as const;

  if (credential.level === "user") {
    const actorId = await currentUserId();
    if (!actorId) return { error: "not_found" } as const;
    return {
      actorId,
      scopeKey: `us:${actorId}`,
      scope: null,
      label: parsed.manifest.name,
    } as const;
  }
  const scope = await resolveScope({
    pluginId: input.pluginId,
    workspaceId: input.workspaceId,
    projectId: credential.level === "project" ? input.projectId : null,
  });
  if (!scope || (credential.level === "project" && !scope.projectId))
    return { error: "not_found" } as const;
  const actorId = await requirePermission(
    "plugin.enable",
    permissionCtx(scope),
  );
  const scopeKey = credentialScopeKey(credential.level, scope, actorId);
  if (!scopeKey) return { error: "not_found" } as const;
  return { actorId, scopeKey, scope, label: parsed.manifest.name } as const;
}

/**
 * Keeps a credential a plugin declares — sealed, never shown again. Barynt
 * adds it to the plugin's requests to its host; the plugin never sees it.
 * A workspace's or project's credential lands in the audit log (which one,
 * never the value).
 */
export async function savePluginCredential(
  input: CredentialInput & { value: string },
): Promise<PluginResult> {
  const value = typeof input.value === "string" ? input.value.trim() : "";
  if (!value || value.length > CREDENTIAL_MAX)
    return { error: "invalid_setting" };
  const target = await credentialTarget(input);
  if ("error" in target) return { error: target.error ?? "not_found" };
  const valueCipher = sealSecret(value, "plugin-credential");
  await db.pluginCredential.upsert({
    where: {
      pluginId_scopeKey_key: {
        pluginId: input.pluginId,
        scopeKey: target.scopeKey,
        key: input.key,
      },
    },
    create: {
      pluginId: input.pluginId,
      scopeKey: target.scopeKey,
      key: input.key,
      valueCipher,
      updatedById: target.actorId,
    },
    update: { valueCipher, updatedById: target.actorId },
  });
  if (target.scope)
    await recordAudit({
      action: "plugin.credential.set",
      actorId: target.actorId,
      target: { type: "plugin", id: input.pluginId, label: target.label },
      ...auditScope(target.scope),
      meta: { key: input.key },
    });
  done();
  return { ok: true };
}

/** Removes a credential; the plugin's requests to its host fail with
 *  `credential_missing` until someone keeps one again. */
export async function removePluginCredential(
  input: CredentialInput,
): Promise<PluginResult> {
  const target = await credentialTarget(input);
  if ("error" in target) return { error: target.error ?? "not_found" };
  await db.pluginCredential.deleteMany({
    where: {
      pluginId: input.pluginId,
      scopeKey: target.scopeKey,
      key: input.key,
    },
  });
  if (target.scope)
    await recordAudit({
      action: "plugin.credential.removed",
      actorId: target.actorId,
      target: { type: "plugin", id: input.pluginId, label: target.label },
      ...auditScope(target.scope),
      meta: { key: input.key },
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
  const locale = await getLocale();
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
        description: localizedDescription(e, locale),
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
  /** Its own server and what it hears about (BARY-212). */
  service: ServiceSummary | null;
  minBaryntVersion: string;
  /** Does it run on this Barynt? Shown either way (BARY-236), installed
   *  only when it does. */
  compatible: boolean;
  hash: string;
  /** Size of the code, in bytes. */
  codeSize: number;
  /** The release's screenshots as data URLs — it isn't stored yet, so
   *  there's nowhere else to serve them from. */
  previews: { title: string; src: string }[];
  /** Its page text, in the person's language (BARY-237). */
  about: PMDoc | null;
  links: PluginLink[];
}

/**
 * Loads and checks a release without installing it — what the store and
 * the install dialog show before anyone confirms, also for a version that
 * doesn't run on this Barynt (`compatible`). Installing loads it again: the
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
    { anyBarynt: true },
  );
  if (!release.ok) return { error: release.error };
  const m = release.manifest;
  const locale = await getLocale();
  return {
    ok: true,
    preview: {
      id: m.id,
      name: m.name,
      version: m.version,
      author: m.author,
      authorUrl: m.authorUrl ?? null,
      description: localizedDescription(m, locale),
      license: m.license,
      kind: m.kind,
      levels: m.levels,
      capabilities: m.capabilities,
      network: m.network,
      service: m.service ? serviceSummary(m.service) : null,
      minBaryntVersion: m.minBaryntVersion,
      compatible: isCompatible(m, APP_VERSION),
      hash: release.hash,
      codeSize: release.files["main.js"]?.byteLength ?? 0,
      about: aboutDoc(localizedAbout(m, locale)),
      links: m.links ?? [],
      previews: (m.previews ?? []).map(({ file, title }) => ({
        title,
        src: `data:image/${file.endsWith(".png") ? "png" : "webp"};base64,${Buffer.from(
          release.files[file as PreviewFileName] as Uint8Array,
        ).toString("base64")}`,
      })),
    },
  };
}

/**
 * The plugins' actions for an issue (BARY-152) — for a card's quick actions
 * and the palette, which don't have the issue's detail at hand. By id, or
 * by `PREFIX-123` in a workspace; nothing for an issue this person doesn't
 * see.
 */
export async function listIssuePluginActions(input: {
  issue: string;
  workspaceId?: string;
}): Promise<{
  issueId: string;
  workspaceId: string;
  projectId: string;
  actions: PluginActionEntry[];
} | null> {
  const ref = input.issue.match(/^([A-Z0-9]+)-(\d+)$/i);
  const select = {
    id: true,
    projectId: true,
    project: { select: { workspaceId: true } },
  } as const;
  const row =
    ref && input.workspaceId
      ? await db.issue.findFirst({
          where: {
            key: Number(ref[2]),
            project: {
              workspaceId: input.workspaceId,
              prefix: ref[1].toUpperCase(),
            },
          },
          select,
        })
      : await db.issue.findUnique({ where: { id: input.issue }, select });
  if (!row) return null;
  if (!(await hasPermission("project.view", { projectId: row.projectId })))
    return null;
  const place = {
    workspaceId: row.project.workspaceId,
    projectId: row.projectId,
  };
  return {
    issueId: row.id,
    ...place,
    actions: await getPluginIssueActions(place),
  };
}

// ─── Its server (BARY-212) ───────────────────────────────────────────────────

/** The activation, after checking whoever asks may manage it. */
async function manageableActivation(activationId: string) {
  const activation = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: { id: true, pluginId: true, workspaceId: true, projectId: true },
  });
  if (!activation) return null;
  const actorId = await requirePermission(
    "plugin.enable",
    activation.projectId
      ? { projectId: activation.projectId }
      : { workspaceId: activation.workspaceId },
  );
  return { ...activation, actorId };
}

/**
 * Switches one of a `link` hook's rules on, with the status it sets, or off
 * (`status: null`) — for this project or workspace (BARY-227). The status
 * is one of the workspace's; the rule one the plugin's manifest names.
 */
export async function setInboundRule(input: {
  hookId: string;
  ruleId: string;
  status: string | null;
}): Promise<PluginResult> {
  const hook = await db.pluginInboundHook.findUnique({
    where: { id: input.hookId },
    select: { id: true, hookId: true, activationId: true, rules: true },
  });
  if (!hook) return { error: "not_activated" };
  const activation = await manageableActivation(hook.activationId);
  if (!activation) return { error: "not_activated" };
  const row = await db.plugin.findFirst({
    where: { pluginId: activation.pluginId, status: "active" },
    select: { manifest: true },
  });
  const parsed = row ? validateManifest(row.manifest) : null;
  if (!parsed?.ok) return { error: "not_activated" };
  const rule = parsed.manifest.contributes.inboundHooks
    ?.find((h) => h.id === hook.hookId)
    ?.rules?.find((r) => r.id === input.ruleId);
  if (!rule) return { error: "invalid_setting" };
  if (input.status) {
    const known = await db.workspaceStatus.count({
      where: { workspaceId: activation.workspaceId, statusId: input.status },
    });
    if (known === 0) return { error: "invalid_setting" };
  }

  const rules = linkRuleStatuses(hook.rules);
  if (input.status) rules[rule.id] = input.status;
  else delete rules[rule.id];
  await db.pluginInboundHook.update({
    where: { id: hook.id },
    data: { rules },
  });
  if (input.status) await ensureBot(activation.id, parsed.manifest);
  await recordAudit({
    action: "plugin.inbound.rules",
    actorId: activation.actorId,
    target: {
      type: "plugin",
      id: activation.pluginId,
      label: parsed.manifest.name,
    },
    workspaceId: activation.workspaceId,
    projectId: activation.projectId,
    meta: { hook: hook.hookId, rule: rule.id, status: input.status },
  });
  done();
  return { ok: true };
}

/** The latest deliveries to a plugin's server, newest first. */
export async function listPluginDeliveries(
  activationId: string,
): Promise<WebhookDelivery[]> {
  if (!(await manageableActivation(activationId))) return [];
  return db.eventDelivery.findMany({
    where: { activationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: DELIVERY_SELECT,
  });
}

/** Sends to a paused plugin's server again — what was given up on while
 *  it was paused isn't sent later. */
export async function resumePluginService(
  activationId: string,
): Promise<PluginResult> {
  const activation = await manageableActivation(activationId);
  if (!activation) return { error: "not_activated" };
  await db.pluginActivation.update({
    where: { id: activationId },
    data: { servicePausedAt: null, serviceFailingSince: null },
  });
  await recordAudit({
    action: "plugin.service.resumed",
    actorId: activation.actorId,
    target: {
      type: "plugin",
      id: activation.pluginId,
      label: await pluginLabel(activation.pluginId),
    },
    workspaceId: activation.workspaceId,
    projectId: activation.projectId,
  });
  done();
  return { ok: true };
}

// ─── Where a plugin's server is (BARY-223) ──────────────────────────────────

/** The active version's manifest, when it has a server reached `mode`'s way. */
async function serviceManifest(pluginId: string, mode: ServiceAddressMode) {
  const row = await db.plugin.findFirst({
    where: { pluginId, status: "active" },
    select: { manifest: true },
  });
  const parsed = row ? validateManifest(row.manifest) : null;
  if (!parsed?.ok || !parsed.manifest.service) return null;
  return serviceAddressMode(parsed.manifest.service) === mode
    ? parsed.manifest
    : null;
}

/** A server that moved hears it's on — with a new secret, so the one
 *  before can't read what goes to the new one, and a new app token. */
async function connectService(activationId: string, manifest: PluginManifest) {
  if (await ensureServiceIdentity(activationId, manifest, { newSecret: true }))
    void sendLifecycle(activationId, "app.installed");
}

/**
 * The address of a `platform` plugin's server, which whoever runs this
 * Barynt runs — a container beside it, say. Empty takes it away. Every
 * place the plugin is on hears about it at once.
 */
export async function setPluginServiceAddress(input: {
  pluginId: string;
  url: string;
}): Promise<PluginResult> {
  const actorId = await requirePermission("plugin.manage", PLATFORM);
  const manifest = await serviceManifest(input.pluginId, "platform");
  if (!manifest) return { error: "not_found" };
  let url: string | null = null;
  if (input.url.trim()) {
    // The operator's own: plain http to a container is fine.
    const checked = checkServiceAddress(input.url, {
      hosts: [],
      local: true,
      plain: true,
    });
    if (!checked.ok) return { error: checked.error };
    url = checked.url;
  }
  if (url)
    await db.pluginServiceAddress.upsert({
      where: { pluginId: input.pluginId },
      create: { pluginId: input.pluginId, url, updatedById: actorId },
      update: { url, updatedById: actorId },
    });
  else
    await db.pluginServiceAddress.deleteMany({
      where: { pluginId: input.pluginId },
    });

  const activations = await db.pluginActivation.findMany({
    where: { pluginId: input.pluginId, enabled: true },
    select: { id: true },
  });
  if (url) for (const a of activations) await connectService(a.id, manifest);
  await recordAudit({
    action: "plugin.service.address",
    actorId,
    target: { type: "plugin", id: input.pluginId, label: manifest.name },
    meta: { url },
  });
  done();
  return { ok: true };
}

/**
 * The address of an `activation` plugin's server, given where it's
 * switched on — a server just for this workspace or project. Empty takes it
 * away: the plugin keeps running in the browser, its server hears nothing.
 */
export async function setActivationServiceAddress(input: {
  activationId: string;
  url: string;
}): Promise<PluginResult> {
  const activation = await manageableActivation(input.activationId);
  if (!activation) return { error: "not_activated" };
  const manifest = await serviceManifest(activation.pluginId, "activation");
  if (!manifest) return { error: "not_found" };
  let url: string | null = null;
  if (input.url.trim()) {
    // Not the operator: plain http only to a host the operator let through.
    const checked = checkServiceAddress(input.url, {
      hosts: pluginInternalHosts(),
      local: !!pluginDevBase(),
    });
    if (!checked.ok) return { error: checked.error };
    url = checked.url;
  }
  await db.pluginActivation.update({
    where: { id: activation.id },
    data: { serviceUrl: url },
  });
  if (url) await connectService(activation.id, manifest);
  await recordAudit({
    action: "plugin.service.address",
    actorId: activation.actorId,
    target: { type: "plugin", id: activation.pluginId, label: manifest.name },
    workspaceId: activation.workspaceId,
    projectId: activation.projectId,
    meta: { url },
  });
  done();
  return { ok: true };
}

/** Sends `app.installed` again — to check the server answers, and so one
 *  that lost its installations gets them back. */
export async function testPluginService(
  activationId: string,
): Promise<PluginResult> {
  const activation = await manageableActivation(activationId);
  if (!activation) return { error: "not_activated" };
  await sendLifecycle(activationId, "app.installed");
  done();
  return { ok: true };
}
