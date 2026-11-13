// A plugin's settings form (BARY-201): the manifest's `contributes.settings`
// says what may be stored; this checks what a form sent against it. Pure,
// so the action, a test and a plugin author's tooling read it the same way.

/** The kinds of setting a manifest may declare. `member` and `label` pick
 *  from the place's people and labels (BARY-204). */
export const SETTING_TYPES = [
  "text",
  "textarea",
  "number",
  "boolean",
  "url",
  "select",
  "multiselect",
  "member",
  "label",
] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

/** One setting as the manifest declares it. */
export interface SettingSpec {
  key: string;
  type: SettingType;
  options?: { id: string }[];
}

export type SettingValue = string | number | boolean | string[];

/** A text setting may be this long. */
export const SETTING_TEXT_MAX = 2000;
/** A multi-line one, this. */
export const SETTING_TEXTAREA_MAX = 10_000;

export type SettingsResult =
  | { ok: true; values: Record<string, SettingValue> }
  | { ok: false; key: string };

/** An `http(s)` address, as typed — or `null`. */
function webAddress(text: string): string | null {
  if (text.length > SETTING_TEXT_MAX) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? text : null;
  } catch {
    return null;
  }
}

/**
 * What a form sent, kept to the declared keys and checked by type: text up
 * to `SETTING_TEXT_MAX` (multi-line: `SETTING_TEXTAREA_MAX`), a finite
 * number, a boolean, an `http(s)` address, one of a choice's option ids —
 * several, without repeats, for `multiselect`. An empty text, number, choice
 * or list is left out — the plugin falls back to its default. Anything else
 * fails, naming the first key that did.
 */
export function checkSettings(
  specs: readonly SettingSpec[],
  input: Record<string, unknown>,
): SettingsResult {
  const values: Record<string, SettingValue> = {};
  const isOption = (spec: SettingSpec, id: unknown) =>
    typeof id === "string" && (spec.options ?? []).some((o) => o.id === id);
  for (const spec of specs) {
    const raw = input[spec.key];
    if (raw === undefined || raw === null) continue;
    const fail = { ok: false, key: spec.key } as const;
    switch (spec.type) {
      case "text":
      case "textarea": {
        if (typeof raw !== "string") return fail;
        const text = raw.trim();
        const max =
          spec.type === "text" ? SETTING_TEXT_MAX : SETTING_TEXTAREA_MAX;
        if (text.length > max) return fail;
        if (text) values[spec.key] = text;
        break;
      }
      case "url": {
        if (typeof raw !== "string") return fail;
        const text = raw.trim();
        if (!text) break;
        const url = webAddress(text);
        if (!url) return fail;
        values[spec.key] = url;
        break;
      }
      case "number": {
        if (raw === "") break;
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) return fail;
        values[spec.key] = n;
        break;
      }
      case "boolean":
        if (typeof raw !== "boolean") return fail;
        values[spec.key] = raw;
        break;
      case "select":
      case "member":
      case "label":
        if (raw === "") break;
        if (!isOption(spec, raw)) return fail;
        values[spec.key] = raw as string;
        break;
      case "multiselect": {
        if (!Array.isArray(raw)) return fail;
        if (!raw.every((id) => isOption(spec, id))) return fail;
        const ids = [...new Set(raw as string[])];
        if (ids.length > 0) values[spec.key] = ids;
        break;
      }
    }
  }
  return { ok: true, values };
}
