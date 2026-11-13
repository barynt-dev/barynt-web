// The UI kit (BARY-204): Barynt's inputs and widget pieces for a plugin's
// frame, so a plugin doesn't rebuild every text field and number. Plain DOM,
// no framework — each function returns an element (or a field with its
// element in `el`) to put wherever you like, next to your own.
//
// It looks like Barynt because it's drawn with the design tokens Barynt
// sets on the frame (light and dark). Text goes in as text, never as HTML.

const STYLE_ID = "barynt-ui";

const CSS = `
.bui-stack { display: flex; flex-direction: column; gap: 1rem; }
.bui-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.bui-field { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
.bui-label { font-size: var(--text-sm); font-weight: 550; color: var(--on-surface); }
.bui-hint { font-size: var(--text-xs); color: var(--on-surface-variant); }
.bui-input, .bui-textarea, .bui-select {
  box-sizing: border-box; width: 100%; min-height: 2.25rem; padding: 0 0.6875rem;
  color: var(--on-surface); background: var(--surface-container-lowest, var(--surface));
  border: 1px solid var(--outline-variant); border-radius: var(--radius-sm);
  font: inherit; font-size: var(--text-base); outline: none;
  transition: border-color 0.12s;
}
.bui-textarea { min-height: 6rem; padding: 0.5rem 0.6875rem; resize: vertical; }
.bui-input:focus, .bui-textarea:focus, .bui-select:focus { border-color: var(--tertiary, var(--primary)); }
.bui-input::placeholder, .bui-textarea::placeholder { color: var(--on-surface-variant); }
.bui-input:disabled, .bui-textarea:disabled, .bui-select:disabled { opacity: 0.6; }
.bui-switch { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.bui-switch-text { display: flex; flex-direction: column; gap: 0.25rem; }
.bui-toggle {
  position: relative; flex: none; width: 2.5rem; height: 1.5rem; padding: 0;
  background: var(--surface-container-high); border: 1px solid var(--outline);
  border-radius: 999px; cursor: pointer; transition: background 0.15s;
}
.bui-toggle::after {
  content: ""; position: absolute; top: 50%; left: 0.1875rem; width: 1rem; height: 1rem;
  border-radius: 50%; background: var(--on-surface-variant);
  transform: translateY(-50%); transition: transform 0.15s, background 0.15s;
}
.bui-toggle[aria-checked="true"] { background: var(--primary); border-color: var(--primary); }
.bui-toggle[aria-checked="true"]::after { background: var(--on-primary); transform: translate(1rem, -50%); }
.bui-button {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
  min-height: 2.25rem; padding: 0 0.875rem; border-radius: var(--radius-sm);
  border: 1px solid transparent; font: inherit; font-size: var(--text-sm); font-weight: 550;
  cursor: pointer; transition: filter 0.12s, background 0.12s;
}
.bui-button[data-variant="primary"] { color: var(--on-primary); background: var(--primary); }
.bui-button[data-variant="secondary"] { color: var(--on-surface); background: var(--surface-container-high); border-color: var(--outline-variant); }
.bui-button[data-variant="ghost"] { color: var(--on-surface-variant); background: none; }
.bui-button[data-variant="danger"] { color: var(--error); background: none; border-color: var(--outline-variant); }
.bui-button:hover:not(:disabled) { filter: brightness(1.08); }
.bui-button:disabled { opacity: 0.55; cursor: default; }
.bui-button[aria-busy="true"] { cursor: progress; }
.bui-input:focus-visible, .bui-button:focus-visible, .bui-toggle:focus-visible, .bui-select:focus-visible {
  outline: 2px solid var(--tertiary, var(--primary)); outline-offset: 2px;
}
.bui-status { margin: 0; min-height: 1.25rem; font-size: var(--text-sm); color: var(--on-surface-variant); }
.bui-status[data-tone="success"] { color: var(--primary); }
.bui-status[data-tone="error"] { color: var(--error); }
.bui-status[data-tone="warning"] { color: var(--warning); }
.bui-status:empty { display: none; }
.bui-kpi { display: flex; flex-direction: column; gap: 0.25rem; }
.bui-kpi-value { font-size: 2.5rem; font-weight: 650; line-height: 1; letter-spacing: -0.02em; color: var(--on-surface); }
.bui-kpi-label { font-size: var(--text-sm); color: var(--on-surface-variant); }
.bui-kpi-trend { font-size: var(--text-xs); color: var(--on-surface-variant); }
.bui-kpi-trend[data-good="true"] { color: var(--primary); }
.bui-kpi-trend[data-good="false"] { color: var(--error); }
.bui-list { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
.bui-list-item {
  display: flex; align-items: baseline; gap: 0.625rem; min-width: 0; padding: 0.4375rem 0;
  border-bottom: 1px solid var(--outline-variant); font-size: var(--text-sm);
}
.bui-list-item:last-child { border-bottom: none; }
.bui-list-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--on-surface); }
a.bui-list-title { text-decoration: none; }
a.bui-list-title:hover { text-decoration: underline; }
.bui-list-meta { flex: none; font-size: var(--text-xs); color: var(--on-surface-variant); }
.bui-empty { padding: 1rem 0; text-align: center; font-size: var(--text-sm); color: var(--on-surface-variant); }
.bui-bars { display: flex; flex-direction: column; gap: 0.5rem; }
.bui-bar { display: grid; grid-template-columns: minmax(0, 7rem) 1fr auto; align-items: center; gap: 0.625rem; font-size: var(--text-sm); }
.bui-bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--on-surface-variant); }
.bui-bar-track { height: 0.5rem; border-radius: 999px; background: var(--surface-container-high); overflow: hidden; }
.bui-bar-fill { height: 100%; border-radius: inherit; background: var(--bar, var(--primary)); }
.bui-bar-value { font-variant-numeric: tabular-nums; color: var(--on-surface); }
.bui-ring { display: inline-flex; align-items: center; gap: 0.75rem; }
.bui-ring svg { flex: none; }
.bui-ring-track { stroke: var(--surface-container-high); }
.bui-ring-fill { stroke: var(--primary); transition: stroke-dashoffset 0.3s; }
.bui-ring-value { font-size: 1.5rem; font-weight: 650; color: var(--on-surface); }
.bui-ring-label { font-size: var(--text-sm); color: var(--on-surface-variant); }
@media (pointer: coarse) {
  .bui-input, .bui-select, .bui-button { min-height: 2.75rem; }
}
`;

/** Puts the kit's styles into the frame once. */
function styled(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}

let lastId = 0;
const nextId = () => `bui-${++lastId}`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** An input with its element and its value. */
export interface Field<T> {
  /** Put this where the field goes. */
  el: HTMLElement;
  value: T;
  /** Grey it out while something runs. */
  disabled: boolean;
  focus(): void;
}

interface FieldOptions {
  label: string;
  /** Smaller text below the field. */
  hint?: string;
}

/** Label, control and hint, stacked. */
function fieldShell(
  options: FieldOptions,
  control: HTMLElement,
  id: string,
): HTMLElement {
  const wrap = el("div", "bui-field");
  const label = el("label", "bui-label", options.label);
  label.htmlFor = id;
  control.id = id;
  wrap.append(label, control);
  if (options.hint) {
    const hint = el("span", "bui-hint", options.hint);
    hint.id = `${id}-hint`;
    control.setAttribute("aria-describedby", hint.id);
    wrap.append(hint);
  }
  return wrap;
}

/** A field of `<input>` or `<textarea>`, read and written as text. */
function textControl(
  control: HTMLInputElement | HTMLTextAreaElement,
  options: FieldOptions & { value?: string; onInput?: (value: string) => void },
): Field<string> {
  styled();
  control.value = options.value ?? "";
  if (options.onInput) {
    const onInput = options.onInput;
    control.addEventListener("input", () => onInput(control.value));
  }
  return {
    el: fieldShell(options, control, nextId()),
    get value() {
      return control.value;
    },
    set value(v) {
      control.value = v;
    },
    get disabled() {
      return control.disabled;
    },
    set disabled(v) {
      control.disabled = v;
    },
    focus: () => control.focus(),
  };
}

/**
 * A one-line text field. `onEnter` runs on Enter — the sandbox doesn't
 * submit forms, so this is how a field saves.
 */
export function textField(
  options: FieldOptions & {
    value?: string;
    placeholder?: string;
    type?: "text" | "url" | "email" | "number" | "password" | "search";
    onInput?: (value: string) => void;
    onEnter?: () => void;
  },
): Field<string> {
  const input = el("input", "bui-input");
  input.type = options.type ?? "text";
  if (options.placeholder) input.placeholder = options.placeholder;
  if (options.onEnter) {
    const onEnter = options.onEnter;
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        onEnter();
      }
    });
  }
  return textControl(input, options);
}

/** A multi-line text field. */
export function textArea(
  options: FieldOptions & {
    value?: string;
    placeholder?: string;
    rows?: number;
    onInput?: (value: string) => void;
  },
): Field<string> {
  const area = el("textarea", "bui-textarea");
  area.rows = options.rows ?? 4;
  if (options.placeholder) area.placeholder = options.placeholder;
  return textControl(area, options);
}

/** A choice of one. `value` is the chosen option's `value`. */
export function select(
  options: FieldOptions & {
    options: { value: string; label: string }[];
    value?: string;
    onChange?: (value: string) => void;
  },
): Field<string> {
  styled();
  const control = el("select", "bui-select");
  for (const option of options.options) {
    const node = el("option", undefined, option.label);
    node.value = option.value;
    control.append(node);
  }
  if (options.value !== undefined) control.value = options.value;
  if (options.onChange) {
    const onChange = options.onChange;
    control.addEventListener("change", () => onChange(control.value));
  }
  return {
    el: fieldShell(options, control, nextId()),
    get value() {
      return control.value;
    },
    set value(v) {
      control.value = v;
    },
    get disabled() {
      return control.disabled;
    },
    set disabled(v) {
      control.disabled = v;
    },
    focus: () => control.focus(),
  };
}

/** An on/off switch, with its label on the left. */
export function toggle(
  options: FieldOptions & {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
  },
): Field<boolean> {
  styled();
  const id = nextId();
  const wrap = el("div", "bui-switch");
  const text = el("span", "bui-switch-text");
  const label = el("label", "bui-label", options.label);
  label.htmlFor = id;
  text.append(label);
  const button = el("button", "bui-toggle");
  button.type = "button";
  button.id = id;
  button.setAttribute("role", "switch");
  let checked = options.checked ?? false;
  const show = () => button.setAttribute("aria-checked", String(checked));
  show();
  if (options.hint) {
    const hint = el("span", "bui-hint", options.hint);
    hint.id = `${id}-hint`;
    button.setAttribute("aria-describedby", hint.id);
    text.append(hint);
  }
  button.addEventListener("click", () => {
    checked = !checked;
    show();
    options.onChange?.(checked);
  });
  wrap.append(text, button);
  return {
    el: wrap,
    get value() {
      return checked;
    },
    set value(v) {
      checked = v;
      show();
    },
    get disabled() {
      return button.disabled;
    },
    set disabled(v) {
      button.disabled = v;
    },
    focus: () => button.focus(),
  };
}

/**
 * A button. An `onClick` that returns a promise keeps it disabled (and
 * `aria-busy`) until it settles, so nobody saves twice.
 */
export function button(options: {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onClick?: () => void | Promise<unknown>;
}): HTMLButtonElement {
  styled();
  const node = el("button", "bui-button", options.label);
  node.type = "button";
  node.dataset.variant = options.variant ?? "secondary";
  if (options.onClick) {
    const onClick = options.onClick;
    node.addEventListener("click", async () => {
      if (node.disabled) return;
      const running = onClick();
      if (!(running instanceof Promise)) return;
      node.disabled = true;
      node.setAttribute("aria-busy", "true");
      try {
        await running;
      } finally {
        node.disabled = false;
        node.removeAttribute("aria-busy");
      }
    });
  }
  return node;
}

export type StatusTone = "info" | "success" | "warning" | "error";

/** A line that says how something went — read out by screen readers. */
export interface Status {
  el: HTMLElement;
  set(text: string, tone?: StatusTone): void;
  clear(): void;
}

export function status(): Status {
  styled();
  const node = el("p", "bui-status");
  node.setAttribute("role", "status");
  return {
    el: node,
    set(text, tone = "info") {
      node.textContent = text;
      node.dataset.tone = tone;
    },
    clear() {
      node.textContent = "";
      delete node.dataset.tone;
    },
  };
}

/** Elements under each other, with room between. */
export function stack(...children: Node[]): HTMLElement {
  styled();
  const node = el("div", "bui-stack");
  node.append(...children);
  return node;
}

/** Elements next to each other, wrapping. */
export function row(...children: Node[]): HTMLElement {
  styled();
  const node = el("div", "bui-row");
  node.append(...children);
  return node;
}

// ─── For widgets and views ───────────────────────────────────────────────────

/** A number that matters, with what it is — and how it moved. */
export function kpi(options: {
  value: string | number;
  label: string;
  /** "+3 this week"; `good` colours it (green up, red down — your call). */
  trend?: { text: string; good?: boolean };
}): HTMLElement {
  styled();
  const node = el("div", "bui-kpi");
  node.append(
    el("span", "bui-kpi-value", String(options.value)),
    el("span", "bui-kpi-label", options.label),
  );
  if (options.trend) {
    const trend = el("span", "bui-kpi-trend", options.trend.text);
    if (options.trend.good !== undefined)
      trend.dataset.good = String(options.trend.good);
    node.append(trend);
  }
  return node;
}

export interface ListItem {
  title: string;
  /** Small text on the right: a date, a count, a name. */
  meta?: string;
  /** Makes the title a link, opened outside Barynt. */
  href?: string;
}

/** Rows of a title and a note. `empty` shows when there are none. */
export function list(options: {
  items: ListItem[];
  empty?: string;
}): HTMLElement {
  styled();
  if (options.items.length === 0)
    return el("p", "bui-empty", options.empty ?? "Nothing here.");
  const node = el("ul", "bui-list");
  for (const item of options.items) {
    const row = el("li", "bui-list-item");
    if (item.href) {
      const link = el("a", "bui-list-title", item.title);
      link.href = item.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      row.append(link);
    } else row.append(el("span", "bui-list-title", item.title));
    if (item.meta) row.append(el("span", "bui-list-meta", item.meta));
    node.append(row);
  }
  return node;
}

/** Horizontal bars, one per entry, to the largest — or to `max`. */
export function barChart(options: {
  bars: { label: string; value: number; color?: string }[];
  max?: number;
}): HTMLElement {
  styled();
  const node = el("div", "bui-bars");
  const max = options.max ?? Math.max(1, ...options.bars.map((b) => b.value));
  for (const bar of options.bars) {
    const line = el("div", "bui-bar");
    const track = el("span", "bui-bar-track");
    const fill = el("span", "bui-bar-fill");
    fill.style.width = `${Math.max(0, Math.min(100, (bar.value / max) * 100))}%`;
    if (bar.color && /^#[0-9a-f]{3,8}$|^var\(--[\w-]+\)$/i.test(bar.color))
      fill.style.setProperty("--bar", bar.color);
    track.append(fill);
    line.append(
      el("span", "bui-bar-label", bar.label),
      track,
      el("span", "bui-bar-value", String(bar.value)),
    );
    line.setAttribute("aria-label", `${bar.label}: ${bar.value}`);
    node.append(line);
  }
  return node;
}

/** How far along something is, as a ring with the percentage. */
export function progressRing(options: {
  value: number;
  max?: number;
  label?: string;
  size?: number;
}): HTMLElement {
  styled();
  const max = options.max ?? 100;
  const share = max > 0 ? Math.max(0, Math.min(1, options.value / max)) : 0;
  const size = options.size ?? 64;
  const stroke = Math.max(4, size / 9);
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  for (const part of ["track", "fill"] as const) {
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("class", `bui-ring-${part}`);
    circle.setAttribute("cx", String(size / 2));
    circle.setAttribute("cy", String(size / 2));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-width", String(stroke));
    if (part === "fill") {
      circle.setAttribute("stroke-linecap", "round");
      circle.setAttribute("stroke-dasharray", String(length));
      circle.setAttribute("stroke-dashoffset", String(length * (1 - share)));
      circle.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
    }
    svg.append(circle);
  }
  const node = el("div", "bui-ring");
  const percent = `${Math.round(share * 100)}%`;
  const text = el("span", "bui-kpi");
  text.append(el("span", "bui-ring-value", percent));
  if (options.label) text.append(el("span", "bui-ring-label", options.label));
  node.setAttribute("role", "img");
  node.setAttribute(
    "aria-label",
    options.label ? `${options.label}: ${percent}` : percent,
  );
  node.append(svg, text);
  return node;
}
