import { WEBHOOK_EVENT_GROUPS, type WebhookEvent } from "../webhooks/events";

// A plugin's own server (BARY-212): which events it may subscribe to, which
// capability each needs, and what of an event it gets to see. No
// dependencies, used by the manifest check and by delivery alike.

/** Events a plugin may subscribe to — everything but saved views, which
 *  are people's own arrangement, not workspace data. */
export const PLUGIN_EVENTS = WEBHOOK_EVENT_GROUPS.filter(
  (g) => g.key !== "view",
).flatMap((g) => g.events) as Exclude<WebhookEvent, `view.${string}`>[];

export type PluginEvent = (typeof PLUGIN_EVENTS)[number];

/** Lifecycle messages Barynt sends to a service, outside any subscription. */
export const LIFECYCLE_EVENTS = ["app.installed", "app.uninstalled"] as const;
export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];

/** The capability an event needs. Labels go with issues — they are part of
 *  them. */
export function eventCapability(
  event: PluginEvent,
): "events:issue" | "events:comment" | "events:project" | "events:member" {
  if (event.startsWith("comment.")) return "events:comment";
  if (event.startsWith("project.")) return "events:project";
  if (event.startsWith("member.")) return "events:member";
  return "events:issue";
}

/** Whether a service URL is a local one — allowed in a manifest only so a
 *  plugin can be built on one's own machine; delivery reaches it only in
 *  development (`lib/plugins/dev.ts`). */
export function isLocalServiceUrl(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

interface Envelope {
  event: string;
  data: unknown;
  changes?: unknown;
  [key: string]: unknown;
}

/**
 * What a plugin gets of an event: everything its confirmed capabilities
 * let it read, the rest left out. Without `issues:read` an issue is only
 * its id and reference (and no `changes`, which carry field values);
 * without `comments:read` a comment has no body.
 */
export function eventForPlugin<T extends Envelope>(
  envelope: T,
  capabilities: readonly string[],
): T {
  const event = envelope.event;
  const data = envelope.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return envelope;

  if (event.startsWith("issue.") && !capabilities.includes("issues:read")) {
    const { changes: _changes, ...rest } = envelope;
    const project = data.project as { id?: string } | undefined;
    return {
      ...rest,
      data: {
        id: data.id,
        ref: data.ref,
        projectId: data.projectId ?? project?.id ?? null,
      },
    } as T;
  }
  if (event.startsWith("comment.") && !capabilities.includes("comments:read")) {
    const { body: _body, ...rest } = data;
    return { ...envelope, data: rest };
  }
  return envelope;
}

/**
 * How a plugin's server is reached (BARY-223) — the plugin's maker decides:
 * - `fixed`: the maker runs one server for every Barynt; its address is in
 *   the manifest and its host in `network`.
 * - `platform`: whoever runs this Barynt runs it — say, a container beside
 *   it; the platform admin gives the address (or `PLUGIN_SERVICE_URLS`).
 * - `activation`: whoever switches the plugin on runs their own, for that
 *   workspace or project alone, and gives its address there.
 */
export const SERVICE_ADDRESS_MODES = [
  "fixed",
  "platform",
  "activation",
] as const;
export type ServiceAddressMode = (typeof SERVICE_ADDRESS_MODES)[number];

/** Longest address Barynt keeps. */
export const SERVICE_URL_MAX = 300;

/**
 * Whether an address someone gave for a plugin's server can be used, and
 * the address as Barynt keeps it. `https`, or plain `http` to a host the
 * operator let through — `trusted` hosts, while developing this machine, or
 * anything when the operator gives it (`plain`: a container on the same
 * network). No user or password in it.
 */
export function checkServiceAddress(
  raw: string,
  trusted: { hosts: readonly string[]; local: boolean; plain?: boolean },
):
  | { ok: true; url: string }
  | { ok: false; error: "invalid_url" | "not_https" } {
  const value = raw.trim();
  if (!value || value.length > SERVICE_URL_MAX)
    return { ok: false, error: "invalid_url" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return { ok: false, error: "invalid_url" };
  if (url.username || url.password) return { ok: false, error: "invalid_url" };
  const allowedPlain =
    trusted.plain ||
    trusted.hosts.includes(url.host.toLowerCase()) ||
    trusted.hosts.includes(url.hostname.toLowerCase()) ||
    (trusted.local && isLocalServiceUrl(url));
  if (url.protocol === "http:" && !allowedPlain)
    return { ok: false, error: "not_https" };
  url.hash = "";
  return { ok: true, url: url.toString() };
}

/**
 * `PLUGIN_SERVICE_URLS`: addresses the operator fixed for `platform`
 * plugins, `pluginId=url` separated by commas. Entries that aren't one are
 * left out.
 */
export function serviceUrlsFromEnv(
  raw: string | undefined,
): Map<string, string> {
  const urls = new Map<string, string>();
  for (const part of (raw ?? "").split(",")) {
    const at = part.indexOf("=");
    if (at <= 0) continue;
    const id = part.slice(0, at).trim();
    const url = part.slice(at + 1).trim();
    if (/^[a-z][a-z0-9-]{2,39}$/.test(id) && /^https?:\/\//.test(url))
      urls.set(id, url);
  }
  return urls;
}

/** A plugin's server as the store and its dialogs show it. */
export interface ServiceSummary {
  /** The manifest's address — for `platform` and `activation` only a
   *  suggestion, or none. */
  url: string | null;
  address: ServiceAddressMode;
  events: string[];
}

export const serviceSummary = (service: {
  url?: string;
  address?: ServiceAddressMode;
  events: readonly string[];
}): ServiceSummary => ({
  url: service.url ?? null,
  address: service.address ?? "fixed",
  events: [...service.events],
});
