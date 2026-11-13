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
/** Parts one row may be made of. */
export const PARTS_MAX = 8;
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

/** What a row across the card is made of, left to right, in the order
 *  the plugin chooses (BARY-207) — Barynt draws each part itself. */
export type RowPart =
  | { type: "icon"; icon: BadgeIcon; tone?: BadgeTone }
  | {
      type: "text";
      text: string;
      tone?: BadgeTone | "subtle";
      mono?: boolean;
      strong?: boolean;
    }
  | { type: "chip"; text: string; tone?: BadgeTone }
  | { type: "avatar"; name: string }
  | { type: "steps"; steps: StepState[] }
  | { type: "progress"; value: number; max: number }
  | { type: "status"; status: RowStatus }
  /** Pushes what follows to the row's right end. */
  | { type: "spacer" };

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
        text(
          parts
            .flatMap((p) =>
              !types.includes(p.type)
                ? []
                : p.type === "avatar"
                  ? [p.name]
                  : p.type === "text" || p.type === "chip"
                    ? [p.text]
                    : [],
            )
            .join(" "),
          TEXT_MAX * 2,
        );
      const label =
        text(b.text, TEXT_MAX) ??
        (row ? (summary(["text", "chip"]) ?? summary(["avatar"])) : null);
      if (typeof b.badge !== "string" || !declared.has(b.badge) || !label)
        continue;
      const tooltip = text(b.tooltip, TOOLTIP_MAX);
      if (row) rowCount++;
      else chipCount++;
      chips.push({
        badge: b.badge,
        ...(row && { kind: "row" as const, parts }),
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

/** A row's parts as Barynt draws them: known types with known values only,
 *  texts cut, at most `PARTS_MAX`. */
function parseParts(input: unknown): RowPart[] {
  if (!Array.isArray(input)) return [];
  const out: RowPart[] = [];
  for (const raw of input) {
    if (out.length >= PARTS_MAX) break;
    const p = (raw ?? {}) as Record<string, unknown>;
    switch (p.type) {
      case "icon":
        if (typeof p.icon === "string" && Object.hasOwn(BADGE_ICONS, p.icon))
          out.push({
            type: "icon",
            icon: p.icon as BadgeIcon,
            ...(isTone(p.tone) && { tone: p.tone }),
          });
        break;
      case "text": {
        const t = text(p.text, PART_TEXT_MAX);
        if (t)
          out.push({
            type: "text",
            text: t,
            ...((isTone(p.tone) || p.tone === "subtle") && {
              tone: p.tone as BadgeTone | "subtle",
            }),
            ...(p.mono === true && { mono: true }),
            ...(p.strong === true && { strong: true }),
          });
        break;
      }
      case "chip": {
        const t = text(p.text, TEXT_MAX);
        if (t)
          out.push({
            type: "chip",
            text: t,
            ...(isTone(p.tone) && { tone: p.tone }),
          });
        break;
      }
      case "avatar": {
        const name = text(p.name, PART_TEXT_MAX);
        if (name) out.push({ type: "avatar", name });
        break;
      }
      case "steps": {
        const steps = Array.isArray(p.steps)
          ? p.steps
              .slice(0, STEPS_MAX)
              .filter((x): x is StepState =>
                (STEP_STATES as readonly unknown[]).includes(x),
              )
          : [];
        if (steps.length) out.push({ type: "steps", steps });
        break;
      }
      case "progress":
        if (
          typeof p.value === "number" &&
          typeof p.max === "number" &&
          Number.isFinite(p.value) &&
          Number.isFinite(p.max) &&
          p.max > 0
        )
          out.push({
            type: "progress",
            value: Math.max(0, Math.min(p.value, p.max)),
            max: p.max,
          });
        break;
      case "status":
        if ((ROW_STATUSES as readonly unknown[]).includes(p.status))
          out.push({ type: "status", status: p.status as RowStatus });
        break;
      case "spacer":
        out.push({ type: "spacer" });
        break;
    }
  }
  return out;
}

/** How a plugin's badge is hidden in "Display": `pb:<plugin>:<badge>`. */
export const pluginBadgeEntry = (pluginId: string, badge: string) =>
  `pb:${pluginId}:${badge}`;
