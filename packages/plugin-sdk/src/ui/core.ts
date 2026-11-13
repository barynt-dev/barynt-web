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
}

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
}

/** Label, control and hint, stacked — the label tied to the control. */
export function fieldShell(
  options: FieldOptions,
  control: HTMLElement,
  id = nextId(),
): HTMLElement {
  const wrap = el("div", "bui-field");
  const label = el("label", "bui-label", options.label);
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
