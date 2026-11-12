"use client";

import { Icon } from "@iconify/react";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import { KeyboardOnly } from "./KeyboardOnly";
import {
  SettingsSearchField,
  settingsHref,
  useSettingsSearch,
} from "./SettingsSearch";
import type { SettingsNavSection } from "./searchSections";
import styles from "./settingsNav.module.scss";

/**
 * The settings nav's sections (BARY-201). While the settings search has a
 * query (`SettingsSearchProvider`), they give way to its hits: the rows of
 * every scope — Personal, Project, Workspace — under the scope's name. Each
 * heading folds its list away (a native `<details>`); hits are shown open.
 * Below a desktop the search field sits here; on a desktop it's at the
 * right of the scope tabs.
 */
export function SettingsNavSections({
  sections,
}: {
  sections: SettingsNavSection[];
}) {
  const search = useSettingsSearch();
  const searching = !!search?.query.trim();
  const shown = search && searching ? search.hits : sections;

  return (
    <>
      <div className={styles.search}>
        <SettingsSearchField />
      </div>
      {searching && shown.length === 0 && (
        <p className={styles.noHits}>{search?.noHitsLabel}</p>
      )}
      {shown.map((section, i) => (
        <details
          // A fresh element per search state: a search shows every hit
          // open, even in a section folded away before.
          key={`${section.title}${searching ? ":search" : ""}`}
          className={`${styles.section}${i > 0 ? ` ${styles.group}` : ""}`}
          open
        >
          <summary className={styles.title}>
            {section.title}
            <Icon
              icon="lucide:chevron-down"
              width={14}
              className={styles.fold}
              aria-hidden
            />
          </summary>
          <ul className={styles.list}>
            {section.items.map((item) => {
              const row = (
                <li key={item.href}>
                  <NavLink
                    href={settingsHref(item)}
                    activeHref={item.href}
                    icon={item.icon}
                    leading={item.leading}
                    label={item.label}
                  />
                </li>
              );
              return item.needsKeyboard ? (
                <KeyboardOnly key={item.href}>{row}</KeyboardOnly>
              ) : (
                row
              );
            })}
          </ul>
        </details>
      ))}
    </>
  );
}
