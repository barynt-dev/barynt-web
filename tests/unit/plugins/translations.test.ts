import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { currentLocale, translator } from "@barynt/plugin-sdk";
import { list, pickMenu } from "@barynt/plugin-sdk/ui";
import { Window } from "happy-dom";
import { validateManifest } from "@/lib/plugins/manifest";
import { translateManifest } from "@/lib/plugins/translate";

// A plugin in the person's language: the manifest's texts by id in
// `locales`, its own texts with the SDK's `translator`, the UI kit's words.

const plugin = {
  id: "tracker",
  name: "Tracker",
  version: "1.0.0",
  minBaryntVersion: "0.1.0",
  author: "Barynt",
  description: { short: "Tracks things." },
  license: "MIT",
  kind: "sandbox",
  levels: ["project"],
  capabilities: ["ui:action", "ui:issue-panel"],
  network: ["api.example.com"],
  contributes: {
    actions: [{ id: "start", title: "Start timer" }],
    issuePanels: [{ id: "time", title: "Time" }],
    settings: [
      { key: "rate", type: "number", label: "Rate", description: "Per hour." },
      {
        key: "mode",
        type: "select",
        label: "Mode",
        options: [
          { id: "fast", label: "Fast" },
          { id: "slow", label: "Slow" },
        ],
      },
    ],
    credentials: [
      {
        key: "token",
        label: "Token",
        level: "project",
        host: "api.example.com",
      },
    ],
  },
  previews: [{ file: "preview-1.webp", title: "The panel" }],
  locales: {
    de: {
      contributes: {
        actions: { start: "Timer starten" },
        issuePanels: { time: { title: "Zeit" } },
        settings: {
          rate: { label: "Satz", description: "Pro Stunde." },
          mode: { label: "Modus", options: { fast: "Schnell" } },
        },
        credentials: { token: "Schlüssel" },
      },
      previews: { "preview-1.webp": "Das Panel" },
    },
  },
};

const issues = (input: unknown) => {
  const r = validateManifest(input);
  return r.ok ? [] : r.errors.map((e) => `${e.path}: ${e.message}`);
};

describe("manifest translations", () => {
  it("accepts texts by id", () => {
    expect(issues(plugin)).toEqual([]);
  });

  it("shows the manifest in the person's language, English where it has none", () => {
    const r = validateManifest(plugin, "de");
    if (!r.ok) throw new Error("invalid");
    const c = r.manifest.contributes;
    expect(c.actions?.[0]?.title).toBe("Timer starten");
    expect(c.issuePanels?.[0]?.title).toBe("Zeit");
    expect(c.settings?.[0]).toMatchObject({
      label: "Satz",
      description: "Pro Stunde.",
    });
    expect(c.settings?.[1]?.label).toBe("Modus");
    expect(c.settings?.[1]?.options?.map((o) => o.label)).toEqual([
      "Schnell",
      "Slow",
    ]);
    expect(c.credentials?.[0]?.label).toBe("Schlüssel");
    expect(r.manifest.previews?.[0]?.title).toBe("Das Panel");
    // Ids and the rest stay as they are.
    expect(c.settings?.[1]?.options?.[0]?.id).toBe("fast");
    expect(c.settings?.[0]?.type).toBe("number");
  });

  it("stays English in a language it has nothing for, and without one", () => {
    const en = validateManifest(plugin, "en");
    const plain = validateManifest(plugin);
    if (!en.ok || !plain.ok) throw new Error("invalid");
    expect(en.manifest.contributes.actions?.[0]?.title).toBe("Start timer");
    expect(plain.manifest.contributes.actions?.[0]?.title).toBe("Start timer");
  });

  it("returns the manifest itself when there's nothing to translate", () => {
    const { locales: _, ...bare } = plugin;
    expect(translateManifest(bare as never, "de")).toBe(bare as never);
  });

  const withDe = (de: unknown) => ({ ...plugin, locales: { de } });

  it("names an id the manifest doesn't have", () => {
    expect(
      issues(withDe({ contributes: { actions: { stop: "Stopp" } } })).join(),
    ).toContain(
      'locales.de.contributes.actions.stop: contributes.actions has no "stop"',
    );
  });

  it("names a text the item doesn't have, and an unknown option", () => {
    const found = issues(
      withDe({
        contributes: {
          actions: { start: { description: "x" } },
          settings: { mode: { options: { medium: "Mittel" } } },
        },
      }),
    ).join("\n");
    expect(found).toContain("has no description to translate");
    expect(found).toContain('no options entry "medium"');
  });

  it("refuses custom fields, an unknown preview and a title too long", () => {
    const found = issues(
      withDe({
        contributes: { fields: { x: "y" }, actions: { start: "x".repeat(61) } },
        previews: { "preview-2.webp": "Zwei" },
      }),
    ).join("\n");
    expect(found).toContain('"fields" has no texts to translate');
    expect(found).toContain("at most 60 characters");
    expect(found).toContain('no preview "preview-2.webp"');
  });

  it("still takes a language with only its description", () => {
    expect(issues(withDe({ description: { short: "Zählt." } }))).toEqual([]);
  });
});

const g = globalThis as { document?: unknown; window?: unknown };
let window: Window;
let savedWindow: unknown;
beforeAll(() => {
  window = new Window();
  savedWindow = g.window;
  g.document = window.document;
  g.window = window;
});
afterAll(async () => {
  delete g.document;
  g.window = savedWindow;
  await window.happyDOM.close();
});

const setLang = (lang: string) => {
  window.document.documentElement.lang = lang;
};

describe("translator", () => {
  const t = translator({
    en: {
      hello: "Hello, {name}",
      bye: "Bye",
      repos_one: "{count} repository",
      repos_other: "{count} repositories",
    },
    de: {
      hello: "Hallo, {name}",
      repos_one: "{count} Repository",
      repos_other: "{count} Repositories",
    },
  });

  it("follows the frame's language, when it's asked", () => {
    setLang("de");
    expect(t("hello", { name: "Ada" })).toBe("Hallo, Ada");
    setLang("en");
    expect(t("hello", { name: "Ada" })).toBe("Hello, Ada");
  });

  it("falls back to English, then to the key", () => {
    setLang("de");
    expect(t("bye")).toBe("Bye");
    expect(t("nope" as never)).toBe("nope");
    setLang("fr");
    expect(t("hello", { name: "Ada" })).toBe("Hello, Ada");
  });

  it("picks the plural form by count", () => {
    setLang("de");
    expect(t("repos", { count: 1 })).toBe("1 Repository");
    expect(t("repos", { count: 3 })).toBe("3 Repositories");
    setLang("en");
    expect(t("repos", { count: 0 })).toBe("0 repositories");
  });

  it("takes a fixed language, and leaves unknown names as they are", () => {
    setLang("en");
    const de = translator({ en: { x: "{a} {b}" }, de: { x: "{a}+{b}" } }, "de");
    expect(de("x", { a: 1 })).toBe("1+{b}");
  });

  it("reads just the language of a regional tag", () => {
    setLang("de-CH");
    expect(currentLocale()).toBe("de");
  });
});

describe("the UI kit's own words", () => {
  it("are in the frame's language", () => {
    setLang("de");
    const menu = pickMenu({ label: "Add", options: [], onPick: () => {} });
    menu.open();
    const search = menu.el.querySelector("input");
    expect(search?.getAttribute("placeholder")).toBe("Suchen");
    const rows = list({
      items: [{ title: "Hibi", onRemove: () => {} }],
    });
    expect(rows.querySelector("button")?.getAttribute("aria-label")).toBe(
      "Hibi entfernen",
    );
    setLang("en");
  });
});
