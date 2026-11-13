import { type Api, createApi } from "./api";
import type { Context, Host, Json } from "./types";

/** Something that undoes what a plugin set up. */
export type Cleanup = () => void;

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

  constructor(host: Host) {
    this.api = createApi(host);
    this.context = host.context;
    this.root = host.root;
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
