// A plugin's own texts in the person's language. English is the base and
// the fallback; any other language lists only what it translates:
//
//   export const t = translator({
//     en: { hello: "Hello, {name}", repos_one: "{count} repository", repos_other: "{count} repositories" },
//     de: { hello: "Hallo, {name}", repos_one: "{count} Repository", repos_other: "{count} Repositories" },
//   });
//   t("hello", { name: "Ada" });   t("repos", { count: 3 });
//
// The language is read when a text is asked for — the frame's `<html lang>`,
// which the plugin sets from `context.locale` on start — so `t` can live at
// a module's top. Texts for the manifest (titles, labels) go in its
// `locales` instead: Barynt shows those itself.

/** A text per key. `{name}` takes the value of that name. */
export type Messages = Record<string, string>;

/** The plural forms a key can end in: `repos_one`, `repos_other` … */
type PluralForm = "zero" | "one" | "two" | "few" | "many" | "other";
type BaseKey<K> = K extends `${infer B}_${PluralForm}` ? B : K;

/** English, complete, and any other languages with the same keys — each
 *  may leave keys out, which then stay English. */
export type Translations<M extends Messages> = { en: M } & Partial<
  Record<string, Partial<Record<keyof M, string>>>
>;

/** Values for a text's `{name}`s; `count` also picks a plural form. */
export type TextValues = Record<string, string | number>;

export type Translate<M extends Messages> = (
  key: BaseKey<keyof M & string> | (keyof M & string),
  values?: TextValues,
) => string;

/** The language the frame shows: what the plugin set from its context,
 *  else English. Just the language — `de-CH` is `de`. */
export function currentLocale(): string {
  const lang =
    typeof document !== "undefined" ? document.documentElement?.lang : "";
  return (lang || "en").toLowerCase().split("-")[0] ?? "en";
}

const fill = (text: string, values?: TextValues) =>
  values
    ? text.replace(/\{(\w+)\}/g, (all, name: string) =>
        name in values ? String(values[name]) : all,
      )
    : text;

/**
 * A `t` for these texts. Looks up the key in the language — with `count`,
 * its plural form first (`key_one`, `key_other`, by `Intl.PluralRules`) —
 * then in English, and shows the key itself if neither has it.
 * `locale` fixes the language; without it, `t` follows the frame's.
 */
export function translator<M extends Messages>(
  translations: Translations<M>,
  locale?: string,
): Translate<M> {
  return (key, values) => {
    const lang = locale ?? currentLocale();
    const count = values?.count;
    const tables = [translations[lang], translations.en].filter(
      Boolean,
    ) as Partial<Record<string, string>>[];
    const keys: string[] = [];
    if (typeof count === "number") {
      let form: string = "other";
      try {
        form = new Intl.PluralRules(lang).select(count);
      } catch {}
      keys.push(`${key}_${form}`, `${key}_other`);
    }
    keys.push(key);
    for (const table of tables)
      for (const k of keys) {
        const text = table[k];
        if (typeof text === "string") return fill(text, values);
      }
    return key;
  };
}
