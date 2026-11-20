// src/service.ts
class BaryntApiError extends Error {
  status;
  body;
  constructor(status, body) {
    super(`Barynt answered ${status}`);
    this.status = status;
    this.body = body;
  }
}
var encoder = new TextEncoder;
async function sign(secret, timestamp, body) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function same(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0;i < a.length; i++)
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function memoryStore() {
  const map = new Map;
  return {
    get: (id) => map.get(id),
    set: (i) => void map.set(i.id, i),
    delete: (id) => void map.delete(id)
  };
}
function baryntClient(baryntUrl, token, fetchImpl = fetch) {
  const request = async (method, path, body) => {
    const res = await fetchImpl(new URL(`/api/v1${path}`, baryntUrl), {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...body !== undefined && { "content-type": "application/json" }
      },
      ...body !== undefined && { body: JSON.stringify(body) }
    });
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok)
      throw new BaryntApiError(res.status, json);
    return json?.data;
  };
  const id = encodeURIComponent;
  return {
    request,
    issues: {
      get: (issue) => request("GET", `/issues/${id(issue)}`),
      update: (issue, patch) => request("PATCH", `/issues/${id(issue)}`, patch)
    },
    comments: {
      list: (issue) => request("GET", `/issues/${id(issue)}/comments`),
      create: (issue, body) => request("POST", `/issues/${id(issue)}/comments`, { body })
    },
    issueData: {
      list: (issue) => request("GET", `/issues/${id(issue)}/plugin-data`),
      set: (issue, key, value) => request("PUT", `/issues/${id(issue)}/plugin-data/${id(key)}`, {
        value
      }),
      delete: (issue, key) => request("DELETE", `/issues/${id(issue)}/plugin-data/${id(key)}`)
    }
  };
}
function createService(options = {}) {
  const store = options.store ?? memoryStore();
  const tolerance = options.tolerance ?? 5 * 60000;
  const fetchImpl = options.fetch ?? fetch;
  const handlers = new Map;
  const seen = new Set;
  const remember = (delivery) => {
    seen.add(delivery);
    if (seen.size > 1000)
      seen.delete(seen.values().next().value);
  };
  const clientsFor = (installation, event) => {
    const url = options.baryntUrl ?? installation.baryntUrl;
    const app = baryntClient(url, installation.token ?? "", fetchImpl);
    const barynt = event.acting ? baryntClient(url, event.acting.token, fetchImpl) : app;
    return { app, barynt };
  };
  const dispatch = async (installation, event) => {
    const list = [
      ...handlers.get(event.event) ?? [],
      ...handlers.get("*") ?? []
    ];
    for (const handler of list)
      await handler(event, {
        ...clientsFor(installation, event),
        installation
      });
  };
  const handle = async (req) => {
    if (req.method !== "POST")
      return new Response(null, { status: 405 });
    const body = await req.text();
    const timestamp = req.headers.get("x-barynt-timestamp") ?? "";
    const signature = req.headers.get("x-barynt-signature") ?? "";
    const delivery = req.headers.get("x-barynt-delivery") ?? "";
    const installationId = req.headers.get("x-barynt-installation") ?? "";
    if (Math.abs(Date.now() - Number(timestamp)) > tolerance)
      return new Response("stale", { status: 401 });
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return new Response("not JSON", { status: 400 });
    }
    let installation = await store.get(installationId);
    if (message.event === "app.installed") {
      const d = message.data;
      installation = {
        id: d.installationId,
        pluginId: d.pluginId,
        workspaceId: message.workspaceId,
        projectId: message.projectId,
        secret: d.secret,
        token: d.token,
        botUserId: d.botUserId,
        baryntUrl: d.baryntUrl
      };
    }
    if (!installation)
      return new Response("unknown installation", { status: 401 });
    if (!same(await sign(installation.secret, timestamp, body), signature))
      return new Response("bad signature", { status: 401 });
    if (delivery && seen.has(delivery))
      return new Response(null, { status: 204 });
    if (message.event === "app.installed")
      await store.set(installation);
    try {
      await dispatch(installation, message);
    } catch (error) {
      console.error("[barynt service]", message.event, error);
      return new Response("handler failed", { status: 500 });
    }
    if (message.event === "app.uninstalled")
      await store.delete(installation.id);
    if (delivery)
      remember(delivery);
    return new Response(null, { status: 204 });
  };
  return {
    on(event, handler) {
      handlers.set(event, [...handlers.get(event) ?? [], handler]);
      return this;
    },
    fetch: handle,
    async simulate(event, installation) {
      await dispatch(installation, { timestamp: Date.now(), ...event });
    },
    store
  };
}
export {
  BaryntApiError,
  baryntClient,
  createService,
  sign
};
