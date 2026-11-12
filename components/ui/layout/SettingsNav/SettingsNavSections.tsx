"use client";

import { Icon } from "@iconify/react";
import { NavLink } from "@/components/ui/layout/NavLink/NavLink";
import { KeyboardOnly } from "./KeyboardOnly";
import { SettingsSearchField, settingsHref } from "./SettingsSearch";
import type { SettingsNavSection } from "./searchSections";
import styles from "./settingsNav.module.scss";

/**
 * The settings nav's sections (BARY-201), each heading folding its list
 * away (a native `<details>`). Below a desktop the settings search sits
 * above them; on a desktop it's at the right of the scope tabs.
 */
export function SettingsNavSections({
  sections,
}: {
  sections: SettingsNavSection[];
}) {
  return (
    <>
      <div className={styles.search}>
        <SettingsSearchField />
      </div>
      {sections.map((section, i) => (
        <details
          key={section.title}
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
