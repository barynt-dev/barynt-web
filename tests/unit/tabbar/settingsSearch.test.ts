import { describe, expect, it } from "bun:test";
import { searchSections } from "@/components/ui/layout/SettingsNav/settingsSearch";
import {
  ACCOUNT_SETTINGS_NAV,
  PROJECT_SETTINGS_NAV,
  WORKSPACE_SETTINGS_NAV,
} from "@/lib/nav";
import de from "@/messages/de.json";
import en from "@/messages/en.json";

// Searching the settings nav (BARY-201): by a row's name, by the words on
// its page, or by a heading — which keeps its whole section.

const item = (label: string, keywords: string[] = []) => ({
  href: `/${label}`,
  label,
  icon: "lucide:circle",
  keywords,
});
const sections = [
  {
    title: "Allgemein",
    items: [
      item("Profil", ["Name"]),
      item("Sicherheit", ["Passwort", "Passkey"]),
    ],
  },
  {
    title: "Bedienung",
    items: [item("Aussehen", ["Theme"]), item("Shortcuts")],
  },
];

describe("searchSections", () => {
  it("keeps everything without a query", () => {
    expect(searchSections(sections, "  ")).toBe(sections);
  });

  it("finds a row by the words on its page, ignoring case", () => {
    const hits = searchSections(sections, "passKEY");
    expect(hits.map((s) => s.items.map((i) => i.label))).toEqual([
      ["Sicherheit"],
    ]);
  });

  it("keeps a whole section when its heading matches", () => {
    const hits = searchSections(sections, "bedien");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.items).toHaveLength(2);
  });

  it("ignores accents", () => {
    expect(
      searchSections([{ title: "X", items: [item("Präferenz")] }], "praferenz"),
    ).toHaveLength(1);
  });

  it("drops sections without a hit", () => {
    expect(searchSections(sections, "zzz")).toEqual([]);
  });
});

describe("settings keywords", () => {
  const scopes = {
    account: ACCOUNT_SETTINGS_NAV,
    project: PROJECT_SETTINGS_NAV,
    workspace: WORKSPACE_SETTINGS_NAV,
  } as const;
  for (const [lang, messages] of [
    ["de", de],
    ["en", en],
  ] as const)
    for (const [scope, nav] of Object.entries(scopes))
      it(`${lang}: every ${scope} section has a label, a group and keywords`, () => {
        const words =
          (
            messages.settings.keywords as Record<string, Record<string, string>>
          )[scope] ?? {};
        const nav_ = messages.nav as Record<string, string>;
        const groups = messages.settings.group as Record<string, string>;
        for (const entry of nav) {
          expect(words[entry.labelKey]).toBeString();
          expect(nav_[entry.labelKey]).toBeString();
          expect(groups[entry.group ?? ""]).toBeString();
        }
      });
});
