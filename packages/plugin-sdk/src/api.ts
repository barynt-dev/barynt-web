import type { Host, Json, Method, Methods } from "./types";

/** A request Barynt refused, with its reason (`code`). */
export class BaryntError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "BaryntError";
  }
}

/** Every method of the host bridge — what `createApi` offers. */
export const METHODS = [
  "issues.list",
  "issues.get",
  "issues.create",
  "issues.update",
  "comments.list",
  "comments.create",
  "labels.list",
  "projects.list",
  "members.list",
  "fields.list",
  "storage.get",
  "storage.set",
  "storage.delete",
  "storage.list",
  "settings.get",
  "net.fetch",
] as const satisfies readonly Method[];

/** What `api.net.fetch` gives back: the status, the headers Barynt passes
 *  on, and the body as text (or base64 for anything that isn't text). */
export interface NetResponse {
  status: number;
  /** `status` from 200 to 299. */
  ok: boolean;
  headers: Record<string, string>;
  text: string;
  base64: string | null;
  /** The text body, parsed. */
  json<T = unknown>(): T;
}

/** One method, typed: its params in, its result out, a refusal as a
 *  `BaryntError`. */
async function request<M extends Method>(
  host: Host,
  method: M,
  params: Methods[M][0],
): Promise<Methods[M][1]> {
  try {
    return (await host.call(method, params)) as Methods[M][1];
  } catch (error) {
    throw new BaryntError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** Barynt's API for a plugin, typed, over its host. */
export function createApi(host: Host) {
  const call = <M extends Method>(method: M, params: Methods[M][0]) =>
    request(host, method, params);
  return {
    issues: {
      list: (params: Methods["issues.list"][0] = {}) =>
        call("issues.list", params),
      get: (id: string) => call("issues.get", { id }),
      create: (input: Methods["issues.create"][0]) =>
        call("issues.create", input),
      update: (id: string, patch: Omit<Methods["issues.update"][0], "id">) =>
        call("issues.update", { ...patch, id }),
    },
    comments: {
      list: (issueId: string) => call("comments.list", { issueId }),
      create: (issueId: string, body: string, parentId?: string) =>
        call("comments.create", {
          issueId,
          body,
          ...(parentId ? { parentId } : {}),
        }),
    },
    labels: {
      list: (params: Methods["labels.list"][0] = {}) =>
        call("labels.list", params),
    },
    projects: { list: () => call("projects.list", {}) },
    members: {
      list: (params: Methods["members.list"][0] = {}) =>
        call("members.list", params),
    },
    fields: {
      list: (params: Methods["fields.list"][0] = {}) =>
        call("fields.list", params),
    },
    storage: {
      get: <T extends Json = Json>(key: string) =>
        call("storage.get", { key }) as Promise<T | null>,
      set: (key: string, value: Json) => call("storage.set", { key, value }),
      delete: (key: string) => call("storage.delete", { key }),
      list: () => call("storage.list", {}),
    },
    settings: { get: () => call("settings.get", {}) },
    net: {
      /**
       * A request to one of the hosts in the manifest's `network`, sent by
       * Barynt. It adds the credentials the manifest declares for that host
       * itself; redirects come back as they are.
       */
      async fetch(
        url: string,
        init: Omit<Methods["net.fetch"][0], "url"> = {},
      ): Promise<NetResponse> {
        const res = await call("net.fetch", { ...init, url });
        const text = res.text ?? "";
        return {
          status: res.status,
          ok: res.status >= 200 && res.status < 300,
          headers: res.headers,
          text,
          base64: res.base64 ?? null,
          json: <T>() => JSON.parse(text) as T,
        };
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
