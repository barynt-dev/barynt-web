import type { Host, Json, Methods } from "./types";
/** A request Barynt refused, with its reason (`code`). */
export declare class BaryntError extends Error {
    readonly code: string;
    constructor(code: string);
}
/** Every method of the host bridge — what `createApi` offers. */
export declare const METHODS: readonly ["issues.list", "issues.get", "issues.create", "issues.update", "comments.list", "comments.create", "labels.list", "projects.list", "members.list", "fields.list", "issueData.list", "storage.get", "storage.set", "storage.delete", "storage.list", "settings.get", "settings.set", "net.fetch"];
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
/** Barynt's API for a plugin, typed, over its host. */
export declare function createApi(host: Host): {
    issues: {
        list: (params?: Methods["issues.list"][0]) => Promise<{
            issues: import("./types").Issue[];
            nextCursor: string | null;
        }>;
        get: (id: string) => Promise<import("./types").Issue>;
        create: (input: Methods["issues.create"][0]) => Promise<import("./types").Issue>;
        update: (id: string, patch: Omit<Methods["issues.update"][0], "id">) => Promise<{
            id: string;
        }>;
    };
    comments: {
        list: (issueId: string) => Promise<import("./types").Comment[]>;
        create: (issueId: string, body: string, parentId?: string) => Promise<import("./types").Comment>;
    };
    labels: {
        list: (params?: Methods["labels.list"][0]) => Promise<import("./types").Label[]>;
    };
    projects: {
        list: () => Promise<import("./types").Project[]>;
    };
    members: {
        list: (params?: Methods["members.list"][0]) => Promise<import("./types").Member[]>;
    };
    fields: {
        list: (params?: Methods["fields.list"][0]) => Promise<import("./types").CustomField[]>;
    };
    issueData: {
        /** What its server keeps on these issues, by issue id — one call
         *  for a whole board. */
        list: (issueIds: string[]) => Promise<Record<string, import("./types").IssueDataEntry[]>>;
    };
    storage: {
        get: <T extends Json = Json>(key: string) => Promise<T | null>;
        set: (key: string, value: Json) => Promise<null>;
        delete: (key: string) => Promise<null>;
        list: () => Promise<string[]>;
    };
    settings: {
        get: () => Promise<Record<string, Json>>;
        /** Saves its settings — from its own settings page, for someone who
         *  may change them; checked against the manifest's `settings`. */
        set: (values: Record<string, Json>) => Promise<null>;
    };
    net: {
        /**
         * A request to one of the hosts in the manifest's `network`, sent by
         * Barynt. It adds the credentials the manifest declares for that host
         * itself; redirects come back as they are.
         */
        fetch(url: string, init?: Omit<Methods["net.fetch"][0], "url">): Promise<NetResponse>;
    };
};
export type Api = ReturnType<typeof createApi>;
