import type { SettingsNavItem } from "./SettingsNav";

// The settings nav's search (BARY-201), apart from its component so it
// runs without a renderer.

export interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

/** Lower case, without accents — "Präferenz" finds "praferenz" too. */
const fold = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** What a search keeps: a section whose heading matches stays whole,
 *  otherwise only the rows whose label or keywords match. */
export function searchSections(
  sections: SettingsNavSection[],
  query: string,
): SettingsNavSection[] {
  const needle = fold(query.trim());
  if (!needle) return sections;
  const hit = (s: string) => fold(s).includes(needle);
  return sections
    .map((section) =>
      hit(section.title)
        ? section
        : {
            ...section,
            items: section.items.filter(
              (item) => hit(item.label) || (item.keywords ?? []).some(hit),
            ),
          },
    )
    .filter((section) => section.items.length > 0);
}

/** The hits as the dropdown lists them: a page drops out where one of its
 *  own settings is a hit too — "Name" finds First name and Last name, not
 *  General above them. A page without a setting hit stays (Members). */
export function preferSettings(
  sections: SettingsNavSection[],
): SettingsNavSection[] {
  return sections.map((section) => {
    const withSetting = new Set(
      section.items.filter((i) => i.focus).map((i) => i.href),
    );
    return {
      ...section,
      items: section.items.filter((i) => i.focus || !withSetting.has(i.href)),
    };
  });
}
