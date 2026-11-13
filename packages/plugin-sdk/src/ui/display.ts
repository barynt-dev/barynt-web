import {
  append,
  type Child,
  el,
  nextId,
  safeColor,
  safeHref,
  styled,
  type Tone,
} from "./core";
import { ICONS, type IconName } from "./icons";

// The UI kit's text, layout and feedback (BARY-204, BARY-206) — the pieces
// Barynt's own pages are made of. Each returns an element.

const SVG = "http://www.w3.org/2000/svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

/** One of the built-in icons (`IconName`), in the text's colour. With a
 *  `label` it's announced; without, it's decoration. */
export function icon(
  name: IconName,
  options: { size?: number; label?: string } = {},
): SVGSVGElement {
  styled();
  const size = String(options.size ?? 16);
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "bui-icon");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  if (options.label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", options.label);
  } else svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of ICONS[name] ?? []) {
    const shape = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    svg.append(shape);
  }
  return svg;
}

// ─── Text ────────────────────────────────────────────────────────────────────

export function heading(options: {
  text: string;
  /** 1 to 4 — the page's outline, and the size. Default 2. */
  level?: 1 | 2 | 3 | 4;
}): HTMLHeadingElement {
  styled();
  const level = options.level ?? 2;
  const node = el(`h${level}` as "h2", "bui-heading", options.text);
  node.dataset.level = String(level);
  return node;
}

/** A paragraph (or, `inline`, a span) of text in Barynt's type. */
export function text(options: {
  text: string;
  tone?: "default" | "subtle" | "primary" | "success" | "warning" | "danger";
  size?: "xs" | "sm" | "base" | "lg";
  weight?: "regular" | "medium" | "semibold" | "bold";
  mono?: boolean;
  inline?: boolean;
}): HTMLElement {
  styled();
  const node = el(options.inline ? "span" : "p", "bui-text", options.text);
  if (options.tone && options.tone !== "default")
    node.dataset.tone = options.tone;
  if (options.size && options.size !== "sm") node.dataset.size = options.size;
  if (options.weight && options.weight !== "regular")
    node.dataset.weight = options.weight;
  if (options.mono) node.dataset.mono = "";
  return node;
}

/** A link out of Barynt, in a new tab. Only `http(s)` and `mailto` — any
 *  other address leaves plain text. */
export function link(options: { text: string; href: string }): HTMLElement {
  styled();
  const href = safeHref(options.href);
  if (!href) return el("span", "bui-text", options.text);
  const a = el("a", "bui-link", options.text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/** Elements under each other, with room between. */
export function stack(...children: Child[]): HTMLElement {
  styled();
  return el("div", "bui-stack", ...children);
}

/** Elements next to each other, wrapping. */
export function row(...children: Child[]): HTMLElement {
  styled();
  return el("div", "bui-row", ...children);
}

/** Columns as many as fit, each at least `minWidth` (default `12rem`). */
export function grid(options: {
  children: Child[];
  minWidth?: string;
}): HTMLElement {
  styled();
  const node = el("div", "bui-grid", ...options.children);
  if (options.minWidth && /^\d+(\.\d+)?(rem|px|em|%)$/.test(options.minWidth))
    node.style.setProperty("--bui-min", options.minWidth);
  return node;
}

export function divider(): HTMLHRElement {
  styled();
  return el("hr", "bui-divider");
}

/** A section with a frame: title, description, content, actions on top.
 *  `tone` colours its edge ("Changes requested"); `compact` takes less room
 *  — a sidebar's width. */
export function card(options: {
  title?: string;
  description?: string;
  children?: Child[];
  actions?: Child[];
  tone?: Tone;
  compact?: boolean;
}): HTMLElement {
  styled();
  const node = el("section", "bui-card");
  if (options.tone && options.tone !== "neutral")
    node.dataset.tone = options.tone;
  if (options.compact) node.dataset.compact = "";
  if (options.title || options.actions) {
    const head = el("div", "bui-card-head");
    const titles = el("div");
    if (options.title) {
      const id = nextId();
      const title = el("h3", "bui-card-title", options.title);
      title.id = id;
      node.setAttribute("aria-labelledby", id);
      titles.append(title);
    }
    if (options.description)
      titles.append(el("p", "bui-card-desc", options.description));
    head.append(titles);
    if (options.actions) head.append(el("div", "bui-row", ...options.actions));
    node.append(head);
  }
  append(node, options.children ?? []);
  return node;
}

// ─── Small things ────────────────────────────────────────────────────────────

/** A short state in colour: "New", "Failed", "3 open". */
export function badge(options: { text: string; tone?: Tone }): HTMLElement {
  styled();
  const node = el("span", "bui-badge", options.text);
  if (options.tone && options.tone !== "neutral")
    node.dataset.tone = options.tone;
  return node;
}

/** A tag in a colour — a palette name or a `#hex` — that can be removed. */
export function tag(options: {
  text: string;
  color?: string;
  onRemove?: () => void;
}): HTMLElement {
  styled();
  const node = el("span", "bui-tag", options.text);
  const colour = safeColor(options.color);
  if (colour) node.style.setProperty("--tag", colour);
  if (options.onRemove) {
    const remove = el("button", "bui-tag-remove", icon("x", { size: 12 }));
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${options.text}`);
    const onRemove = options.onRemove;
    remove.addEventListener("click", () => onRemove());
    node.append(remove);
  }
  return node;
}

/** A label as Barynt shows one: its colour as a dot, its name. */
export function labelChip(options: {
  name: string;
  color?: string;
}): HTMLElement {
  const node = tag({ text: options.name, color: options.color });
  node.dataset.label = "";
  return node;
}

/** Initials in a circle. */
export function avatar(options: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}): HTMLElement {
  styled();
  const initials =
    options.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const node = el("span", "bui-avatar", initials);
  node.setAttribute("aria-hidden", "true");
  const colour = safeColor(options.color);
  if (colour) node.style.setProperty("--av", colour);
  if (options.size && options.size !== "md") node.dataset.size = options.size;
  return node;
}

/** A person: avatar, name, and a line about them. */
export function user(options: {
  name: string;
  color?: string;
  meta?: string;
}): HTMLElement {
  styled();
  const textBox = el(
    "span",
    "bui-user-text",
    el("span", "bui-user-name", options.name),
  );
  if (options.meta) textBox.append(el("span", "bui-user-meta", options.meta));
  return el(
    "span",
    "bui-user",
    avatar({ name: options.name, color: options.color }),
    textBox,
  );
}

/** A status as Barynt draws one, by its category. */
export function statusDot(options: {
  label: string;
  category: "backlog" | "unstarted" | "started" | "completed" | "canceled";
}): HTMLElement {
  styled();
  const node = el("span", "bui-dot", options.label);
  node.dataset.category = options.category;
  return node;
}

/** Shows `text` on hover and focus, and tells screen readers. */
export function tooltip<T extends HTMLElement>(target: T, text: string): T {
  styled();
  target.dataset.buiTip = text;
  const note = el("span", "bui-sr", text);
  note.id = nextId();
  target.append(note);
  target.setAttribute("aria-describedby", note.id);
  return target;
}

// ─── Waiting, empty, telling ─────────────────────────────────────────────────

export function spinner(options: { label?: string } = {}): HTMLElement {
  styled();
  const node = el("span", "bui-spinner", icon("loader-circle", { size: 16 }));
  node.setAttribute("role", "status");
  if (options.label) node.append(options.label);
  else node.setAttribute("aria-label", "Loading");
  return node;
}

/** Grey bars where text will be, while it loads. */
export function skeleton(options: { lines?: number } = {}): HTMLElement {
  styled();
  const node = el("div", "bui-skeleton");
  node.setAttribute("aria-hidden", "true");
  for (let i = 0; i < Math.max(1, Math.min(options.lines ?? 3, 12)); i++)
    node.append(el("span"));
  return node;
}

/** Where there's nothing yet: what it is, why, what to do. */
export function emptyState(options: {
  title: string;
  text?: string;
  icon?: IconName;
  action?: Child;
}): HTMLElement {
  styled();
  return el(
    "div",
    "bui-empty-state",
    icon(options.icon ?? "inbox", { size: 28 }),
    el("strong", undefined, options.title),
    options.text && el("span", undefined, options.text),
    options.action,
  );
}

const TONE_ICON: Record<Tone, IconName> = {
  neutral: "info",
  primary: "info",
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  danger: "circle-x",
};

/** A message in the page: information, a warning, an error. An error is
 *  announced right away (`role="alert"`). */
export function notice(options: {
  text: string;
  title?: string;
  tone?: Tone;
  action?: Child;
}): HTMLElement {
  styled();
  const tone = options.tone ?? "info";
  const node = el(
    "div",
    "bui-notice",
    icon(TONE_ICON[tone], { size: 16 }),
    el(
      "div",
      "bui-notice-body",
      options.title && el("strong", undefined, options.title),
      el("span", undefined, options.text),
      options.action,
    ),
  );
  node.dataset.tone = tone;
  node.setAttribute("role", tone === "danger" ? "alert" : "status");
  return node;
}

/** A short message in the frame's corner, gone after `duration` ms. */
export function toast(
  message: string,
  options: { tone?: Tone; duration?: number } = {},
): void {
  styled();
  let host = document.querySelector<HTMLElement>(".bui-toasts");
  if (!host) {
    host = el("div", "bui-toasts");
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }
  const tone = options.tone ?? "neutral";
  const node = el(
    "div",
    "bui-toast",
    icon(TONE_ICON[tone], { size: 16 }),
    message,
  );
  node.dataset.tone = tone;
  host.append(node);
  setTimeout(() => node.remove(), Math.max(1000, options.duration ?? 4000));
}

/** A line that says how something went — read out by screen readers. */
export interface Status {
  el: HTMLElement;
  set(text: string, tone?: StatusTone): void;
  clear(): void;
}
export type StatusTone = "info" | "success" | "warning" | "error";

export function status(): Status {
  styled();
  const node = el("p", "bui-status");
  node.setAttribute("role", "status");
  return {
    el: node,
    set(textValue, tone = "info") {
      node.textContent = textValue;
      node.dataset.tone = tone;
    },
    clear() {
      node.textContent = "";
      delete node.dataset.tone;
    },
  };
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

/** How far along, as a bar. */
export function progressBar(options: {
  value: number;
  max?: number;
  label?: string;
  tone?: Tone;
}): HTMLElement {
  styled();
  const max = options.max ?? 100;
  const share = max > 0 ? Math.max(0, Math.min(1, options.value / max)) : 0;
  const percent = `${Math.round(share * 100)}%`;
  const node = el("div", "bui-progress");
  if (options.label)
    node.append(
      el(
        "div",
        "bui-progress-head",
        el("span", undefined, options.label),
        el("span", undefined, percent),
      ),
    );
  const fill = el("div", "bui-progress-fill");
  fill.style.width = percent;
  if (options.tone && options.tone !== "primary" && options.tone !== "neutral")
    fill.style.setProperty(
      "--tone",
      `var(--barynt-color-${options.tone === "danger" ? "danger" : options.tone})`,
    );
  const track = el("div", "bui-progress-track", fill);
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", String(max));
  track.setAttribute("aria-valuenow", String(options.value));
  if (options.label) track.setAttribute("aria-label", options.label);
  node.append(track);
  return node;
}

/** A number that matters, with what it is — and how it moved. */
export function kpi(options: {
  value: string | number;
  label: string;
  /** "+3 this week"; `good` colours it (green up, red down — your call). */
  trend?: { text: string; good?: boolean };
}): HTMLElement {
  styled();
  const node = el(
    "div",
    "bui-kpi",
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
    const line = el("li", "bui-list-item");
    const href = item.href ? safeHref(item.href) : null;
    if (href) {
      const a = el("a", "bui-list-title", item.title);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      line.append(a);
    } else line.append(el("span", "bui-list-title", item.title));
    if (item.meta) line.append(el("span", "bui-list-meta", item.meta));
    node.append(line);
  }
  return node;
}

/** Horizontal bars, one per entry, to the largest — or to `max`. A bar's
 *  `color` is a palette name, a `#hex` or a token. */
export function barChart(options: {
  bars: { label: string; value: number; color?: string }[];
  max?: number;
}): HTMLElement {
  styled();
  const node = el("div", "bui-bars");
  const max = options.max ?? Math.max(1, ...options.bars.map((b) => b.value));
  for (const bar of options.bars) {
    const fill = el("span", "bui-bar-fill");
    fill.style.width = `${Math.max(0, Math.min(100, (bar.value / max) * 100))}%`;
    const colour = safeColor(bar.color);
    if (colour) fill.style.setProperty("--bar", colour);
    const line = el(
      "div",
      "bui-bar",
      el("span", "bui-bar-label", bar.label),
      el("span", "bui-bar-track", fill),
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
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("aria-hidden", "true");
  for (const part of ["track", "fill"] as const) {
    const circle = document.createElementNS(SVG, "circle");
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
  const percent = `${Math.round(share * 100)}%`;
  const textBox = el("span", "bui-kpi", el("span", "bui-ring-value", percent));
  if (options.label)
    textBox.append(el("span", "bui-ring-label", options.label));
  const node = el("div", "bui-ring");
  node.setAttribute("role", "img");
  node.setAttribute(
    "aria-label",
    options.label ? `${options.label}: ${percent}` : percent,
  );
  node.append(svg, textBox);
  return node;
}

// ─── Development, deployments, links (BARY-209) ──────────────────────────────

const STEP_ICON = {
  success: "circle-check",
  danger: "circle-x",
  warning: "triangle-alert",
  running: "loader-circle",
  pending: "circle-dashed",
} as const satisfies Record<string, IconName>;
export type StepState = keyof typeof STEP_ICON;

/** A head over a section or a card: an icon, a title, and on the right a
 *  note or a state in its tone — "Pipeline · Passed". */
export function sectionHeader(options: {
  title: string;
  icon?: IconName;
  meta?: string;
  status?: { text: string; tone?: Tone };
}): HTMLElement {
  styled();
  const node = el(
    "div",
    "bui-section-head",
    options.icon && icon(options.icon, { size: 16 }),
    el("span", "bui-section-title", options.title),
  );
  if (options.status) {
    const s = el("span", "bui-section-status", options.status.text);
    s.dataset.tone = options.status.tone ?? "neutral";
    node.append(s);
  } else if (options.meta)
    node.append(el("span", "bui-section-meta", options.meta));
  return node;
}

/** A value to copy — a branch, a hash, a command — with a copy button and,
 *  with `href`, one to open it. */
export function copyField(options: {
  value: string;
  icon?: IconName;
  href?: string;
  /** What the buttons say to screen readers: "Copy branch". */
  label?: string;
}): HTMLElement {
  styled();
  const node = el(
    "div",
    "bui-copy",
    options.icon && icon(options.icon, { size: 15 }),
    el("span", "bui-copy-value", options.value),
  );
  const copy = el("button", "bui-copy-button", icon("copy", { size: 15 }));
  copy.type = "button";
  copy.setAttribute("aria-label", options.label ?? `Copy ${options.value}`);
  copy.dataset.buiTip = "Copy";
  copy.addEventListener("click", async () => {
    let done = false;
    try {
      await navigator.clipboard.writeText(options.value);
      done = true;
    } catch {
      // Without clipboard access: select it in a field and copy that.
      const area = el("textarea");
      area.value = options.value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      done = document.execCommand("copy");
      area.remove();
    }
    if (!done) return;
    copy.replaceChildren(icon("check", { size: 15 }));
    copy.dataset.buiTip = "Copied";
    setTimeout(() => {
      copy.replaceChildren(icon("copy", { size: 15 }));
      copy.dataset.buiTip = "Copy";
    }, 1500);
  });
  node.append(copy);
  const href = options.href ? safeHref(options.href) : null;
  if (href) {
    const open = el(
      "a",
      "bui-copy-button",
      icon("external-link", { size: 15 }),
    );
    open.href = href;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.setAttribute("aria-label", "Open");
    open.dataset.buiTip = "Open";
    node.append(open);
  }
  return node;
}

/** Steps of a pipeline, a checklist, a rollout — each with its state and,
 *  on the right, how long it took. */
export function stepList(options: {
  steps: { label: string; state: StepState; meta?: string }[];
}): HTMLElement {
  styled();
  const node = el("ul", "bui-steps");
  for (const step of options.steps) {
    const mark = el(
      "span",
      "bui-step-mark",
      icon(STEP_ICON[step.state], { size: 15 }),
    );
    mark.dataset.state = step.state;
    const item = el(
      "li",
      "bui-step",
      mark,
      el("span", "bui-step-label", step.label),
      step.meta && el("span", "bui-step-meta", step.meta),
    );
    item.setAttribute("aria-label", `${step.label}: ${step.state}`);
    node.append(item);
  }
  return node;
}

/** Rows that lead somewhere — "1 Commit ›" — a link out, or your own
 *  `onClick` (open a dialog, show a list). */
export function navList(options: {
  items: {
    label: string;
    icon?: IconName;
    count?: number;
    href?: string;
    onClick?: () => void;
  }[];
}): HTMLElement {
  styled();
  const node = el("ul", "bui-nav");
  for (const item of options.items) {
    const href = item.href ? safeHref(item.href) : null;
    const inner = [
      item.icon && icon(item.icon, { size: 16 }),
      item.count !== undefined &&
        el("span", "bui-nav-count", String(item.count)),
      el("span", "bui-nav-label", item.label),
      icon("chevron-right", { size: 16 }),
    ];
    let control: HTMLElement;
    if (href) {
      const a = el("a", "bui-nav-item", ...inner);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      control = a;
    } else {
      const b = el("button", "bui-nav-item", ...inner);
      b.type = "button";
      if (item.onClick) {
        const onClick = item.onClick;
        b.addEventListener("click", () => onClick());
      } else b.disabled = true;
      control = b;
    }
    node.append(el("li", undefined, control));
  }
  return node;
}

/** Lines added and removed: "+9 −4". */
export function diffStat(options: {
  added: number;
  removed: number;
}): HTMLElement {
  styled();
  const node = el(
    "span",
    "bui-diff",
    el("span", "bui-diff-added", `+${options.added}`),
    el("span", "bui-diff-removed", `−${options.removed}`),
  );
  node.setAttribute(
    "aria-label",
    `${options.added} lines added, ${options.removed} removed`,
  );
  return node;
}
