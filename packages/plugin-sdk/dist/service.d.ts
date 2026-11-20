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
    actor: {
        id: string;
        name: string;
    } | null;
    via: {
        plugin: {
            id: string;
            name: string;
        };
    } | null;
    data: T;
    changes?: Record<string, {
        from: unknown;
        to: unknown;
    }>;
    /** To act for the person who caused it — 15 minutes, never more than
     *  they and the plugin may both do. */
    acting?: {
        token: string;
        userId: string;
        expiresAt: string;
    };
}
/** Barynt's REST API, as one identity. */
export interface BaryntClient {
    request<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
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
        list(issue: string): Promise<{
            key: string;
            value: unknown;
            updatedAt: string;
        }[]>;
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
export type Handler = (event: ServiceEvent, context: HandlerContext) => void | Promise<void>;
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
export declare class BaryntApiError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(status: number, body: unknown);
}
/** Hex HMAC-SHA256 over `<timestamp>.<body>`, as Barynt signs. */
export declare function sign(secret: string, timestamp: string, body: string): Promise<string>;
/** A REST client as one token. */
export declare function baryntClient(baryntUrl: string, token: string, fetchImpl?: typeof fetch): BaryntClient;
export declare function createService(options?: ServiceOptions): {
    /** Runs `handler` for `event` — an event name, or `"*"` for all. */
    on(event: string, handler: Handler): /*elided*/ any;
    /** The endpoint: `export default { fetch: service.fetch }`, or call it
     *  from your framework's route with its `Request`. */
    fetch: (req: Request) => Promise<Response>;
    /** For tests: runs the handlers for an event, without a signature. */
    simulate(event: Omit<ServiceEvent, "timestamp"> & {
        timestamp?: number;
    }, installation: Installation): Promise<void>;
    store: InstallationStore;
};
