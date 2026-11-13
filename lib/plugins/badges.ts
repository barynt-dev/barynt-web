// A plugin's badges on board cards and list rows (BARY-151). One hidden
// frame per plugin and board gets the issues shown, in one batch, and hands
// back a few chips per issue; Barynt draws them with its own components.
// This is what a chip may be, and the check every answer goes through on its
// way out of the sandbox. No dependencies.

/** Chips one plugin may put on one issue. */
export const BADGES_PER_ISSUE = 3;
/** Rows across a card one plugin may put on one issue (BARY-207). */
export const ROWS_PER_ISSUE = 2;
/** Steps a row's pipeline may show. */
export const STEPS_MAX = 8;
/** Parts one row may be made of, groups and their children counted. */
export const PARTS_MAX = 24;
/** How deep groups may nest. */
export const GROUP_DEPTH = 3;
/** An image's bytes, as its data URL's length. */
export const IMAGE_MAX = 24_000;
const PART_TEXT_MAX = 40;
/** Issues in one request — a board sends more in several. */
export const BADGE_BATCH = 200;
const TEXT_MAX = 24;
const TOOLTIP_MAX = 120;

/** The icons a badge may carry — Barynt's bundle has them, so nothing is
 *  loaded from anywhere. Written out in full so the bundle sees them. */
export const BADGE_ICONS = {
  clock: "lucide:clock",
  timer: "lucide:timer",
  calendar: "lucide:calendar",
  check: "lucide:check",
  "circle-check": "lucide:circle-check",
  "circle-x": "lucide:circle-x",
  "triangle-alert": "lucide:triangle-alert",
  info: "lucide:info",
  flag: "lucide:flag",
  star: "lucide:star",
  bug: "lucide:bug",
  zap: "lucide:zap",
  lock: "lucide:lock",
  eye: "lucide:eye",
  link: "lucide:link",
  user: "lucide:user",
  "message-square": "lucide:message-square",
  "git-pull-request": "lucide:git-pull-request",
  "git-merge": "lucide:git-merge",
  "git-branch": "lucide:git-branch",
  rocket: "lucide:rocket",
  package: "lucide:package",
} as const;
export type BadgeIcon = keyof typeof BADGE_ICONS;

export const BADGE_TONES = [
  "neutral",
  "primary",
  "info",
  "success",
  "warning",
  "danger",
] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

/** A step of a row's pipeline — a build, a review, a check. */
export const STEP_STATES = [
  "success",
  "running",
  "warning",
  "danger",
  "pending",
] as const;
export type StepState = (typeof STEP_STATES)[number];

/** A row's state at its end: done, failed, needs a look, waiting. */
export const ROW_STATUSES = [
  "success",
  "danger",
  "warning",
  "pending",
] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

/** What a row across the card is made of, in the order the plugin chooses
 * (BARY-207, BARY-208). Two kinds of part: building blocks Barynt knows
 * (`steps`, `status`, `sparkline`, `date` …) for the usual things, and
 * `group` with plain `text`, `dot`, `image` to lay out anything else — a
 * tree Barynt draws itself, so a card needs no frame of its own. */
export type RowPart =
  | {
      type: "group";
      direction?: "row" | "column";
      /** Space between children: a step of Barynt's scale. */
      gap?: 0 | 1 | 2 | 3;
      align?: "start" | "center" | "end";
      justify?: "start" | "between" | "end";
      /** Takes the room left in its line. */
      grow?: boolean;
      padding?: 0 | 1 | 2;
      background?: BadgeTone | "subtle";
      border?: boolean;
      radius?: "sm" | "md" | "pill";
      children: RowPart[];
    }
  | { type: "icon"; icon: BadgeIcon; tone?: BadgeTone }
  | {
      type: "text";
      text: string;
      tone?: BadgeTone | "subtle";
      size?: "xs" | "sm" | "base";
      mono?: boolean;
      strong?: boolean;
      italic?: boolean;
    }
  | { type: "dot"; tone?: BadgeTone }
  | {
      type: "image";
      /** A `data:image/png|jpeg|webp;base64,…` URL — no SVG, no address. */
      src: string;
      alt: string;
      width: number;
      height: number;
      rounded?: boolean;
    }
  | { type: "chip"; text: string; tone?: BadgeTone }
  | { type: "label"; name: string; color: string }
  | { type: "avatar"; name: string }
  | { type: "steps"; steps: StepState[] }
  | { type: "progress"; value: number; max: number }
  | { type: "sparkline"; values: number[]; tone?: BadgeTone }
  | { type: "date"; date: string; format?: "relative" | "short" }
  | { type: "link"; text: string; href: string }
  | { type: "status"; status: RowStatus }
  /** Pushes what follows to its line's right end. */
  | { type: "spacer" }
  /** Starts the row's second line — a row is two lines at most. */
  | { type: "break" };

/** A chip as Barynt draws it — small, in the card's footer; or, `kind:
 *  "row"`, a line across the card made of `parts` (BARY-207): a merge
 *  request's number, its state, its pipeline — whatever the plugin puts in. */
export interface Badge {
  /** Which of the plugin's `contributes.issueBadges` — what a person can
   *  hide in "Display". */
  badge: string;
  kind?: "chip" | "row";
  /** A chip's text; a row's summary — where it's shown as a chip (the
   *  list) and read out. */
  text: string;
  icon?: BadgeIcon;
  tone?: BadgeTone;
  tooltip?: string;
  /** A row's parts, left to right. */
  parts?: RowPart[];
  /** A row's click opens the issue at this issue panel of the plugin's. */
  panel?: string;
}

/** An issue as the plugin gets it: always its id and reference; with
 *  `issues:read` confirmed, what the card shows. */
export interface BadgeIssue {
  id: string;
  ref: string;
  title?: string;
  priority?: number;
  dueDate?: string | null;
  created?: string;
}

const text = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * A plugin's answer, as Barynt draws it: chips only for the issues it was
 * asked about, at most `BADGES_PER_ISSUE` each, of a badge its manifest
 * declares, with a known icon and tone; texts cut short. Anything else is
 * dropped — a broken answer shows no chips, not a broken card.
 */
export function parseBadges(
  input: unknown,
  asked: ReadonlySet<string>,
  declared: ReadonlySet<string>,
): Record<string, Badge[]> {
  const out: Record<string, Badge[]> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [issueId, list] of Object.entries(input)) {
    if (!asked.has(issueId) || !Array.isArray(list)) continue;
    const chips: Badge[] = [];
    let chipCount = 0;
    let rowCount = 0;
    for (const raw of list) {
      const b = (raw ?? {}) as Record<string, unknown>;
      const row = b.kind === "row";
      if (row ? rowCount >= ROWS_PER_ISSUE : chipCount >= BADGES_PER_ISSUE)
        continue;
      const parts = row ? parseParts(b.parts) : [];
      if (row && parts.length === 0) continue;
      // A row without its own summary reads as its texts — or, with none,
      // its people; one with neither isn't drawn: nothing to read out.
      const summary = (types: RowPart["type"][]) =>
        text(wordsOf(parts, types).join(" "), TEXT_MAX * 2);
      const label =
        text(b.text, TEXT_MAX) ??
        (row
          ? (summary(["text", "chip", "label", "link"]) ?? summary(["avatar"]))
          : null);
      if (typeof b.badge !== "string" || !declared.has(b.badge) || !label)
        continue;
      const tooltip = text(b.tooltip, TOOLTIP_MAX);
      if (row) rowCount++;
      else chipCount++;
      chips.push({
        badge: b.badge,
        ...(row && { kind: "row" as const, parts }),
        ...(row &&
          typeof b.panel === "string" &&
          /^[a-z][a-z0-9-]{0,39}$/.test(b.panel) && { panel: b.panel }),
        text: label,
        ...(typeof b.icon === "string" &&
          Object.hasOwn(BADGE_ICONS, b.icon) && { icon: b.icon as BadgeIcon }),
        ...(typeof b.tone === "string" &&
          (BADGE_TONES as readonly string[]).includes(b.tone) && {
            tone: b.tone as BadgeTone,
          }),
        ...(tooltip && { tooltip }),
      });
    }
    if (chips.length > 0) out[issueId] = chips;
  }
  return out;
}

const isTone = (v: unknown): v is BadgeTone =>
  typeof v === "string" && (BADGE_TONES as readonly string[]).includes(v);

/** The words of a row's parts of these types, groups opened, in order. */
function wordsOf(parts: RowPart[], types: RowPart["type"][]): string[] {
  return parts.flatMap((p) =>
    p.type === "group"
      ? wordsOf(p.children, types)
      : !types.includes(p.type)
        ? []
        : p.type === "avatar" || p.type === "label"
          ? [p.name]
          : p.type === "text" || p.type === "chip" || p.type === "link"
            ? [p.text]
            : [],
  );
}

const PALETTE = [
  "blue",
  "teal",
  "green",
  "lime",
  "amber",
  "orange",
  "red",
  "purple",
  "indigo",
];
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/**
 * A row's parts as Barynt draws them: known types with known values only,
 * texts cut, groups at most `GROUP_DEPTH` deep, `PARTS_MAX` parts in all,
 * one `break` (two lines) at the top. Images only as small raster data
 * URLs, links only `https`, colours only the palette or a `#hex`.
 */
export function parseParts(
  input: unknown,
  depth = 0,
  budget = { left: PARTS_MAX, breaks: 1 },
): RowPart[] {
  if (!Array.isArray(input)) return [];
  const out: RowPart[] = [];
  for (const raw of input) {
    if (budget.left <= 0) break;
    const p = (raw ?? {}) as Record<string, unknown>;
    const part = parsePart(p, depth, budget);
    if (part) {
      budget.left--;
      out.push(part);
    }
  }
  return out;
}

function parsePart(
  p: Record<string, unknown>,
  depth: number,
  budget: { left: number; breaks: number },
): RowPart | null {
  switch (p.type) {
    case "group": {
      if (depth >= GROUP_DEPTH) return null;
      const children = parseParts(p.children, depth + 1, budget);
      if (children.length === 0) return null;
      return {
        type: "group",
        children,
        ...(oneOf(["row", "column"] as const, p.direction) && {
          direction: p.direction,
        }),
        ...([0, 1, 2, 3].includes(p.gap as number) && {
          gap: p.gap as 0 | 1 | 2 | 3,
        }),
        ...(oneOf(["start", "center", "end"] as const, p.align) && {
          align: p.align,
        }),
        ...(oneOf(["start", "between", "end"] as const, p.justify) && {
          justify: p.justify,
        }),
        ...(p.grow === true && { grow: true }),
        ...([0, 1, 2].includes(p.padding as number) && {
          padding: p.padding as 0 | 1 | 2,
        }),
        ...((isTone(p.background) || p.background === "subtle") && {
          background: p.background as BadgeTone | "subtle",
        }),
        ...(p.border === true && { border: true }),
        ...(oneOf(["sm", "md", "pill"] as const, p.radius) && {
          radius: p.radius,
        }),
      };
    }
    case "icon":
      return typeof p.icon === "string" && Object.hasOwn(BADGE_ICONS, p.icon)
        ? {
            type: "icon",
            icon: p.icon as BadgeIcon,
            ...(isTone(p.tone) && { tone: p.tone }),
          }
        : null;
    case "text": {
      const t = text(p.text, PART_TEXT_MAX);
      return t
        ? {
            type: "text",
            text: t,
            ...((isTone(p.tone) || p.tone === "subtle") && {
              tone: p.tone as BadgeTone | "subtle",
            }),
            ...(oneOf(["xs", "sm", "base"] as const, p.size) && {
              size: p.size,
            }),
            ...(p.mono === true && { mono: true }),
            ...(p.strong === true && { strong: true }),
            ...(p.italic === true && { italic: true }),
          }
        : null;
    }
    case "dot":
      return { type: "dot", ...(isTone(p.tone) && { tone: p.tone }) };
    case "image": {
      const alt = text(p.alt, PART_TEXT_MAX);
      if (
        typeof p.src !== "string" ||
        p.src.length > IMAGE_MAX ||
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.src) ||
        !alt ||
        !num(p.width) ||
        !num(p.height)
      )
        return null;
      return {
        type: "image",
        src: p.src,
        alt,
        width: Math.max(4, Math.min(Math.round(p.width), 64)),
        height: Math.max(4, Math.min(Math.round(p.height), 32)),
        ...(p.rounded === true && { rounded: true }),
      };
    }
    case "chip": {
      const t = text(p.text, TEXT_MAX);
      return t
        ? { type: "chip", text: t, ...(isTone(p.tone) && { tone: p.tone }) }
        : null;
    }
    case "label": {
      const name = text(p.name, TEXT_MAX);
      const color =
        typeof p.color === "string" &&
        (PALETTE.includes(p.color) || /^#[0-9a-f]{3,8}$/i.test(p.color))
          ? p.color
          : null;
      return name && color ? { type: "label", name, color } : null;
    }
    case "avatar": {
      const name = text(p.name, PART_TEXT_MAX);
      return name ? { type: "avatar", name } : null;
    }
    case "steps": {
      const steps = Array.isArray(p.steps)
        ? p.steps
            .slice(0, STEPS_MAX)
            .filter((x): x is StepState => oneOf(STEP_STATES, x))
        : [];
      return steps.length ? { type: "steps", steps } : null;
    }
    case "progress":
      return num(p.value) && num(p.max) && p.max > 0
        ? {
            type: "progress",
            value: Math.max(0, Math.min(p.value, p.max)),
            max: p.max,
          }
        : null;
    case "sparkline": {
      const values = Array.isArray(p.values)
        ? p.values.filter(num).slice(-30)
        : [];
      return values.length >= 2
        ? { type: "sparkline", values, ...(isTone(p.tone) && { tone: p.tone }) }
        : null;
    }
    case "date": {
      if (typeof p.date !== "string" || Number.isNaN(Date.parse(p.date)))
        return null;
      return {
        type: "date",
        date: new Date(p.date).toISOString(),
        ...(oneOf(["relative", "short"] as const, p.format) && {
          format: p.format,
        }),
      };
    }
    case "link": {
      const t = text(p.text, PART_TEXT_MAX);
      if (!t || typeof p.href !== "string" || p.href.length > 2000) return null;
      try {
        const url = new URL(p.href);
        return url.protocol === "https:"
          ? { type: "link", text: t, href: url.href }
          : null;
      } catch {
        return null;
      }
    }
    case "status":
      return oneOf(ROW_STATUSES, p.status)
        ? { type: "status", status: p.status }
        : null;
    case "spacer":
      return { type: "spacer" };
    case "break":
      if (depth > 0 || budget.breaks <= 0) return null;
      budget.breaks--;
      return { type: "break" };
    default:
      return null;
  }
}

/** How a plugin's badge is hidden in "Display": `pb:<plugin>:<badge>`. */
export const pluginBadgeEntry = (pluginId: string, badge: string) =>
  `pb:${pluginId}:${badge}`;
