import "server-only";
import { randomBytes } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { pluginDevBase, pluginInternalHosts } from "@/lib/plugins/dev";
import {
  type PluginManifest as Manifest,
  validateManifest,
} from "@/lib/plugins/manifest";
import {
  eventCapability,
  eventForPlugin,
  isLocalServiceUrl,
  type LifecycleEvent,
  PLUGIN_EVENTS,
  type PluginEvent,
} from "@/lib/plugins/service";
import { openSecret, sealSecret } from "@/lib/secret-box";
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

  const url = new URL(manifest.service.url);
  const dev = pluginDevBase();
  return {
    url: manifest.service.url,
    secret,
    internalHosts: [
      ...webhookInternalHosts(),
      ...pluginInternalHosts(),
      // A plugin built on this machine, while developing.
      ...(dev && isLocalServiceUrl(url) ? [url.host] : []),
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

/**
 * The secret a switched-on plugin's server is signed with — made the first
 * time, kept after. `null` when the plugin has no server.
 */
export async function ensureServiceSecret(
  activationId: string,
  manifest: Manifest,
): Promise<boolean> {
  if (!manifest.service) return false;
  const row = await db.pluginActivation.findUnique({
    where: { id: activationId },
    select: { serviceSecret: true },
  });
  if (row?.serviceSecret) return true;
  await db.pluginActivation.update({
    where: { id: activationId },
    data: {
      serviceSecret: sealSecret(
        randomBytes(32).toString("base64url"),
        SECRET_PURPOSE,
      ),
    },
  });
  return true;
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
    },
  });
  if (!activation?.serviceSecret) return null;
  const secret = openSecret(activation.serviceSecret, SECRET_PURPOSE);
  if (!secret) return null;
  const message = (shown: string) =>
    JSON.stringify({
      event,
      timestamp: Date.now(),
      workspaceId: activation.workspaceId,
      projectId: activation.projectId,
      data: {
        installationId: activationId,
        pluginId: activation.pluginId,
        baryntUrl: appUrl("/"),
        ...(event === "app.installed" && { secret: shown }),
      },
    });
  return {
    workspaceId: activation.workspaceId,
    stored: message(SEALED),
    sent: message(secret),
  };
}
