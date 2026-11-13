// A plugin's badges on board cards and list rows (BARY-151). One hidden
// frame per plugin and board gets the issues shown, in one batch, and hands
// back a few chips per issue; Barynt draws them with its own components.
// This is what a chip may be, and the check every answer goes through on its
// way out of the sandbox. No dependencies.

/** Chips one plugin may put on one issue. */
export const BADGES_PER_ISSUE = 3;
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

/** A chip as Barynt draws it. */
export interface Badge {
  /** Which of the plugin's `contributes.issueBadges` — what a person can
   *  hide in "Display". */
  badge: string;
  text: string;
  icon?: BadgeIcon;
  tone?: BadgeTone;
  tooltip?: string;
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
    for (const raw of list) {
      if (chips.length >= BADGES_PER_ISSUE) break;
      const b = (raw ?? {}) as Record<string, unknown>;
      const label = text(b.text, TEXT_MAX);
      if (typeof b.badge !== "string" || !declared.has(b.badge) || !label)
        continue;
      const tooltip = text(b.tooltip, TOOLTIP_MAX);
      chips.push({
        badge: b.badge,
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

/** How a plugin's badge is hidden in "Display": `pb:<plugin>:<badge>`. */
export const pluginBadgeEntry = (pluginId: string, badge: string) =>
  `pb:${pluginId}:${badge}`;
