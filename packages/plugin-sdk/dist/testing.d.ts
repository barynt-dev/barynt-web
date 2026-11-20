import type { Plugin } from "./plugin";
import type { ActionResult, Badge, BadgeIssue, BlockData, Context, Host, Method, Methods } from "./types";
type Handlers = {
    [M in Method]?: (params: Methods[M][0]) => Methods[M][1] | Promise<Methods[M][1]>;
};
export interface TestHost extends Host {
    /** Every request the plugin made, in order. */
    readonly calls: {
        method: string;
        params: unknown;
    }[];
    /** Every building block's data the plugin showed, in order. */
    readonly shown: BlockData[];
    /** Runs one of the plugin's actions, as a menu would. */
    runAction(id: string, context?: {
        issueId: string | null;
    }): Promise<ActionResult>;
    /** Asks the plugin's badges for these issues, as a board would. */
    badges(issues: BadgeIssue[]): Record<string, Badge[]> | Promise<Record<string, Badge[]>>;
}
/**
 * A host for tests. A method without a handler is refused with
 * `capability_not_confirmed`, as Barynt refuses what wasn't confirmed; a
 * handler that throws `new Error("not_found")` refuses with that code.
 */
export declare function createTestHost(options?: {
    handlers?: Handlers;
    context?: Partial<Context>;
    root?: HTMLElement;
}): TestHost;
/** Starts a plugin on a test host: creates it, runs `onload()`, waits for
 *  its views to render (`whenRendered`) — so a view's error fails the test —
 *  and hands back the plugin, the host and a way to unload it. */
export declare function loadPlugin<P extends Plugin>(PluginClass: new (host: Host) => P, host?: TestHost): Promise<{
    plugin: P;
    host: TestHost;
    unload: () => void;
}>;
export {};
