import { type Api } from "./api";
import type { ActionResult, Badge, BadgeIssue, BlockData, Context, Host, Json } from "./types";
/** Something that undoes what a plugin set up. */
export type Cleanup = () => void;
/** A building block for custom widgets (`contributes.widgetBlocks`). */
export interface WidgetBlock {
    /** As in the manifest's `contributes.widgetBlocks`. */
    id: string;
    /**
     * What it shows, for Barynt to draw (`draw: "barynt"`, the default) —
     * `context.config` holds its settings. Call `showBlock()` later to show
     * something new.
     */
    data?(context: Context): BlockData | Promise<BlockData>;
    /** Draws it yourself (`draw: "plugin"`), like a view. */
    render?(el: HTMLElement, context: Context): void | Cleanup | Promise<void | Cleanup>;
}
export interface ProjectView {
    /** As in the manifest's `contributes.projectViews` (or `navItems`, for
     *  `registerPage`). */
    id: string;
    /** Draws the view into `el`. May return what undoes it. */
    render(el: HTMLElement, context: Context): void | Cleanup | Promise<void | Cleanup>;
}
/**
 * A Barynt plugin. Extend it, export the class as the default of
 * `main.js`, and set things up in `onload()`. Everything registered through
 * the `register*` methods is undone on its own when the plugin unloads —
 * `onunload()` is only for what you set up yourself.
 *
 * ```ts
 * export default class Timeline extends Plugin {
 *   async onload() {
 *     this.registerProjectView({
 *       id: "timeline",
 *       render: async (el) => {
 *         const { issues } = await this.api.issues.list();
 *         el.textContent = `${issues.length} issues`;
 *       },
 *     });
 *   }
 * }
 * ```
 */
export declare abstract class Plugin {
    #private;
    /** Barynt's API: issues, comments, storage, settings … */
    readonly api: Api;
    /** Where the plugin runs right now. */
    readonly context: Context;
    /** The element the plugin's frame shows. */
    readonly root: HTMLElement;
    constructor(host: Host);
    /** Called once when the plugin starts. */
    abstract onload(): void | Promise<void>;
    /** Called when the plugin's frame goes away. */
    onunload(): void;
    /** Runs `cleanup` when the plugin unloads. */
    register(cleanup: Cleanup): void;
    /**
     * A project view from the manifest's `contributes.projectViews`. Barynt
     * opens one frame per view, so it's drawn right away when this frame is
     * for it, and never otherwise.
     */
    registerProjectView(view: ProjectView): void;
    /**
     * A page from the manifest's `contributes.navItems` — opened from its
     * entry in the sidebar's "Plugins" section. Drawn right away when this
     * frame is for it, never otherwise.
     */
    registerPage(page: ProjectView): void;
    /**
     * A panel in an issue's detail, from the manifest's
     * `contributes.issuePanels` — in the side panel, the dialog, the page and
     * the phone sheet. `context.issueId` is the issue; the frame grows to
     * your content's height on its own (up to a limit, then it scrolls).
     */
    registerIssuePanel(panel: ProjectView): void;
    /**
     * An action from the manifest's `contributes.actions` — in an issue's
     * "…" menu, a card's quick actions and the command palette (as the
     * manifest's `where` says). Barynt runs it in a hidden frame when someone
     * picks it, for that issue (`issueId`); what you return shows as a toast.
     * Do the work through `this.api` — it's checked like everything else.
     */
    registerAction(action: {
        id: string;
        run(context: {
            issueId: string | null;
        }): ActionResult | undefined | Promise<ActionResult | undefined>;
    }): void;
    /**
     * Badges on a project's board cards and list rows, for the badges in the
     * manifest's `contributes.issueBadges`. Barynt runs one hidden frame per
     * board and hands `provide` the issues it shows, in batches; return the
     * chips by issue id — Barynt draws them. Nothing is drawn by you here.
     */
    registerBadges(badges: {
        provide(issues: BadgeIssue[]): Record<string, Badge[]> | Promise<Record<string, Badge[]>>;
    }): void;
    /**
     * A dashboard widget from the manifest's `contributes.dashboardWidgets`.
     * Its frame fills the widget below Barynt's header, in whatever size it
     * was added — watch `el`'s size (a `ResizeObserver`) to show more when
     * there's room.
     */
    registerWidget(widget: ProjectView): void;
    /**
     * Its own settings (`contributes.settingsPage`): with `true` a page shown
     * instead of Barynt's form, with `"section"` a part below it — a check, a
     * preview, a picker that asks your service. `context.slot.id` says which
     * (`"settings"` or `"section"`). Read with `loadSettings()`, save with
     * `api.settings.set(values)`.
     */
    registerSettings(page: Omit<ProjectView, "id">): void;
    /**
     * A building block from the manifest's `contributes.widgetBlocks`, for
     * people to put in their custom widgets. Barynt opens one frame per block
     * in a widget, so it's run right away when this frame is for it, and
     * never otherwise. With `data`, Barynt draws what it returns; with
     * `render`, you draw it (`draw: "plugin"` in the manifest).
     */
    registerBlock(block: WidgetBlock): void;
    /** Shows new data in this frame's building block — after a refresh,
     *  say (`registerInterval`). */
    showBlock(data: BlockData): void;
    /**
     * Resolves once every view registered so far has rendered — and rejects
     * with the first error one threw. `loadPlugin` in tests waits for it;
     * in Barynt an error there shows as the plugin's error.
     */
    whenRendered(): Promise<void>;
    /** `setInterval`, cleared when the plugin unloads. */
    registerInterval(callback: () => void, ms: number): number;
    /** `addEventListener`, removed when the plugin unloads. */
    registerDomEvent<K extends keyof HTMLElementEventMap>(target: HTMLElement | Window | Document, type: K, listener: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions): void;
    /** The plugin's settings in this place, with the manifest's defaults. */
    loadSettings<T extends Record<string, Json> = Record<string, Json>>(): Promise<T>;
}
