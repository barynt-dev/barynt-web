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
