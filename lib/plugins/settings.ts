// A plugin's settings form (BARY-201): the manifest's `contributes.settings`
// says what may be stored; this checks what a form sent against it. Pure,
// so the action, a test and a plugin author's tooling read it the same way.

/** One setting as the manifest declares it. */
export interface SettingSpec {
  key: string;
  type: "text" | "number" | "boolean" | "select";
  options?: { id: string }[];
}

/** A text setting may be this long. */
export const SETTING_TEXT_MAX = 2000;

export type SettingsResult =
  | { ok: true; values: Record<string, string | number | boolean> }
  | { ok: false; key: string };

/**
 * What a form sent, kept to the declared keys and checked by type: text up
 * to `SETTING_TEXT_MAX`, a finite number, a boolean, one of a select's
 * option ids. An empty text or number is left out — the plugin falls back
 * to its default. Anything else fails, naming the first key that did.
 */
export function checkSettings(
  specs: readonly SettingSpec[],
  input: Record<string, unknown>,
): SettingsResult {
  const values: Record<string, string | number | boolean> = {};
  for (const spec of specs) {
    const raw = input[spec.key];
    if (raw === undefined || raw === null) continue;
    switch (spec.type) {
      case "text": {
        if (typeof raw !== "string") return { ok: false, key: spec.key };
        const text = raw.trim();
        if (text.length > SETTING_TEXT_MAX) return { ok: false, key: spec.key };
        if (text) values[spec.key] = text;
        break;
      }
      case "number": {
        if (raw === "") break;
        const n = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(n)) return { ok: false, key: spec.key };
        values[spec.key] = n;
        break;
      }
      case "boolean":
        if (typeof raw !== "boolean") return { ok: false, key: spec.key };
        values[spec.key] = raw;
        break;
      case "select":
        if (raw === "") break;
        if (
          typeof raw !== "string" ||
          !(spec.options ?? []).some((o) => o.id === raw)
        )
          return { ok: false, key: spec.key };
        values[spec.key] = raw;
        break;
    }
  }
  return { ok: true, values };
}
