// A plugin's settings form (BARY-201): the manifest's `contributes.settings`
// says what may be stored; this checks what a form sent against it. Pure,
// so the action, a test and a plugin author's tooling read it the same way.

/** The kinds of setting a manifest may declare. `member`, `label` and
 *  `status` pick from the place's people, labels (BARY-204) and statuses
 *  (BARY-224); `repositories` from what the place's connections reach
 *  (BARY-238). `json` is the plugin's own: an object its settings section
 *  draws and saves — Barynt's form doesn't show it (BARY-238). */
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
  "status",
  "repositories",
  "json",
] as const;
export type SettingType = (typeof SETTING_TYPES)[number];

/** One setting as the manifest declares it. */
export interface SettingSpec {
  key: string;
  type: SettingType;
  options?: { id: string }[];
}

export type SettingValue =
  | string
  | number
  | boolean
  | string[]
  | { [key: string]: unknown };

/** A `json` setting, as JSON, may be this long. */
export const SETTING_JSON_MAX = 32 * 1024;

/** `owner/name` — a repository's full name on GitHub. */
export const REPOSITORY_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
/** A `repositories` setting holds at most this many. */
export const REPOSITORIES_MAX = 50;

/**
 * A `repositories` value, however it was kept: a list, or — as the GitHub
 * plugin's older text field had it — `owner/name` per line (or comma).
 * Unique without regard to case, in the order given; nothing that isn't a
 * full name.
 */
export function repositoryList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!REPOSITORY_RE.test(name) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

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
      case "status":
        if (raw === "") break;
        if (!isOption(spec, raw)) return fail;
        values[spec.key] = raw as string;
        break;
      case "repositories": {
        // A list, or text one per line — what isn't a full name fails.
        const items = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? raw.split(/[\n,]/).filter((x) => x.trim())
            : null;
        if (!items) return fail;
        if (
          !items.every(
            (x) => typeof x === "string" && REPOSITORY_RE.test(x.trim()),
          )
        )
          return fail;
        const list = repositoryList(items);
        if (list.length > REPOSITORIES_MAX) return fail;
        if (list.length > 0) values[spec.key] = list;
        break;
      }
      case "json": {
        if (typeof raw !== "object" || Array.isArray(raw)) return fail;
        let json: string;
        try {
          json = JSON.stringify(raw);
        } catch {
          return fail;
        }
        if (json.length > SETTING_JSON_MAX) return fail;
        values[spec.key] = JSON.parse(json);
        break;
      }
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

/** The values a form saves, with what it doesn't show kept: a `json`
 *  setting the plugin's own section keeps (BARY-238). */
export function keepUnshown(
  specs: readonly SettingSpec[],
  saved: unknown,
  values: Record<string, SettingValue>,
): Record<string, SettingValue> {
  const before =
    saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Record<string, SettingValue>)
      : {};
  const kept = { ...values };
  for (const spec of specs)
    if (spec.type === "json" && !(spec.key in kept) && spec.key in before)
      kept[spec.key] = before[spec.key];
  return kept;
}
