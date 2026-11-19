import "server-only";
import { randomBytes } from "node:crypto";
import { hashApiToken } from "@/lib/api-auth";
import { appUrl } from "@/lib/app-url";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { appApiScopes } from "@/lib/plugins/app-access";
import { pluginDevBase, pluginInternalHosts } from "@/lib/plugins/dev";
import {
  type PluginManifest as Manifest,
  serviceAddressMode,
  validateManifest,
} from "@/lib/plugins/manifest";
import {
  eventCapability,
  eventForPlugin,
  isLocalServiceUrl,
  type LifecycleEvent,
  PLUGIN_EVENTS,
  type PluginEvent,
  serviceUrlsFromEnv,
} from "@/lib/plugins/service";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { pickUserColor } from "@/lib/user-defaults";
import {
  type AttemptOutcome,
  shouldDisable,
  succeeded,
  webhookInternalHosts,
} from "./retry";

// Plugins' own servers as delivery targets (BARY-212). Which switched-on
// plugins hear about an event and what of it they get; where a delivery to
// one goes and with which secret; what happens when it keeps failing. The
// queue itself is the webhooks' (`./deliver.ts`).

const SECRET_PURPOSE = "plugin-service";

interface Activation {
  id: string;
  pluginId: string;
  projectId: string | null;
  capabilities: string[];
}

/** The active versions' manifests of these plugins, by plugin id. */
async function manifestsOf(
  pluginIds: string[],
): Promise<Map<string, Manifest>> {
  const rows = await db.plugin.findMany({
    where: { pluginId: { in: [...new Set(pluginIds)] }, status: "active" },
    select: { pluginId: true, manifest: true },
  });
  const map = new Map<string, Manifest>();
  for (const row of rows) {
    const parsed = validateManifest(row.manifest);
    if (parsed.ok) map.set(row.pluginId, parsed.manifest);
  }
  return map;
}

/**
 * Where a plugin's server is for one activation (BARY-223), by who runs
 * it: the manifest's address, the operator's (`PLUGIN_SERVICE_URLS` before
 * what the platform admin saved), or the one given where it was switched
 * on. `null` while nobody has given one. `operator` marks an address the
 * operator chose — its host may be on the private network.
 */
export async function serviceAddressOf(
  activation: { pluginId: string; serviceUrl: string | null },
  manifest: Manifest,
): Promise<{ url: string; operator: boolean } | null> {
  if (!manifest.service) return null;
  const mode = serviceAddressMode(manifest.service);
  if (mode === "fixed")
    return manifest.service.url
      ? { url: manifest.service.url, operator: false }
      : null;
  if (mode === "activation")
    return activation.serviceUrl
      ? { url: activation.serviceUrl, operator: false }
      : null;
  const url = await platformServiceUrl(activation.pluginId);
  return url ? { url: url.url, operator: true } : null;
}

/** The operator's address for a `platform` plugin's server, and whether
 *  it comes from the environment (and so can't be changed in Barynt). */
export async function platformServiceUrl(
  pluginId: string,
): Promise<{ url: string; fromEnv: boolean } | null> {
  const fromEnv = serviceUrlsFromEnv(process.env.PLUGIN_SERVICE_URLS).get(
    pluginId,
  );
  if (fromEnv) return { url: fromEnv, fromEnv: true };
  const row = await db.pluginServiceAddress.findUnique({
    where: { pluginId },
    select: { url: true },
  });
  return row ? { url: row.url, fromEnv: false } : null;
}

/** Whether any switched-on plugin of the workspace has a server to tell. */
export async function hasPluginListeners(workspaceId: string) {
  const n = await db.pluginActivation.count({
    where: {
      workspaceId,
      enabled: true,
      serviceSecret: { not: null },
      servicePausedAt: null,
    },
  });
  return n > 0;
}

/**
 * Who of the workspace's switched-on plugins hears about this event, and
 * the body each gets. A plugin hears only what it subscribed to and
 * confirmed the capability for; a project's plugin only that project's
 * events; a workspace's plugin nothing from a private project. A change a
 * plugin made itself doesn't come back to it.
 */
export async function pluginTargetsFor(envelope: {
  event: string;
  workspaceId: string;
  projectId: string | null;
  via: { plugin: { id: string } } | null;
  data: unknown;
}): Promise<{ activationId: string; payload: string }[]> {
  if (!(PLUGIN_EVENTS as readonly string[]).includes(envelope.event)) return [];
  const event = envelope.event as PluginEvent;
  const activations: Activation[] = await db.pluginActivation.findMany({
    where: {
      workspaceId: envelope.workspaceId,
      enabled: true,
      serviceSecret: { not: null },
      servicePausedAt: null,
    },
    select: { id: true, pluginId: true, projectId: true, capabilities: true },
  });
  if (activations.length === 0) return [];

  const [manifests, project] = await Promise.all([
    manifestsOf(activations.map((a) => a.pluginId)),
    envelope.projectId
      ? db.project.findUnique({
          where: { id: envelope.projectId },
          select: { visibility: true },
        })
      : null,
  ]);
  const isPrivate = project?.visibility === "private";

  return activations
    .filter((a) => {
      const service = manifests.get(a.pluginId)?.service;
      if (!service?.events.includes(event)) return false;
      if (envelope.via?.plugin.id === a.pluginId) return false;
      if (a.projectId) return a.projectId === envelope.projectId;
      return !isPrivate;
    })
    .filter((a) => a.capabilities.includes(eventCapability(event)))
    .map((a) => ({
      activationId: a.id,
      payload: JSON.stringify(eventForPlugin(envelope, a.capabilities)),
    }));
}

/** Where one delivery to a plugin's server goes — or why it can't. */
export async function pluginTarget(
  activationId: string,
  event: string,
): Promise<
  | {
      url: string;
      secret: string;
      internalHosts: string[];
      failingSince: Date | null;
    }
  | { closed: string }
> {
  const activation = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: {
      pluginId: true,
      enabled: true,
      serviceSecret: true,
      serviceFailingSince: true,
      servicePausedAt: true,
      serviceUrl: true,
    },
  });
  if (!activation?.serviceSecret) return { closed: "The plugin has no server" };
  const lifecycle = event.startsWith("app.");
  if (!lifecycle && !activation.enabled)
    return { closed: "The plugin is switched off" };
  if (!lifecycle && activation.servicePausedAt)
    return { closed: "Deliveries to the plugin are paused" };
  const manifest = (await manifestsOf([activation.pluginId])).get(
    activation.pluginId,
  );
  if (!manifest?.service)
    return { closed: "The plugin's version has no server" };
  const secret = openSecret(activation.serviceSecret, SECRET_PURPOSE);
  if (!secret) return { closed: "The plugin's secret can't be read" };

  const address = await serviceAddressOf(activation, manifest);
  if (!address) return { closed: "The plugin's server has no address yet" };
  const url = new URL(address.url);
  const dev = pluginDevBase();
  return {
    url: address.url,
    secret,
    internalHosts: [
      ...webhookInternalHosts(),
      ...pluginInternalHosts(),
      // A plugin built on this machine, while developing.
      ...(dev && isLocalServiceUrl(url) ? [url.host] : []),
      // A server the operator runs — a container on the same network.
      ...(address.operator ? [url.host] : []),
    ],
    failingSince: activation.serviceFailingSince,
  };
}

/** After an attempt: the day of failures, and pausing after a full one. */
export async function recordOnActivation(
  activationId: string,
  failingSince: Date | null,
  outcome: AttemptOutcome,
  now: Date,
) {
  const ok = succeeded(outcome);
  const since = ok ? null : (failingSince ?? now);
  await db.pluginActivation.update({
    where: { id: activationId },
    data: { serviceFailingSince: since },
  });
  if (ok || !shouldDisable(since, now)) return;

  const { count } = await db.pluginActivation.updateMany({
    where: { id: activationId, servicePausedAt: null },
    data: { servicePausedAt: now },
  });
  if (count === 0) return;
  const paused = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: { pluginId: true, workspaceId: true, projectId: true },
  });
  if (!paused) return;
  const manifest = (await manifestsOf([paused.pluginId])).get(paused.pluginId);
  await recordAudit({
    action: "plugin.service.paused",
    actorId: null,
    actorLabel: "Barynt",
    target: {
      type: "plugin",
      id: paused.pluginId,
      label: manifest?.name ?? paused.pluginId,
    },
    workspaceId: paused.workspaceId,
    projectId: paused.projectId,
  });
}

const TOKEN_PURPOSE = "plugin-app-token";

/**
 * What a switched-on plugin's server needs, made when it's switched on
 * (BARY-212, BARY-213): the secret its messages are signed with (made once,
 * kept), its bot — the identity it acts as — and a fresh app token for that
 * bot, replacing the one before. `false` when the plugin has no server, or
 * its server no address yet (BARY-223). `newSecret` when the server moved:
 * the one before can't read what goes to the new one.
 */
export async function ensureServiceIdentity(
  activationId: string,
  manifest: Manifest,
  { newSecret = false }: { newSecret?: boolean } = {},
): Promise<boolean> {
  if (!manifest.service) return false;
  const row = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: {
      pluginId: true,
      serviceUrl: true,
      serviceSecret: true,
      botUserId: true,
      capabilities: true,
    },
  });
  if (!row) return false;
  if (!(await serviceAddressOf(row, manifest))) return false;

  const botUserId = row.botUserId ?? (await createBot(manifest));
  // A new token each time it's switched on (again) — the old one stops.
  const token = `bpa_${randomBytes(32).toString("base64url")}`;
  await db.$transaction([
    db.apiKey.updateMany({
      where: { activationId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    db.apiKey.create({
      data: {
        userId: botUserId,
        activationId,
        name: `${manifest.name} (app)`,
        prefix: token.slice(0, 12),
        tokenHash: hashApiToken(token),
        scopes: appApiScopes(row.capabilities),
      },
    }),
    db.pluginActivation.update({
      where: { id: activationId },
      data: {
        botUserId,
        serviceToken: sealSecret(token, TOKEN_PURPOSE),
        ...((newSecret || !row.serviceSecret) && {
          serviceSecret: sealSecret(
            randomBytes(32).toString("base64url"),
            SECRET_PURPOSE,
          ),
        }),
      },
    }),
  ]);
  return true;
}

/**
 * The plugin's bot, made once — the identity a `link` hook's rules act as
 * when the plugin has no server to get one with its token (BARY-227).
 */
export async function ensureBot(
  activationId: string,
  manifest: Manifest,
): Promise<void> {
  const row = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: { botUserId: true },
  });
  if (!row || row.botUserId) return;
  await db.pluginActivation.update({
    where: { id: activationId },
    data: { botUserId: await createBot(manifest) },
  });
}

/** A bot for a plugin: named like it — "GitLab (App)", so a comment or a
 *  change it made says so wherever it shows — no address, no way to sign
 *  in. */
async function createBot(manifest: Manifest): Promise<string> {
  const bot = await db.user.create({
    data: {
      kind: "APP",
      firstName: `${manifest.name} (App)`,
      lastName: "",
      handle: `${manifest.id.replace(/[^a-z0-9]/g, "").slice(0, 20)}-app-${randomBytes(3).toString("hex")}`,
      color: pickUserColor(),
    },
    select: { id: true },
  });
  return bot.id;
}

/** Stops a switched-off plugin's app token. */
export async function revokeAppTokens(activationId: string): Promise<void> {
  await db.apiKey.updateMany({
    where: { activationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** What stands in for the secret in the stored copy of `app.installed`. */
export const SEALED = "[sealed]";

/**
 * A lifecycle message for a plugin's server: `app.installed` carries the
 * secret every later message is signed with — the server keeps it per
 * installation — and where Barynt is. `stored` is what the delivery row and
 * its log keep, with the secret left out; `sent` is built again for every
 * attempt, so the secret never sits in the queue in the clear.
 */
export async function lifecyclePayload(
  activationId: string,
  event: LifecycleEvent,
): Promise<{ workspaceId: string; stored: string; sent: string } | null> {
  const activation = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: {
      pluginId: true,
      workspaceId: true,
      projectId: true,
      serviceSecret: true,
      serviceToken: true,
      botUserId: true,
    },
  });
  if (!activation?.serviceSecret) return null;
  const secret = openSecret(activation.serviceSecret, SECRET_PURPOSE);
  if (!secret) return null;
  const token =
    activation.serviceToken &&
    openSecret(activation.serviceToken, TOKEN_PURPOSE);
  const message = (shown: string, shownToken: string | null) =>
    JSON.stringify({
      event,
      timestamp: Date.now(),
      workspaceId: activation.workspaceId,
      projectId: activation.projectId,
      data: {
        installationId: activationId,
        pluginId: activation.pluginId,
        baryntUrl: appUrl("/"),
        ...(event === "app.installed" && {
          secret: shown,
          // Its bot's token for Barynt's REST API (BARY-213).
          ...(shownToken && {
            token: shownToken,
            botUserId: activation.botUserId,
          }),
        }),
      },
    });
  return {
    workspaceId: activation.workspaceId,
    stored: message(SEALED, token ? SEALED : null),
    sent: message(secret, token || null),
  };
}

/** How long a server may act for the person who caused an event. */
export const ACTING_TTL_MS = 15 * 60_000;

/**
 * The body a plugin's server gets for an event, with a token to act for the
 * person who caused it (BARY-214): `acting: { token, userId, expiresAt }`.
 * Made fresh for each attempt, so it never sits in the queue; valid for 15
 * minutes; it can do what the person may and the plugin may too — never
 * more than either (`lib/permissions.ts`). Not when nobody (or an app)
 * caused it, or the plugin has no identity yet.
 */
export async function withActingToken(
  activationId: string,
  payload: string,
): Promise<string> {
  const message = JSON.parse(payload) as {
    actor?: { id: string } | null;
    [key: string]: unknown;
  };
  const actorId = message.actor?.id;
  if (!actorId) return payload;
  const [activation, person] = await Promise.all([
    db.pluginActivation.findUnique({
      where: { id: activationId },
      select: { capabilities: true, botUserId: true, pluginId: true },
    }),
    db.user.findUnique({
      where: { id: actorId },
      select: { kind: true, deactivatedAt: true, firstName: true },
    }),
  ]);
  if (!activation?.botUserId) return payload;
  if (!person || person.kind !== "PERSON" || person.deactivatedAt)
    return payload;

  const token = `bpt_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + ACTING_TTL_MS);
  await db.apiKey.create({
    data: {
      userId: actorId,
      activationId,
      name: `${activation.pluginId} for ${person.firstName}`,
      prefix: token.slice(0, 12),
      tokenHash: hashApiToken(token),
      scopes: appApiScopes(activation.capabilities),
      expiresAt,
    },
  });
  return JSON.stringify({
    ...message,
    acting: { token, userId: actorId, expiresAt: expiresAt.toISOString() },
  });
}

/** Deletes acting tokens that ran out more than a day ago. */
export async function pruneActingTokens(now = new Date()): Promise<void> {
  await db.apiKey.deleteMany({
    where: {
      activationId: { not: null },
      expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) },
    },
  });
}
