import { type Api, createApi } from "./api";
import type {
  ActionResult,
  Badge,
  BadgeIssue,
  BlockData,
  Context,
  Host,
  Json,
} from "./types";

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
  render?(
    el: HTMLElement,
    context: Context,
  ): void | Cleanup | Promise<void | Cleanup>;
}

/** Its own settings page (`registerSettings`). */
export interface SettingsPage {
  /** Draws the page into `el`. May return what undoes it. */
  render(
    el: HTMLElement,
    context: Context,
  ): void | Cleanup | Promise<void | Cleanup>;
  /**
   * Saves what was changed on it — with this, Barynt's Save button at the
   * top of the page covers it: greyed out until you call
   * `setUnsaved(true)`, then this runs on a click. Throw to say it failed;
   * the message is shown. Without it, save the way you like.
   */
  save?(): void | Promise<void>;
}

export interface ProjectView {
  /** As in the manifest's `contributes.projectViews` (or `navItems`, for
   *  `registerPage`). */
  id: string;
  /** Draws the view into `el`. May return what undoes it. */
  render(
    el: HTMLElement,
    context: Context,
  ): void | Cleanup | Promise<void | Cleanup>;
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
export abstract class Plugin {
  /** Barynt's API: issues, comments, storage, settings … */
  readonly api: Api;
  /** Where the plugin runs right now. */
  readonly context: Context;
  /** The element the plugin's frame shows. */
  readonly root: HTMLElement;
  readonly #cleanups: Cleanup[] = [];
  readonly #renders: Promise<unknown>[] = [];

  readonly #show: Host["show"];
  readonly #serveBadges: Host["serveBadges"];
  readonly #serveActions: Host["serveActions"];
  readonly #serveSave: Host["serveSave"];
  readonly #unsaved: Host["unsaved"];
  readonly #startAction: Host["startAction"];
  readonly #actions = new Map<
    string,
    (context: {
      issueId: string | null;
      choice?: string;
    }) => ActionResult | undefined | Promise<ActionResult | undefined>
  >();

  constructor(host: Host) {
    this.#show = host.show;
    this.#serveBadges = host.serveBadges;
    this.#serveActions = host.serveActions;
    this.#serveSave = host.serveSave;
    this.#unsaved = host.unsaved;
    this.#startAction = host.startAction;
    this.api = createApi(host);
    this.context = host.context;
    this.root = host.root;
    // The person's language for the frame: `translator()` and the UI
    // kit's own texts read it from here.
    const html =
      typeof document !== "undefined" ? document.documentElement : null;
    if (html && host.context.locale) html.lang = host.context.locale;
    // The host calls `onunload()`; a subclass's own one runs first, then
    // everything registered is undone — even when the subclass forgets.
    const own = this.onunload;
    Object.defineProperty(this, "onunload", {
      value: () => {
        try {
          own.call(this);
        } finally {
          this.#unload();
        }
      },
    });
  }

  /** Called once when the plugin starts. */
  abstract onload(): void | Promise<void>;

  /** Called when the plugin's frame goes away. */
  onunload(): void {}

  /** Runs `cleanup` when the plugin unloads. */
  register(cleanup: Cleanup): void {
    this.#cleanups.push(cleanup);
  }

  /**
   * A project view from the manifest's `contributes.projectViews`. Barynt
   * opens one frame per view, so it's drawn right away when this frame is
   * for it, and never otherwise.
   */
  registerProjectView(view: ProjectView): void {
    this.#renderSlot("projectView", view);
  }

  /**
   * A page from the manifest's `contributes.navItems` — opened from its
   * entry in the sidebar's "Plugins" section. Drawn right away when this
   * frame is for it, never otherwise.
   */
  registerPage(page: ProjectView): void {
    this.#renderSlot("page", page);
  }

  /**
   * A panel in an issue's detail, from the manifest's
   * `contributes.issuePanels` — in the side panel, the dialog, the page and
   * the phone sheet. `context.issueId` is the issue; the frame grows to
   * your content's height on its own (up to a limit, then it scrolls).
   */
  registerIssuePanel(panel: ProjectView): void {
    this.#renderSlot("issuePanel", panel);
  }

  /**
   * From an issue panel: starts one of your actions for its issue, as if
   * it were picked from the issue's menu — with `choice` already made, if
   * you pass one. Its answer shows like that too (a toast, a form). An
   * action with `"where": []` in the manifest is only started like this.
   */
  runAction(id: string, context: { choice?: string } = {}): void {
    if (this.context.slot.kind !== "issuePanel") return;
    this.#startAction?.(id, context);
  }

  /**
   * An action from the manifest's `contributes.actions` — in an issue's
   * "…" menu, a card's quick actions and the command palette (as the
   * manifest's `where` says). Barynt runs it in a hidden frame when someone
   * picks it, for that issue (`issueId`); what you return shows as a toast.
   * Return `pick` to ask first — which repository, say: Barynt shows the
   * options and runs it again with the one picked as `choice`. Return
   * `form` to have something filled in first — a branch's name, say:
   * Barynt shows it as a window and runs it again with `values`.
   * Do the work through `this.api` — it's checked like everything else.
   */
  registerAction(action: {
    id: string;
    run(context: {
      issueId: string | null;
      choice?: string;
    }): ActionResult | undefined | Promise<ActionResult | undefined>;
  }): void {
    if (this.context.slot.kind !== "actions") return;
    if (this.#actions.size === 0)
      this.#serveActions?.((id, context) => {
        const run = this.#actions.get(id);
        if (!run) throw new Error(`No action "${id}"`);
        return run(context);
      });
    this.#actions.set(action.id, (context) => action.run(context));
  }

  /**
   * Badges on a project's board cards and list rows, for the badges in the
   * manifest's `contributes.issueBadges`. Barynt runs one hidden frame per
   * board and hands `provide` the issues it shows, in batches; return the
   * chips by issue id — Barynt draws them. Nothing is drawn by you here.
   */
  registerBadges(badges: {
    provide(
      issues: BadgeIssue[],
    ): Record<string, Badge[]> | Promise<Record<string, Badge[]>>;
  }): void {
    if (this.context.slot.kind !== "badges") return;
    this.#serveBadges?.((issues) => badges.provide(issues));
  }

  /**
   * A dashboard widget from the manifest's `contributes.dashboardWidgets`.
   * Its frame fills the widget below Barynt's header, in whatever size it
   * was added — watch `el`'s size (a `ResizeObserver`) to show more when
   * there's room.
   */
  registerWidget(widget: ProjectView): void {
    this.#renderSlot("widget", widget);
  }

  /**
   * Its own settings (`contributes.settingsPage`): with `true` a page shown
   * instead of Barynt's form, with `"section"` a part below it — a check, a
   * preview, a picker that asks your service. `context.slot.id` says which
   * (`"settings"` or `"section"`). Read with `loadSettings()`, save with
   * `api.settings.set(values)` — in `save`, to save with Barynt's Save
   * button at the top of the page (`setUnsaved`).
   */
  registerSettings(page: SettingsPage): void {
    const { id } = this.context.slot;
    if (id !== "settings" && id !== "section") return;
    if (page.save) {
      const save = page.save.bind(page);
      this.#serveSave?.(async () => {
        await save();
        this.setUnsaved(false);
      });
    }
    this.#renderSlot("settings", { id, render: page.render.bind(page) });
  }

  /**
   * Tells Barynt whether its settings page has changes to save: `true`
   * makes the Save button at the top clickable, `false` greys it out
   * again. Only with a `save` in `registerSettings`; after it ran, it's
   * `false` on its own.
   */
  setUnsaved(unsaved: boolean): void {
    this.#unsaved?.(unsaved);
  }

  /**
   * A building block from the manifest's `contributes.widgetBlocks`, for
   * people to put in their custom widgets. Barynt opens one frame per block
   * in a widget, so it's run right away when this frame is for it, and
   * never otherwise. With `data`, Barynt draws what it returns; with
   * `render`, you draw it (`draw: "plugin"` in the manifest).
   */
  registerBlock(block: WidgetBlock): void {
    const { slot } = this.context;
    if (slot.kind !== "block" || slot.id !== block.id) return;
    if (block.render) {
      this.#renderSlot("block", { id: block.id, render: block.render });
      return;
    }
    const data = block.data;
    if (!data) return;
    this.#renders.push(
      Promise.resolve(data(this.context)).then((d) => this.showBlock(d)),
    );
  }

  /** Shows new data in this frame's building block — after a refresh,
   *  say (`registerInterval`). */
  showBlock(data: BlockData): void {
    this.#show?.(data);
  }

  #renderSlot(kind: Context["slot"]["kind"], view: ProjectView) {
    const { slot } = this.context;
    if (slot.kind !== kind || slot.id !== view.id) return;
    const done = Promise.resolve(view.render(this.root, this.context)).then(
      (cleanup) => {
        if (typeof cleanup === "function") this.register(cleanup);
      },
    );
    this.#renders.push(done);
  }

  /**
   * Resolves once every view registered so far has rendered — and rejects
   * with the first error one threw. `loadPlugin` in tests waits for it;
   * in Barynt an error there shows as the plugin's error.
   */
  async whenRendered(): Promise<void> {
    await Promise.all(this.#renders);
  }

  /** `setInterval`, cleared when the plugin unloads. */
  registerInterval(callback: () => void, ms: number): number {
    const id = setInterval(callback, ms) as unknown as number;
    this.register(() => clearInterval(id));
    return id;
  }

  /** `addEventListener`, removed when the plugin unloads. */
  registerDomEvent<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window | Document,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener as EventListener, options);
    this.register(() =>
      target.removeEventListener(type, listener as EventListener, options),
    );
  }

  /** The plugin's settings in this place, with the manifest's defaults. */
  loadSettings<T extends Record<string, Json> = Record<string, Json>>() {
    return this.api.settings.get() as Promise<T>;
  }

  #unload() {
    // Last registered, first undone — like a stack of setups.
    for (const cleanup of this.#cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {
        // One failing cleanup mustn't keep the others from running.
      }
    }
  }
}
