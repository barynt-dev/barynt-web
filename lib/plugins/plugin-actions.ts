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
  /** A question first (BARY-238): Barynt shows the options, then runs the
   *  action again with the one picked as `choice`. */
  pick?: ActionPick;
  /** A form first (BARY-238): Barynt shows it, then runs the action again
   *  with what was filled in as `values` — `choice` kept. */
  form?: ActionForm;
}

/** A field of an action's form. */
export interface ActionFormField {
  id: string;
  label: string;
  type: "text" | "select";
  value?: string;
  /** `select`: what to pick from — with a note on the right ("Default"). */
  options?: { id: string; label: string; hint?: string }[];
  hint?: string;
  required?: boolean;
  /** Shown as code — a branch's name, say (a select's options too). */
  mono?: boolean;
}

/** What an action asks to fill in before it goes on. */
export interface ActionForm {
  title: string;
  /** Under the title. */
  description?: string;
  fields: ActionFormField[];
  submitLabel?: string;
  /** It costs something — deleting, say: its button in red. Without
   *  fields it's a confirmation. */
  danger?: boolean;
}

/** Most fields an action's form may have. */
export const ACTION_FORM_FIELDS_MAX = 8;

/** What an action asks to pick before it goes on. */
export interface ActionPick {
  title: string;
  options: { id: string; label: string; hint?: string }[];
  /** Before each option — a bundled icon (`lucide:…`). */
  icon?: string;
}

/** Most options an action may offer to pick from. */
export const ACTION_PICK_MAX = 20;

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

/** What an action asks to pick, checked — `null` for anything else. */
function pickOf(raw: unknown): ActionPick | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const title = text(r.title, 120);
  if (!title || !Array.isArray(r.options)) return null;
  const options = r.options.slice(0, ACTION_PICK_MAX).flatMap((o: unknown) => {
    if (!o || typeof o !== "object") return [];
    const x = o as Record<string, unknown>;
    const id = text(x.id, 200);
    const label = text(x.label, 120);
    const hint = text(x.hint, 120);
    return id && label ? [{ id, label, ...(hint && { hint }) }] : [];
  });
  if (options.length === 0) return null;
  const icon = typeof r.icon === "string" ? actionIcon(r.icon) : null;
  return { title, options, ...(icon && { icon }) };
}

/** What an action asks to fill in, checked — `null` for anything else. */
function formOf(raw: unknown): ActionForm | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const title = text(r.title, 120);
  if (!title) return null;
  const fields = (Array.isArray(r.fields) ? r.fields : [])
    .slice(0, ACTION_FORM_FIELDS_MAX)
    .flatMap((f: unknown): ActionFormField[] => {
      if (!f || typeof f !== "object") return [];
      const x = f as Record<string, unknown>;
      const id = text(x.id, 40);
      const label = text(x.label, 80);
      const type = x.type === "select" ? "select" : "text";
      if (!id || !/^[a-zA-Z][\w-]*$/.test(id) || !label) return [];
      const options =
        type === "select" && Array.isArray(x.options)
          ? x.options.slice(0, 100).flatMap((o: unknown) => {
              if (!o || typeof o !== "object") return [];
              const oo = o as Record<string, unknown>;
              const oid = text(oo.id, 200);
              const olabel = text(oo.label, 120);
              const ohint = text(oo.hint, 40);
              return oid && olabel
                ? [{ id: oid, label: olabel, ...(ohint && { hint: ohint }) }]
                : [];
            })
          : undefined;
      if (type === "select" && !options?.length) return [];
      const value = typeof x.value === "string" ? x.value.slice(0, 500) : "";
      const hint = text(x.hint, 160);
      return [
        {
          id,
          label,
          type,
          ...(value && { value }),
          ...(options && { options }),
          ...(hint && { hint }),
          ...(x.required === true && { required: true }),
          ...(x.mono === true && { mono: true }),
        },
      ];
    });
  const description = text(r.description, 300);
  const submitLabel = text(r.submitLabel, 40);
  return {
    title,
    fields,
    ...(description && { description }),
    ...(submitLabel && { submitLabel }),
    ...(r.danger === true && { danger: true }),
  };
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
    ...(pickOf(r.pick) && { pick: pickOf(r.pick) as ActionPick }),
    ...(formOf(r.form) && { form: formOf(r.form) as ActionForm }),
  };
}
