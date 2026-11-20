import { BADGE_ICONS, BADGE_TONES, type BadgeTone } from "./badges";

// A plugin's actions (BARY-152): entries in an issue's "…" menu, in a
// card's quick actions and in the command palette. Barynt runs one in the
// plugin's hidden frame (slot `actions`) and shows what it answers. This is
// what an answer may be, and the check it goes through. No dependencies.

/** Where an action shows. */
export const ACTION_PLACES = [
  "issueMenu",
  "cardMenu",
  "commandPalette",
] as const;
export type ActionPlace = (typeof ACTION_PLACES)[number];

/** An action as the menus offer it. */
export interface PluginActionEntry {
  pluginId: string;
  pluginName: string;
  actionId: string;
  title: string;
  /** A bundled icon name (`lucide:…`), or the plugin's mark. */
  icon: string;
  where: ActionPlace[];
  /** Asked first, with this text. */
  confirm: string | null;
  danger: boolean;
}

/** What an action answers. */
export interface ActionResult {
  /** Shown as a toast. */
  message?: string;
  tone?: BadgeTone;
  /** Load the page's data again — the action changed something. */
  refresh?: boolean;
  /** Open the issue at this one of the plugin's issue panels. */
  openPanel?: string;
  /** Text Barynt puts on the clipboard — a branch's name (BARY-230). */
  copy?: string;
  /** An `https` address Barynt opens in a new tab (BARY-230). */
  open?: string;
}

/** Most text an action may put on the clipboard. */
export const ACTION_COPY_MAX = 500;
/** Longest address an action may open. */
export const ACTION_OPEN_MAX = 2000;

/** An `https` address as an action may open it — else `null`. */
function openable(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > ACTION_OPEN_MAX) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** An action's icon, if Barynt has it in its bundle — else `null` (the
 *  menu shows the plugin's puzzle). Nothing is loaded from anywhere. */
export function actionIcon(icon: string | undefined): string | null {
  if (!icon?.startsWith("lucide:")) return null;
  const name = icon.slice("lucide:".length);
  return Object.hasOwn(BADGE_ICONS, name)
    ? BADGE_ICONS[name as keyof typeof BADGE_ICONS]
    : null;
}

/** An action's answer as Barynt uses it — anything else dropped. */
export function parseActionResult(input: unknown): ActionResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const r = input as Record<string, unknown>;
  const message =
    typeof r.message === "string" && r.message.trim()
      ? r.message.trim().slice(0, 120)
      : undefined;
  return {
    ...(message && { message }),
    ...(typeof r.tone === "string" &&
      (BADGE_TONES as readonly string[]).includes(r.tone) && {
        tone: r.tone as BadgeTone,
      }),
    ...(r.refresh === true && { refresh: true }),
    ...(typeof r.openPanel === "string" &&
      /^[a-z][a-z0-9-]{0,39}$/.test(r.openPanel) && {
        openPanel: r.openPanel,
      }),
    ...(typeof r.copy === "string" &&
      r.copy &&
      r.copy.length <= ACTION_COPY_MAX && { copy: r.copy }),
    ...(openable(r.open) && { open: openable(r.open) as string }),
  };
}
