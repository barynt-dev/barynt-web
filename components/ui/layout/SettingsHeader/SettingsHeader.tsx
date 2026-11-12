import { Icon } from "@iconify/react";
import type { ReactNode } from "react";
import { Tab, Tabs } from "@/components/ui/layout/Tabs/Tabs";
import type { SettingsScopeKey, VisibleSettingsScopeEntry } from "@/lib/nav";
import styles from "./settingsHeader.module.scss";

interface Props {
  /**
   * Already built and filtered by the layout — `settingsScopeItems()` plus
   * `visibleSettingsScope()` in `lib/nav.ts`. Only what's missing due to
   * permissions OR a missing address: the layout omits this component
   * entirely once only one segment would remain (see there).
   */
  items: VisibleSettingsScopeEntry[];
  /** The scope currently active. */
  active: SettingsScopeKey;
  /** Names the switcher for screen readers, e.g. "Settings scope". */
  label: string;
  /** At the right end of the row — the settings search, on a desktop. */
  trailing?: ReactNode;
}

/**
 * The topmost row of the settings: the switcher between Personal, Project,
 * and Workspace.
 *
 * It spans across both columns below it — above the scope nav and above the
 * scope itself. That's not cosmetic, it's the hierarchy: the switcher
 * changes both columns at once, so it can't belong to either one. In the nav
 * (208px), there also wasn't room left for a full word for "Personal"; here
 * there's space for both the icon and the label.
 *
 * The row itself sets no bottom edge. The line below it comes from the top
 * edges of the two columns (`SettingsNav`, `PageHeader`) — that way it runs
 * across the full width and stays one line instead of two.
 *
 * The scopes are tabs (`Tabs`, BARY-201), links each: every scope has its
 * own address, and a link can be opened in a new tab. Which one is active is
 * known by the layout that renders the row, not by the browser. At its right
 * end there's room for the settings search (`trailing`).
 */
export function SettingsHeader({ items, active, label, trailing }: Props) {
  return (
    <header className={styles.bar}>
      <Tabs label={label} className={styles.scope}>
        {items.map((item) => (
          <Tab
            key={item.key}
            href={item.href}
            active={item.key === active}
            icon={<Icon icon={item.icon} width={15} />}
          >
            {item.label}
          </Tab>
        ))}
      </Tabs>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </header>
  );
}
