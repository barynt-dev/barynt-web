import {
  append,
  type Child,
  el,
  kitText,
  nextId,
  safeColor,
  safeHref,
  styled,
  type Tone,
  uiHost,
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
  /** A foot that folds: what's only needed now and then — details, a
   *  log. `aside` sits before its label (a size, a count). */
  more?: {
    label: string;
    /** What unfolds — or, with `onOpen`, nothing: the foot opens it. */
    content?: Child | Child[];
    aside?: Child[];
    open?: boolean;
    onToggle?: (open: boolean) => void;
    /** The foot as a button: opens the details elsewhere — a window. */
    onOpen?: () => void;
  };
  /** The whole card opens something — its details. Its own buttons and
   *  links still do theirs. */
  onClick?: () => void;
}): HTMLElement {
  styled();
  const node = el("section", "bui-card");
  if (options.onClick) {
    const onClick = options.onClick;
    node.dataset.clickable = "";
    node.tabIndex = 0;
    node.addEventListener("click", (event) => {
      // A button or link inside does its own thing.
      if (
        (event.target as Element).closest(
          "a, button, input, select, textarea, summary",
        )
      )
        return;
      onClick();
    });
    node.addEventListener("keydown", (event) => {
      if (event.target !== node) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    });
  }
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
  if (options.more?.onOpen) {
    const more = options.more;
    const onOpen = more.onOpen as () => void;
    const foot = el(
      "button",
      "bui-card-more",
      ...(more.aside ?? []),
      el("span", "bui-card-more-label", more.label),
      icon("chevron-right", { size: 14 }),
    );
    foot.type = "button";
    foot.addEventListener("click", () => onOpen());
    node.append(foot);
  } else if (options.more) {
    const more = options.more;
    const foot = el(
      "details",
      "bui-card-more",
      el(
        "summary",
        undefined,
        ...(more.aside ?? []),
        el("span", "bui-card-more-label", more.label),
        icon("chevron-down", { size: 14 }),
      ),
      el(
        "div",
        "bui-card-more-body",
        ...(Array.isArray(more.content)
          ? more.content
          : more.content === undefined
            ? []
            : [more.content]),
      ),
    );
    foot.open = more.open ?? false;
    foot.addEventListener("toggle", () => more.onToggle?.(foot.open));
    node.append(foot);
  }
  return node;
}

// ─── Small things ────────────────────────────────────────────────────────────

/** A short state in colour: "New", "Failed", "3 open". */
export function badge(options: {
  text: string;
  tone?: Tone;
  /** A built-in icon before the text — `lock` for private, say. */
  icon?: IconName;
}): HTMLElement {
  styled();
  const node = el(
    "span",
    "bui-badge",
    options.icon && icon(options.icon, { size: 12 }),
    options.text,
  );
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
    remove.setAttribute(
      "aria-label",
      kitText("removeItem", { name: options.text }),
    );
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

/**
 * What someone said — a review, a remark: who (with a small tag, "Bot"
 * say), their verdict as a badge on the right and, under it, their words
 * on one line. A click shows all of it; another folds it again. The name
 * is cut off when long — whole on hover.
 */
export function userNote(options: {
  name: string;
  color?: string;
  tag?: string;
  status?: { text: string; tone?: Tone };
  text?: string;
}): HTMLElement {
  styled();
  const name = el("span", "bui-note-name", options.name);
  name.title = options.name;
  const head = el(
    "div",
    "bui-note-head",
    el(
      "span",
      "bui-note-who",
      avatar({ name: options.name, color: options.color, size: "sm" }),
      name,
      options.tag && el("span", "bui-note-tag", options.tag),
    ),
    options.status &&
      badge({ text: options.status.text, tone: options.status.tone }),
  );
  const node = el("div", "bui-note", head);
  const words = options.text?.trim();
  if (words) {
    const line = el(
      "button",
      "bui-note-text",
      icon("message-square", { size: 13 }),
      el("span", undefined, words),
    );
    line.type = "button";
    line.setAttribute("aria-expanded", "false");
    line.addEventListener("click", () => {
      const open = line.getAttribute("aria-expanded") !== "true";
      line.setAttribute("aria-expanded", String(open));
    });
    node.append(line);
  }
  return node;
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
  else node.setAttribute("aria-label", kitText("loading"));
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
  /** One line, the action at its end — inside a card, say. */
  compact?: boolean;
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
  if (options.compact) node.dataset.compact = "";
  node.setAttribute("role", tone === "danger" ? "alert" : "status");
  return node;
}

/** A short message in the frame's corner, gone after `duration` ms. */
export function toast(
  message: string,
  options: { tone?: Tone; duration?: number } = {},
): void {
  // In Barynt: its own toast, where people look for one.
  if (uiHost.toast) {
    uiHost.toast(message);
    return;
  }
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
  /** A built-in icon before the title. */
  icon?: IconName;
  /** Elements before the title, after the icon — an id, a key, a hash. */
  lead?: Child[];
  /** Elements on the right, before `meta` — badges, say. */
  aside?: Child[];
  /** Shows a ✕ at the end that runs this — taking the row off a list. */
  onRemove?: () => void;
  /** What the ✕ says to screen readers — `Remove <title>` by default. */
  removeLabel?: string;
  /** A quieter second line under the title — where, how long, when. */
  note?: string;
  /** Makes the whole row a button — open its details. */
  onClick?: () => void;
  /** Its state: the icon in its colour. */
  tone?: "success" | "danger" | "warning" | "info";
}

/** Rows of a title and a note. `empty` shows when there are none. */
export function list(options: {
  items: ListItem[];
  empty?: string;
  /** `cards`: each row a card of its own, outlined, a little apart. */
  variant?: "rows" | "cards";
}): HTMLElement {
  styled();
  if (options.items.length === 0)
    return el("p", "bui-empty", options.empty ?? kitText("nothingHere"));
  const node = el("ul", "bui-list");
  if (options.variant === "cards") node.dataset.variant = "cards";
  for (const item of options.items) {
    const line = el("li", "bui-list-item");
    if (item.icon)
      line.append(el("span", "bui-list-icon", icon(item.icon, { size: 15 })));
    if (item.lead?.length)
      line.append(el("span", "bui-list-lead", ...item.lead));
    if (item.tone) line.dataset.tone = item.tone;
    const href = item.href ? safeHref(item.href) : null;
    let title: HTMLElement;
    if (href) {
      const a = el("a", "bui-list-title", item.title);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      title = a;
    } else if (item.onClick) {
      const b = el("button", "bui-list-title", item.title);
      b.type = "button";
      const onClick = item.onClick;
      b.addEventListener("click", () => onClick());
      title = b;
    } else title = el("span", "bui-list-title", item.title);
    line.append(
      item.note
        ? el(
            "span",
            "bui-list-body",
            title,
            el("span", "bui-list-note", item.note),
          )
        : title,
    );
    if (item.aside?.length)
      line.append(el("span", "bui-list-aside", ...item.aside));
    if (item.meta) line.append(el("span", "bui-list-meta", item.meta));
    if (item.onRemove) {
      const remove = el("button", "bui-list-remove", icon("x", { size: 14 }));
      remove.type = "button";
      remove.setAttribute(
        "aria-label",
        item.removeLabel ?? kitText("removeItem", { name: item.title }),
      );
      const onRemove = item.onRemove;
      remove.addEventListener("click", () => onRemove());
      line.append(remove);
    }
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
 *  note or a state in its tone — "Pipeline · Passed". With `fold`, the
 *  head and its content in one: a click on the head folds the content away
 *  (a `<details>`, open unless `open: false`); `onToggle` hears each change,
 *  to keep it with `storage` for next time. */
export function sectionHeader(options: {
  title: string;
  icon?: IconName;
  meta?: string;
  status?: { text: string; tone?: Tone };
  /** `sm`: a quiet head, like the field names in an issue's sidebar —
   *  for a panel there (`placement: "sidebar"`). `md` by default. */
  size?: "sm" | "md";
  /** How many it holds, as a badge right after the title — none for 0. */
  count?: number;
  /** On the right of the head — a "+" button, say (`button`, `iconOnly`). */
  actions?: Child[];
  fold?: {
    content: Child | Child[];
    open?: boolean;
    onToggle?: (open: boolean) => void;
  };
}): HTMLElement {
  styled();
  const fold = options.fold;
  const small = options.size === "sm";
  const title = el("span", "bui-section-title", options.title);
  const count =
    options.count && options.count > 0
      ? el("span", "bui-section-count", String(options.count))
      : null;
  // With a count, the title fits its text and the badge sits right by it.
  if (count) title.dataset.fit = "";
  const node = el(
    fold ? "summary" : "div",
    "bui-section-head",
    options.icon && icon(options.icon, { size: small ? 14 : 16 }),
    title,
    count,
  );
  if (small) node.dataset.size = "sm";
  if (options.status) {
    const s = el("span", "bui-section-status", options.status.text);
    s.dataset.tone = options.status.tone ?? "neutral";
    node.append(s);
  } else if (options.meta)
    node.append(el("span", "bui-section-meta", options.meta));
  if (options.actions?.length) {
    const actions = el("span", "bui-section-actions", ...options.actions);
    // In a folding head, its buttons do their own thing — not fold it.
    if (fold) actions.addEventListener("click", (e) => e.preventDefault());
    node.append(actions);
  }
  if (!fold) return node;

  const chevron = icon("chevron-down", { size: 15 });
  chevron.classList.add("bui-fold-chevron");
  node.append(chevron);
  const body = el(
    "div",
    "bui-fold-body",
    ...(Array.isArray(fold.content) ? fold.content : [fold.content]),
  );
  const details = el("details", "bui-fold", node, body);
  details.open = fold.open ?? true;
  details.addEventListener("toggle", () => fold.onToggle?.(details.open));
  return details;
}

/**
 * "Show 2 more" — a small centred toggle in the tertiary colour that folds
 * content away below it, closed to start with (a `<details>`): the
 * branches beyond the first, the done ones. `onToggle` hears each change.
 */
export function showMore(options: {
  label: string;
  content: Child | Child[];
  open?: boolean;
  onToggle?: (open: boolean) => void;
}): HTMLElement {
  styled();
  const summary = el(
    "summary",
    "bui-more-toggle",
    el("span", "", options.label),
    icon("chevron-down", { size: 12 }),
  );
  const body = el(
    "div",
    "bui-more-body",
    ...(Array.isArray(options.content) ? options.content : [options.content]),
  );
  const node = el("details", "bui-more", summary, body);
  node.open = options.open ?? false;
  node.addEventListener("toggle", () => options.onToggle?.(node.open));
  return node;
}

/** Puts text on the clipboard — from a click in the frame, so the browser
 *  lets it. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Without clipboard access: select it in a field and copy that.
    const area = el("textarea");
    area.value = value;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const done = document.execCommand("copy");
    area.remove();
    return done;
  }
}

/** An entry of a "…" menu. */
export interface MenuItem {
  label: string;
  icon?: IconName;
  /** It costs something — deleting, say. */
  danger?: boolean;
  onClick: () => void;
}

/**
 * A "…" button with a menu of a few things to do — rename, delete. In
 * Barynt the menu is Barynt's own, drawn over the frame, so it isn't cut
 * off by a small one; elsewhere the kit draws it below the button.
 */
export function menuButton(options: {
  items: MenuItem[];
  /** Its accessible name and tip — "More" by default. */
  label?: string;
  icon?: IconName;
}): HTMLButtonElement {
  styled();
  const label = options.label ?? kitText("more");
  const node = el(
    "button",
    "bui-copy-button",
    icon(options.icon ?? "ellipsis", { size: 15 }),
  );
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.setAttribute("aria-haspopup", "menu");
  node.dataset.buiTip = label;
  let open: HTMLElement | null = null;
  const close = () => {
    open?.remove();
    open = null;
    node.setAttribute("aria-expanded", "false");
  };
  // Barynt's menu open: a press on the button closes it (the frame tells
  // Barynt) — the click after it mustn't open it again.
  let shown = false;
  let skip = false;
  node.addEventListener("pointerdown", () => {
    skip = shown;
  });
  node.addEventListener("click", async () => {
    if (skip) {
      skip = false;
      return;
    }
    if (uiHost.menu) {
      const r = node.getBoundingClientRect();
      shown = true;
      const picked = await uiHost.menu(
        options.items.map((item, i) => ({
          id: String(i),
          label: item.label,
          ...(item.icon && { icon: `lucide:${item.icon}` }),
          ...(item.danger && { danger: true }),
        })),
        { x: r.left, y: r.top, width: r.width, height: r.height },
      );
      shown = false;
      if (picked !== null) options.items[Number(picked)]?.onClick();
      return;
    }
    if (open) return close();
    open = el("div", "bui-menu");
    open.setAttribute("role", "menu");
    for (const item of options.items) {
      const entry = el(
        "button",
        "bui-menu-item",
        item.icon && icon(item.icon, { size: 15 }),
        item.label,
      );
      entry.type = "button";
      entry.setAttribute("role", "menuitem");
      if (item.danger) entry.dataset.danger = "";
      entry.addEventListener("click", () => {
        close();
        item.onClick();
      });
      open.append(entry);
    }
    node.after(open);
    node.setAttribute("aria-expanded", "true");
    setTimeout(() => document.addEventListener("click", close, { once: true }));
  });
  return node;
}

/** A value to copy — a branch, a hash, a command: a click on it copies it
 *  (Barynt says so), with `href` a button to open it, and `menu` a "…"
 *  with more — rename, delete. */
export function copyField(options: {
  value: string;
  icon?: IconName;
  href?: string;
  /** What copying says to screen readers: "Copy branch". */
  label?: string;
  /** In a "…" menu after the buttons. */
  menu?: MenuItem[];
  /** More buttons after those — an icon each, its label the tip; `danger`
   *  turns it red on hover. */
  actions?: {
    icon: IconName;
    label: string;
    danger?: boolean;
    onClick: () => void;
  }[];
}): HTMLElement {
  styled();
  const value = el(
    "button",
    "bui-copy-value",
    options.icon && icon(options.icon, { size: 15 }),
    el("span", "bui-copy-text", options.value),
  );
  value.type = "button";
  value.setAttribute("aria-label", options.label ?? `Copy ${options.value}`);
  value.dataset.buiTip = kitText("copy");
  value.addEventListener("click", async () => {
    if (await copyText(options.value))
      toast(kitText("copiedValue", { value: options.value }).slice(0, 120), {
        tone: "success",
      });
  });
  const node = el("div", "bui-copy", value);
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
    open.setAttribute("aria-label", kitText("open"));
    open.dataset.buiTip = kitText("open");
    node.append(open);
  }
  for (const action of options.actions ?? []) {
    const b = el("button", "bui-copy-button", icon(action.icon, { size: 15 }));
    b.type = "button";
    b.setAttribute("aria-label", action.label);
    b.dataset.buiTip = action.label;
    if (action.danger) b.dataset.danger = "";
    b.addEventListener("click", () => action.onClick());
    node.append(b);
  }
  if (options.menu?.length) node.append(menuButton({ items: options.menu }));
  return node;
}

/**
 * The way through a few stations — ready, checks, review, merge — as a bar
 * of segments, each in its state's colour with its name under it: where
 * something stands and what holds it up, at a glance.
 */
export function stageBar(options: {
  stages: { label: string; state: StepState }[];
}): HTMLElement {
  styled();
  const node = el("ol", "bui-stages");
  for (const stage of options.stages) {
    const item = el(
      "li",
      "bui-stage",
      el("span", "bui-stage-bar"),
      el("span", "bui-stage-label", stage.label),
    );
    item.dataset.state = stage.state;
    item.setAttribute("aria-label", `${stage.label}: ${stage.state}`);
    node.append(item);
  }
  return node;
}

/** A stop of a `pipeline`: where something got to, and how it went. */
export interface PipelineStation {
  label: string;
  icon?: IconName;
  /** Its tone: `pending` is a stop not reached yet — drawn dashed. */
  state: StepState;
  /** How it went, in words, in its tone — "Ready", "Failed". */
  status?: string;
  /** Small text under it — when, which version. */
  meta?: string;
  /** Makes the whole stop a button — open its details. */
  onClick?: () => void;
  /** A link out in its corner — the running app, say. */
  link?: { href: string; label: string };
  /** Marks it as the one shown elsewhere. */
  selected?: boolean;
  /** Its bar in parts, each in its state — regions, services that make up
   *  the stop. Without, one bar in `state`. */
  segments?: StepState[];
  /** A count beside its label — "3" previews. */
  count?: number;
}

/** Stops from left to right — environments a change went through, a
 *  rollout's regions — each with its state, a note and, optionally, a
 *  click and a link. Scrolls sideways when there are more than fit. */
export function pipeline(options: {
  stations: PipelineStation[];
  /** What the stops are, for screen readers. */
  label?: string;
}): HTMLElement {
  styled();
  const node = el("ol", "bui-pipeline");
  if (options.label) node.setAttribute("aria-label", options.label);
  for (const station of options.stations) {
    const item = el("li", "bui-station");
    item.dataset.state = station.state;
    if (station.selected) item.dataset.selected = "";
    const bar = el("span", "bui-station-bar");
    if (station.segments?.length) {
      bar.dataset.segments = "";
      for (const part of station.segments.slice(0, 12)) {
        const seg = el("i");
        seg.dataset.state = part;
        bar.append(seg);
      }
    }
    const body = [
      bar,
      el(
        "span",
        "bui-station-label",
        station.icon && icon(station.icon, { size: 13 }),
        el("span", undefined, station.label),
        station.count !== undefined &&
          el("span", "bui-station-count", String(station.count)),
      ),
      station.status &&
        el(
          "span",
          "bui-station-status",
          icon(STEP_ICON[station.state], { size: 12 }),
          station.status,
        ),
      station.meta && el("span", "bui-station-meta", station.meta),
    ];
    if (station.onClick) {
      const b = el("button", "bui-station-main", ...body);
      b.type = "button";
      const onClick = station.onClick;
      b.addEventListener("click", () => onClick());
      item.append(b);
    } else item.append(el("div", "bui-station-main", ...body));
    const href = station.link ? safeHref(station.link.href) : null;
    if (station.link && href) {
      const a = el(
        "a",
        "bui-station-link",
        icon("external-link", { size: 13 }),
      );
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", station.link.label);
      a.dataset.buiTip = station.link.label;
      item.append(a);
    }
    node.append(item);
  }
  return node;
}

/** A colour in a log — a terminal's eight, in Barynt's palette. */
export type LogColor =
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "gray"
  | "white";

/** A run of a log line's text in one style. */
export interface LogPart {
  text: string;
  color?: LogColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/** A line of a `logView`. */
export interface LogLine {
  text: string;
  /** The text in styled runs — `parseAnsi` makes them from a terminal's
   *  colours. Without: `text` as it is. */
  parts?: LogPart[];
  /** `danger` an error, `warning`, `success`, `muted` noise. */
  tone?: "danger" | "warning" | "success" | "muted";
  /** Starts a part ("Run npm test") — with `fold`, the lines after it
   *  fold under it. */
  heading?: boolean;
  /** When it was written — shown with "Times". */
  time?: string;
}

const ANSI_COLORS: LogColor[] = [
  "gray",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

/** A terminal's text as styled runs: its colours (`\x1b[31m`, bright and
 *  256 ones near enough), bold, dim, italic, underline. Other escapes go. */
export function parseAnsi(text: string): LogPart[] {
  const parts: LogPart[] = [];
  let style: Omit<LogPart, "text"> = {};
  let last = 0;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escapes start with ESC
  const re = /\u001b\[([\d;]*)([A-Za-z])/g;
  const push = (to: number) => {
    if (to > last) parts.push({ text: text.slice(last, to), ...style });
  };
  for (let m = re.exec(text); m; m = re.exec(text)) {
    push(m.index);
    last = re.lastIndex;
    if (m[2] !== "m") continue;
    const codes = (m[1] || "0").split(";").map(Number);
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) style = {};
      else if (c === 1) style = { ...style, bold: true };
      else if (c === 2) style = { ...style, dim: true };
      else if (c === 3) style = { ...style, italic: true };
      else if (c === 4) style = { ...style, underline: true };
      else if (c === 22) style = { ...style, bold: undefined, dim: undefined };
      else if (c === 23) style = { ...style, italic: undefined };
      else if (c === 24) style = { ...style, underline: undefined };
      else if (c === 39) style = { ...style, color: undefined };
      else if (c >= 30 && c <= 37)
        style = { ...style, color: ANSI_COLORS[c - 30] };
      else if (c >= 90 && c <= 97)
        style = { ...style, color: ANSI_COLORS[c - 90] };
      else if (c === 38 && codes[i + 1] === 5) {
        const n = codes[i + 2] ?? 0;
        if (n < 16) style = { ...style, color: ANSI_COLORS[n % 8] };
        i += 2;
      } else if (c === 38 && codes[i + 1] === 2) i += 4;
      else if (c === 48 && codes[i + 1] === 5) i += 2;
      else if (c === 48 && codes[i + 1] === 2) i += 4;
    }
  }
  push(text.length);
  return parts.map(
    (p) =>
      Object.fromEntries(
        Object.entries(p).filter(([, v]) => v !== undefined),
      ) as unknown as LogPart,
  );
}

/** Most lines a `logView` draws, per box. */
export const LOG_LINES_MAX = 50_000;

/** A line's text, styled. */
function logText(line: LogLine): HTMLElement {
  const node = el("span", "bui-log-text");
  if (!line.parts?.length) {
    node.textContent = line.text.slice(0, 4000);
    return node;
  }
  for (const part of line.parts) {
    const run = el("span", undefined, part.text.slice(0, 4000));
    if (part.color) run.dataset.color = part.color;
    if (part.bold) run.dataset.bold = "";
    if (part.dim) run.dataset.dim = "";
    if (part.italic) run.dataset.italic = "";
    if (part.underline) run.dataset.underline = "";
    node.append(run);
  }
  return node;
}

/** A part of a `logView` — a job's step: its own lines under a head with
 *  its state, name and how long it took. */
export interface LogSection {
  title: string;
  state?: StepState;
  /** On the right of its head — how long it took. */
  meta?: string;
  lines: LogLine[];
  /** Open from the start — by default the ones that failed. */
  open?: boolean;
}

/** The lines of one box: numbered from 1, a heading folding the lines
 *  after it (the part with an error open). */
function drawLines(
  lines: LogLine[],
  box: HTMLElement,
  fold: boolean,
): { rows: HTMLElement[]; groups: HTMLDetailsElement[] } {
  const rows: HTMLElement[] = [];
  const groups: HTMLDetailsElement[] = [];
  let into: HTMLElement = box;
  let failed = false;
  lines.slice(0, LOG_LINES_MAX).forEach((line, i) => {
    const row = el(
      "div",
      "bui-log-line",
      el("span", "bui-log-no", String(i + 1)),
      el("span", "bui-log-time", line.time ?? ""),
      logText(line),
    );
    if (line.tone) row.dataset.tone = line.tone;
    if (line.heading) row.dataset.heading = "";
    rows.push(row);
    if (fold && line.heading) {
      const group = el("details", "bui-log-group") as HTMLDetailsElement;
      group.append(el("summary", undefined, row));
      box.append(group);
      groups.push(group);
      into = group;
    } else into.append(row);
    if (line.tone === "danger") {
      failed = true;
      if (into !== box) (into as HTMLDetailsElement).open = true;
    }
  });
  // Nothing failed: the last part open, where it ended.
  if (!failed && groups.length) groups[groups.length - 1].open = true;
  return { rows, groups };
}

/**
 * A build's or a job's output: numbered lines in a monospace box, a
 * terminal's colours kept, errors and warnings marked. With `sections`,
 * one box per step under a head of its own — state, name, how long — the
 * failed ones open, each numbered from 1, drawn when first opened. With
 * `fold`, a heading folds the lines after it; with `tools`, a bar on top
 * to search all of it, show the times and fold or unfold all — `actions`
 * go at its end (a menu, a button).
 */
export function logView(options: {
  lines?: LogLine[];
  sections?: LogSection[];
  /** A box's most height before it scrolls (px), or `none`: as tall as it
   *  is — in a window that scrolls. Default: 320 (`none` with sections). */
  maxHeight?: number | "none";
  /** Where a box opens: the first error (default), or the end. */
  start?: "error" | "end";
  /** What screen readers call it. */
  label?: string;
  fold?: boolean;
  tools?: boolean;
  actions?: Child[];
}): HTMLElement {
  styled();
  const wrap = el("div", "bui-logview");
  const fold = options.fold === true;
  const height =
    options.maxHeight ?? (options.sections ? "none" : (320 as number | "none"));
  type Block = {
    lines: LogLine[];
    box: HTMLElement;
    details: HTMLDetailsElement | null;
    rows: HTMLElement[] | null;
    groups: HTMLDetailsElement[];
  };
  const newBox = () => {
    const box = el("div", "bui-log");
    box.tabIndex = 0;
    box.setAttribute("role", "log");
    if (options.label) box.setAttribute("aria-label", options.label);
    if (height !== "none") box.style.maxHeight = `${height}px`;
    return box;
  };
  const draw = (b: Block) => {
    if (b.rows) return;
    const drawn = drawLines(b.lines, b.box, fold);
    b.rows = drawn.rows;
    b.groups = drawn.groups;
    if (search) mark(b);
    // At the first error, or at the end.
    const at =
      options.start === "end"
        ? null
        : b.rows.find((r) => r.dataset.tone === "danger");
    later(() => {
      if (height === "none") return;
      if (at)
        b.box.scrollTop = Math.max(0, at.offsetTop - b.box.clientHeight / 3);
      else if (options.start === "end") b.box.scrollTop = b.box.scrollHeight;
    });
  };
  const later =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (fn: () => void) => setTimeout(fn, 0);

  let search = "";
  let hits: HTMLElement[] = [];
  let at = -1;
  const count = el("span", "bui-logview-count", "");
  const blocks: Block[] = [];
  let body: HTMLElement;
  if (options.sections) {
    body = el("div", "bui-logsteps");
    for (const section of options.sections) {
      const details = el("details", "bui-logstep") as HTMLDetailsElement;
      const state = section.state ?? "pending";
      details.dataset.state = state;
      const mark = el(
        "span",
        "bui-step-mark",
        icon(STEP_ICON[state], { size: 15 }),
      );
      mark.dataset.state = state;
      const summary = el(
        "summary",
        undefined,
        mark,
        el("span", "bui-logstep-title", section.title),
        section.meta && el("span", "bui-logstep-meta", section.meta),
      );
      details.append(summary);
      const block: Block = {
        lines: section.lines,
        box: newBox(),
        details,
        rows: null,
        groups: [],
      };
      if (section.lines.length === 0) {
        details.dataset.empty = "";
        summary.addEventListener("click", (event) => event.preventDefault());
      } else details.append(block.box);
      details.addEventListener("toggle", () => {
        if (details.open) draw(block);
      });
      blocks.push(block);
      body.append(details);
      if ((section.open ?? state === "danger") && section.lines.length) {
        details.open = true;
        draw(block);
      }
    }
  } else {
    const box = newBox();
    const block: Block = {
      lines: options.lines ?? [],
      box,
      details: null,
      rows: null,
      groups: [],
    };
    blocks.push(block);
    body = box;
    draw(block);
  }

  // Searching all of it: the blocks with a hit drawn and opened.
  function mark(b: Block) {
    for (const r of b.rows ?? []) {
      const hit =
        search !== "" &&
        (r.querySelector(".bui-log-text")?.textContent ?? "")
          .toLowerCase()
          .includes(search);
      r.toggleAttribute("data-hit", hit);
      r.removeAttribute("data-current");
    }
  }
  const reveal = (row: HTMLElement) => {
    const block = blocks.find((b) => b.rows?.includes(row));
    if (block?.details) block.details.open = true;
    const group = row.closest(
      "details.bui-log-group",
    ) as HTMLDetailsElement | null;
    if (group) group.open = true;
    row.scrollIntoView({ block: "center" });
  };
  const go = (by: number) => {
    if (!hits.length) return;
    hits[at]?.removeAttribute("data-current");
    at = (at + by + hits.length) % hits.length;
    hits[at].dataset.current = "";
    count.textContent = `${at + 1}/${hits.length}`;
    reveal(hits[at]);
  };
  const find = (q: string) => {
    search = q.trim().toLowerCase();
    hits = [];
    at = -1;
    for (const b of blocks) {
      const any =
        search !== "" &&
        b.lines.some((l) => l.text.toLowerCase().includes(search));
      if (any) draw(b);
      mark(b);
      hits.push(...(b.rows ?? []).filter((r) => r.hasAttribute("data-hit")));
    }
    count.textContent = search ? (hits.length ? `0/${hits.length}` : "0") : "";
    if (hits.length) go(1);
  };

  if (options.tools) {
    const input = el("input", "bui-input") as HTMLInputElement;
    input.type = "search";
    input.placeholder = kitText("searchLog");
    input.setAttribute("aria-label", kitText("searchLog"));
    input.addEventListener("input", () => find(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        go(event.shiftKey ? -1 : 1);
      }
    });
    const tool = (name: IconName, label: string, onClick: () => void) => {
      const b = el("button", "bui-logview-tool", icon(name, { size: 14 }));
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.dataset.buiTip = label;
      b.addEventListener("click", onClick);
      return b;
    };
    const all = [...blocks.flatMap((b) => b.lines)];
    const times = tool("clock", kitText("logTimes"), () => {
      const on = wrap.toggleAttribute("data-times");
      times.setAttribute("aria-pressed", String(on));
    });
    times.setAttribute("aria-pressed", "false");
    const folds = options.sections || all.some((l) => l.heading);
    const setAll = (open: boolean) => {
      for (const b of blocks) {
        if (b.details && b.lines.length) {
          if (open) draw(b);
          b.details.open = open;
        }
        for (const g of b.groups) g.open = open;
      }
    };
    wrap.append(
      el(
        "div",
        "bui-logview-bar",
        input,
        count,
        tool("chevron-up", kitText("previous"), () => go(-1)),
        tool("chevron-down", kitText("next"), () => go(1)),
        all.some((l) => l.time) && times,
        folds && tool("plus", kitText("unfoldAll"), () => setAll(true)),
        folds && tool("minus", kitText("foldAll"), () => setAll(false)),
        ...(options.actions ?? []),
      ),
    );
  }
  wrap.append(body);
  if (blocks.some((b) => b.lines.length > LOG_LINES_MAX))
    wrap.append(
      el("p", "bui-hint", kitText("logCut", { count: LOG_LINES_MAX })),
    );
  return wrap;
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
    /** Its state, in colour: the icon — and, for `danger`, the row. */
    tone?: "success" | "danger" | "warning" | "info";
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
    if (item.tone) control.dataset.tone = item.tone;
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
