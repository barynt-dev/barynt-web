import { translator } from "../i18n";
import { CSS } from "./css";

// What every piece of the UI kit shares (BARY-204, BARY-206): its styles
// put into the frame once, elements built with text as text, and the checks
// that keep a link a link and a colour a colour.

const STYLE_ID = "barynt-ui";

/** Puts the kit's styles into the frame once. */
export function styled(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
  // A tip near the frame's edge would be cut off there: before it shows,
  // it sides with the edge — to the right, the left, or below at the top.
  const place = (e: Event) => {
    const target = (e.target as Element | null)?.closest?.("[data-bui-tip]");
    if (!(target instanceof HTMLElement)) return;
    const r = target.getBoundingClientRect();
    const room = 96;
    target.dataset.buiTipAlign =
      r.right > window.innerWidth - room
        ? "end"
        : r.left < room
          ? "start"
          : "center";
    target.dataset.buiTipSide = r.top < 40 ? "below" : "above";
  };
  document.addEventListener("pointerover", place, true);
  document.addEventListener("focusin", place, true);
}

/** A menu entry Barynt draws. */
export interface HostMenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
}

/** What Barynt does for the kit when the frame runs in it (BARY-238): its
 *  own toasts, and menus drawn over the frame — a frame is too small for
 *  one. Unset in a test or outside Barynt: the kit draws its own. */
export interface UiHost {
  toast?: (text: string) => void;
  menu?: (
    items: HostMenuItem[],
    anchor: { x: number; y: number; width: number; height: number },
  ) => Promise<string | null>;
}

/** The key it's kept under: the SDK and its UI kit are bundled apart, and
 *  both must see the same one. */
export const UI_HOST_KEY = Symbol.for("barynt.uiHost");

const g = globalThis as { [UI_HOST_KEY]?: UiHost };
g[UI_HOST_KEY] ??= {};
export const uiHost: UiHost = g[UI_HOST_KEY];

/** What a component takes as content: elements, or text — never HTML. */
export type Child = Node | string | number | false | null | undefined;

/** Appends children, strings as text. */
export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === false || child === null || child === undefined) continue;
    parent.appendChild(
      typeof child === "object"
        ? child
        : document.createTextNode(String(child)),
    );
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  append(node, children);
  return node;
}

let lastId = 0;
/** An id for a label's `for`, an `aria-describedby` … */
export const nextId = () => `bui-${++lastId}`;

/** A link Barynt lets out: `http(s)` or `mailto` — never `javascript:`. */
export function safeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** The palette's names — what `color` options take besides a `#hex`. */
export const PALETTE = [
  "blue",
  "teal",
  "green",
  "lime",
  "amber",
  "orange",
  "red",
  "purple",
  "indigo",
] as const;
export type PaletteColor = (typeof PALETTE)[number];

/** A colour as CSS: a palette name as its token, a `#hex` as it is — or
 *  `null` for anything else, so nothing but a colour gets into a style. */
export function safeColor(color: string | undefined): string | null {
  if (!color) return null;
  if ((PALETTE as readonly string[]).includes(color))
    return `var(--barynt-color-${color})`;
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^var\(--[a-z0-9-]+\)$/i.test(color)) return color;
  return null;
}

/** How a component says what it's about. */
export type Tone =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

/** An input with its element and its value. */
export interface Field<T> {
  /** Put this where the field goes. */
  el: HTMLElement;
  value: T;
  /** Grey it out while something runs. */
  disabled: boolean;
  focus(): void;
}

export interface FieldOptions {
  label: string;
  /** Smaller text below the field. */
  hint?: string;
  /** The label for screen readers only — a field in a table's cell, whose
   *  column says what it is. */
  hideLabel?: boolean;
}

/** Label, control and hint, stacked — the label tied to the control. */
export function fieldShell(
  options: FieldOptions,
  control: HTMLElement,
  id = nextId(),
): HTMLElement {
  const wrap = el("div", "bui-field");
  const label = el("label", "bui-label", options.label);
  if (options.hideLabel) label.dataset.hidden = "";
  label.htmlFor = id;
  control.id = id;
  wrap.append(label, control);
  describe(wrap, control, id, options.hint);
  return wrap;
}

/** A hint under a group, tied to `control` for screen readers. */
export function describe(
  wrap: HTMLElement,
  control: HTMLElement,
  id: string,
  hint: string | undefined,
): void {
  if (!hint) return;
  const node = el("span", "bui-hint", hint);
  node.id = `${id}-hint`;
  control.setAttribute("aria-describedby", node.id);
  wrap.append(node);
}

/** The kit's own words, in the frame's language (`translator`). */
export const kitText = translator({
  en: {
    nothingHere: "Nothing here.",
    nothingMatches: "Nothing matches.",
    loading: "Loading",
    copy: "Copy",
    copied: "Copied",
    open: "Open",
    close: "Close",
    cancel: "Cancel",
    search: "Search",
    removeItem: "Remove {name}",
    copiedValue: "Copied: {value}",
    more: "More",
    searchLog: "Search the log",
    logTimes: "Show times",
    previous: "Previous",
    next: "Next",
    unfoldAll: "Unfold all",
    foldAll: "Fold all",
    logCut: "Only the first {count} lines are shown.",
  },
  de: {
    nothingHere: "Hier ist nichts.",
    nothingMatches: "Nichts gefunden.",
    loading: "Lädt",
    copy: "Kopieren",
    copied: "Kopiert",
    open: "Öffnen",
    close: "Schließen",
    cancel: "Abbrechen",
    search: "Suchen",
    removeItem: "{name} entfernen",
    copiedValue: "Kopiert: {value}",
    more: "Mehr",
    searchLog: "Im Log suchen",
    logTimes: "Zeiten zeigen",
    previous: "Vorheriger",
    next: "Nächster",
    unfoldAll: "Alle aufklappen",
    foldAll: "Alle zuklappen",
    logCut: "Es werden nur die ersten {count} Zeilen gezeigt.",
  },
});
