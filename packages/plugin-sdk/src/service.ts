// The server side of a plugin (BARY-214): what runs on its maker's server,
// not in Barynt. Barynt sends it the events it subscribed to
// (`service.events` in the manifest), signed with a secret per installation;
// `createService` checks them, keeps each installation's secret and tokens,
// and hands every event to its handler with a client for Barynt's REST API.
//
//   const service = createService();
//   service.on("issue.status_changed", async (event, { barynt }) => {
//     await barynt.comments.create(event.data.id, "Deploy started");
//   });
//   export default { fetch: service.fetch };
//
// Web Crypto and `fetch` only — runs on Node 18+, Bun, Deno and edge
// runtimes alike.

/** One switched-on copy of the plugin: a workspace, or one project. */
export interface Installation {
  id: string;
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  /** What Barynt signs every message to this installation with. */
  secret: string;
  /** Its app's token for the REST API — acting as "<Plugin> (App)". */
  token?: string;
  botUserId?: string;
  baryntUrl: string;
}

/** Where installations are kept. In memory by default — give it your
 *  database's, or every restart forgets them until Barynt reinstalls. */
export interface InstallationStore {
  get(id: string): Installation | undefined | Promise<Installation | undefined>;
  set(installation: Installation): void | Promise<void>;
  delete(id: string): void | Promise<void>;
}

/** An event as Barynt sends it (see the webhook envelope). */
export interface ServiceEvent<T = Record<string, unknown>> {
  event: string;
  timestamp: number;
  workspaceId: string;
  projectId: string | null;
  actor: { id: string; name: string } | null;
  via: { plugin: { id: string; name: string } } | null;
  data: T;
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** To act for the person who caused it — 15 minutes, never more than
   *  they and the plugin may both do. */
  acting?: { token: string; userId: string; expiresAt: string };
}

/** Barynt's REST API, as one identity. */
export interface BaryntClient {
  request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T>;
  issues: {
    get(idOrRef: string): Promise<Record<string, unknown>>;
    update(idOrRef: string, patch: Record<string, unknown>): Promise<unknown>;
  };
  comments: {
    list(issue: string): Promise<Record<string, unknown>[]>;
    create(issue: string, body: string): Promise<Record<string, unknown>>;
  };
  /** What the plugin keeps on an issue (BARY-216) — shown by its own
   *  badges and panels. */
  issueData: {
    list(
      issue: string,
    ): Promise<{ key: string; value: unknown; updatedAt: string }[]>;
    set(issue: string, key: string, value: unknown): Promise<unknown>;
    delete(issue: string, key: string): Promise<unknown>;
  };
}

export interface HandlerContext {
  /** For the person who caused the event, when Barynt sent a token for
   *  that — otherwise the same as `app`. */
  barynt: BaryntClient;
  /** As the plugin's own app, "<Plugin> (App)". */
  app: BaryntClient;
  installation: Installation;
}

export type Handler = (
  event: ServiceEvent,
  context: HandlerContext,
) => void | Promise<void>;

export interface ServiceOptions {
  store?: InstallationStore;
  /** How old a message may be, in ms. 5 minutes by default. */
  tolerance?: number;
  /** Barynt's address when it differs from what Barynt says it is (a
   *  proxy, a dev server on another port). */
  baryntUrl?: string;
  /** For tests: what `fetch` calls go to. */
  fetch?: typeof fetch;
}

export class BaryntApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Barynt answered ${status}`);
  }
}

const encoder = new TextEncoder();

/** Hex HMAC-SHA256 over `<timestamp>.<body>`, as Barynt signs. */
export async function sign(
  secret: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Compares without telling, by its time, how much was right. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function memoryStore(): InstallationStore {
  const map = new Map<string, Installation>();
  return {
    get: (id) => map.get(id),
    set: (i) => void map.set(i.id, i),
    delete: (id) => void map.delete(id),
  };
}

/** A REST client as one token. */
export function baryntClient(
  baryntUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): BaryntClient {
  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    const res = await fetchImpl(new URL(`/api/v1${path}`, baryntUrl), {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined && { "content-type": "application/json" }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new BaryntApiError(res.status, json);
    return (json as { data?: T } | null)?.data as T;
  };
  const id = encodeURIComponent;
  return {
    request,
    issues: {
      get: (issue) => request("GET", `/issues/${id(issue)}`),
      update: (issue, patch) => request("PATCH", `/issues/${id(issue)}`, patch),
    },
    comments: {
      list: (issue) => request("GET", `/issues/${id(issue)}/comments`),
      create: (issue, body) =>
        request("POST", `/issues/${id(issue)}/comments`, { body }),
    },
    issueData: {
      list: (issue) => request("GET", `/issues/${id(issue)}/plugin-data`),
      set: (issue, key, value) =>
        request("PUT", `/issues/${id(issue)}/plugin-data/${id(key)}`, {
          value,
        }),
      delete: (issue, key) =>
        request("DELETE", `/issues/${id(issue)}/plugin-data/${id(key)}`),
    },
  };
}

export function createService(options: ServiceOptions = {}) {
  const store = options.store ?? memoryStore();
  const tolerance = options.tolerance ?? 5 * 60_000;
  const fetchImpl = options.fetch ?? fetch;
  const handlers = new Map<string, Handler[]>();
  /** Delivery ids seen lately — a retry of a handled one is skipped. */
  const seen = new Set<string>();

  const remember = (delivery: string) => {
    seen.add(delivery);
    if (seen.size > 1000) seen.delete(seen.values().next().value as string);
  };

  const clientsFor = (installation: Installation, event: ServiceEvent) => {
    const url = options.baryntUrl ?? installation.baryntUrl;
    const app = baryntClient(url, installation.token ?? "", fetchImpl);
    const barynt = event.acting
      ? baryntClient(url, event.acting.token, fetchImpl)
      : app;
    return { app, barynt };
  };

  /** Runs what's registered for this event. */
  const dispatch = async (installation: Installation, event: ServiceEvent) => {
    const list = [
      ...(handlers.get(event.event) ?? []),
      ...(handlers.get("*") ?? []),
    ];
    for (const handler of list)
      await handler(event, {
        ...clientsFor(installation, event),
        installation,
      });
  };

  /** Barynt's request, checked and handled — the server's whole endpoint. */
  const handle = async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return new Response(null, { status: 405 });
    const body = await req.text();
    const timestamp = req.headers.get("x-barynt-timestamp") ?? "";
    const signature = req.headers.get("x-barynt-signature") ?? "";
    const delivery = req.headers.get("x-barynt-delivery") ?? "";
    const installationId = req.headers.get("x-barynt-installation") ?? "";
    if (Math.abs(Date.now() - Number(timestamp)) > tolerance)
      return new Response("stale", { status: 401 });

    let message: ServiceEvent;
    try {
      message = JSON.parse(body);
    } catch {
      return new Response("not JSON", { status: 400 });
    }

    // `app.installed` brings the secret it's signed with.
    let installation = await store.get(installationId);
    if (message.event === "app.installed") {
      const d = message.data as unknown as Omit<
        Installation,
        "workspaceId" | "projectId" | "id"
      > & {
        installationId: string;
      };
      installation = {
        id: d.installationId,
        pluginId: d.pluginId,
        workspaceId: message.workspaceId,
        projectId: message.projectId,
        secret: d.secret,
        token: d.token,
        botUserId: d.botUserId,
        baryntUrl: d.baryntUrl,
      };
    }
    if (!installation)
      return new Response("unknown installation", { status: 401 });
    if (!same(await sign(installation.secret, timestamp, body), signature))
      return new Response("bad signature", { status: 401 });
    if (delivery && seen.has(delivery))
      return new Response(null, { status: 204 });

    if (message.event === "app.installed") await store.set(installation);
    try {
      await dispatch(installation, message);
    } catch (error) {
      // Barynt tries again later.
      console.error("[barynt service]", message.event, error);
      return new Response("handler failed", { status: 500 });
    }
    if (message.event === "app.uninstalled")
      await store.delete(installation.id);
    if (delivery) remember(delivery);
    return new Response(null, { status: 204 });
  };

  return {
    /** Runs `handler` for `event` — an event name, or `"*"` for all. */
    on(event: string, handler: Handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
      return this;
    },
    /** The endpoint: `export default { fetch: service.fetch }`, or call it
     *  from your framework's route with its `Request`. */
    fetch: handle,
    /** For tests: runs the handlers for an event, without a signature. */
    async simulate(
      event: Omit<ServiceEvent, "timestamp"> & { timestamp?: number },
      installation: Installation,
    ) {
      await dispatch(installation, { timestamp: Date.now(), ...event });
    },
    store,
  };
}
