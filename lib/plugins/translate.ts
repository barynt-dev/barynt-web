// A plugin's texts in other languages: the titles, labels and descriptions
// of what it contributes, and its previews' captions. The manifest is
// written in English; `locales.<lang>` holds only what differs, by id:
//
//   "locales": { "de": {
//     "contributes": {
//       "actions":  { "create-branch": "Branch erstellen" },
//       "settings": { "branchPattern": { "label": "Branch-Name", "description": "…" } },
//       "inboundHooks": { "github": { "title": "…", "rules": { "opened": "…" } } }
//     },
//     "previews": { "preview-1.webp": "Pull Requests auf dem Board" }
//   } }
//
// A string translates an item's main text (`title`, else `label`); an object
// names the texts. Anything left out stays English. Pure: no manifest
// import, so `manifest.ts` can use the check below.

/** The contributions whose texts can be translated. Custom `fields` can't:
 *  they become a project's own fields, with one name for everyone. */
export const TRANSLATABLE_KINDS = [
  "navItems",
  "projectViews",
  "dashboardWidgets",
  "widgetTemplates",
  "widgetBlocks",
  "issuePanels",
  "issueBadges",
  "actions",
  "settings",
  "credentials",
  "inboundHooks",
  "connections",
] as const;

/** The texts of an item, with the length each may have. */
const TEXT_MAX: Record<string, number> = {
  title: 60,
  label: 60,
  description: 300,
};

/** Lists inside an item whose entries are translated by id. */
const NESTED = ["options", "rules"] as const;

type Item = Record<string, unknown>;
/** An item's translation: its main text, or its texts by name. */
export type ItemText = string | Record<string, unknown>;

export interface Translations {
  contributes?: Partial<Record<string, Record<string, ItemText>>>;
  previews?: Record<string, string>;
}

const idOf = (item: Item) =>
  typeof item.id === "string"
    ? item.id
    : typeof item.key === "string"
      ? item.key
      : undefined;

const mainText = (item: Item) =>
  typeof item.title === "string"
    ? "title"
    : typeof item.label === "string"
      ? "label"
      : undefined;

const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);

function overlay<T extends Item>(item: T, text: unknown): T {
  if (typeof text === "string") {
    const main = mainText(item);
    return main ? { ...item, [main]: text } : item;
  }
  if (!isObject(text)) return item;
  const out: Item = { ...item };
  for (const [name, value] of Object.entries(text)) {
    if (name in TEXT_MAX && typeof value === "string") out[name] = value;
    else if (
      (NESTED as readonly string[]).includes(name) &&
      isObject(value) &&
      Array.isArray(item[name])
    )
      out[name] = (item[name] as Item[]).map((n) => {
        const id = idOf(n);
        return id ? overlay(n, value[id]) : n;
      });
  }
  return out as T;
}

/**
 * The manifest in `locale`: its texts from `locales[locale]` where there
 * are some, English elsewhere. Returns the same object when there's
 * nothing to translate.
 */
export function translateManifest<
  M extends {
    contributes: object;
    previews?: { file: string; title: string }[];
    locales?: Partial<Record<string, unknown>>;
  },
>(manifest: M, locale: string): M {
  const t = manifest.locales?.[locale] as Translations | undefined;
  if (!t || (!t.contributes && !t.previews)) return manifest;
  const contributes: Record<string, unknown> = { ...manifest.contributes };
  for (const [kind, texts] of Object.entries(t.contributes ?? {})) {
    const list = contributes[kind];
    if (!Array.isArray(list) || !texts) continue;
    contributes[kind] = list.map((item: Item) => {
      const id = idOf(item);
      return id ? overlay(item, texts[id]) : item;
    });
  }
  return {
    ...manifest,
    contributes,
    ...(manifest.previews && {
      previews: manifest.previews.map((p) =>
        t.previews?.[p.file] ? { ...p, title: t.previews[p.file] } : p,
      ),
    }),
  };
}

/**
 * What's wrong with a language's translations: a contribution, an id, a
 * text or an entry the manifest doesn't have — most likely a typo, which
 * would otherwise just leave the text English — or a text too long.
 */
export function translationIssues(
  manifest: {
    contributes: object;
    previews?: { file: string }[];
  },
  texts: Translations,
): { path: (string | number)[]; message: string }[] {
  const issues: { path: (string | number)[]; message: string }[] = [];
  const add = (path: (string | number)[], message: string) =>
    issues.push({ path, message });

  const checkItem = (
    item: Item,
    text: unknown,
    path: (string | number)[],
  ): void => {
    if (typeof text === "string") {
      const main = mainText(item);
      if (!main) add(path, "has no title or label to translate");
      else if (text.length > TEXT_MAX[main])
        add(path, `at most ${TEXT_MAX[main]} characters`);
      return;
    }
    if (!isObject(text)) {
      add(path, "expected a text or { title, label, description, … }");
      return;
    }
    for (const [name, value] of Object.entries(text)) {
      const at = [...path, name];
      if (name in TEXT_MAX) {
        if (typeof item[name] !== "string")
          add(at, `this one has no ${name} to translate`);
        else if (typeof value !== "string" || !value.trim())
          add(at, "expected a text");
        else if (value.length > TEXT_MAX[name])
          add(at, `at most ${TEXT_MAX[name]} characters`);
      } else if ((NESTED as readonly string[]).includes(name)) {
        const list = Array.isArray(item[name]) ? (item[name] as Item[]) : [];
        if (!isObject(value)) {
          add(at, `expected { <id>: text } for its ${name}`);
          continue;
        }
        for (const [id, sub] of Object.entries(value)) {
          const entry = list.find((n) => idOf(n) === id);
          if (!entry) add([...at, id], `no ${name} entry "${id}"`);
          else checkItem(entry, sub, [...at, id]);
        }
      } else
        add(at, "only title, label, description, options and rules translate");
    }
  };

  const contributes = manifest.contributes as Record<string, unknown>;
  for (const [kind, byId] of Object.entries(texts.contributes ?? {})) {
    const path = ["contributes", kind];
    if (!(TRANSLATABLE_KINDS as readonly string[]).includes(kind)) {
      add(path, `"${kind}" has no texts to translate`);
      continue;
    }
    const list = Array.isArray(contributes[kind])
      ? (contributes[kind] as Item[])
      : [];
    for (const [id, text] of Object.entries(byId ?? {})) {
      const item = list.find((n) => idOf(n) === id);
      if (!item) add([...path, id], `contributes.${kind} has no "${id}"`);
      else checkItem(item, text, [...path, id]);
    }
  }
  for (const [file, title] of Object.entries(texts.previews ?? {})) {
    if (!manifest.previews?.some((p) => p.file === file))
      add(["previews", file], `no preview "${file}"`);
    else if (title.length > TEXT_MAX.title)
      add(["previews", file], `at most ${TEXT_MAX.title} characters`);
  }
  return issues;
}
