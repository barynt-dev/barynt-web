import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { SettingsNavSections } from "./SettingsNavSections";
import {
  type SettingsNavSubject,
  SettingsSubjectMenu,
} from "./SettingsSubjectMenu";
import type { SettingsNavSection } from "./searchSections";
import styles from "./settingsNav.module.scss";

export type { SettingsNavSubject };

export interface SettingsNavItem {
  href: string;
  label: string;
  icon: string;
  /** A mark of its own in place of `icon` — a plugin's tile, say. */
  leading?: ReactNode;
  /** Shown only where there's a keyboard — the shortcuts page, say. */
  needsKeyboard?: boolean;
  /** The heading it sits under. Neighbors with the same one share a
   *  section; without one, the nav's `title`. */
  group?: string;
  /** What else finds it in the search — words from its page. */
  keywords?: string[];
  /** A scope's start page ("General"). On a phone that address is the
   *  section list, so the row links with `?open` — the page, not the list. */
  start?: boolean;
}

interface Props {
  /** Whose settings — name of the workspace or the project. */
  subject: string;
  /** Color dot before the name. Without it, the name stands alone. */
  color?: string;
  /** Uploaded image instead of the color dot, e.g. a workspace avatar. */
  image?: string;
  /**
   * Turns the header into a switcher: siblings whose equivalent section you
   * can jump to from here. With fewer than two entries, the name stays put
   * — a trigger with no destination would be a promise the list doesn't keep.
   */
  siblings?: SettingsNavSubject[];
  /** Heading above the switch list, e.g. "Project". */
  siblingsLabel?: string;
  /** Heading of the nav, e.g. "Settings". */
  title: string;
  /**
   * Already filtered: the layout removes whatever permission is missing
   * for. This component checks nothing — it renders whatever it receives.
   */
  items: SettingsNavItem[];
  /** More sections under a heading of their own, after `items` — the
   *  plugins switched on here that have settings, say. Empty ones aren't
   *  passed. */
  groups?: SettingsNavSection[];
}

/**
 * The second navigation level of the settings — for the workspace, for a
 * project, and for one's own account.
 *
 * Switching between these three happens one level up, in the header above
 * (`components/ui/layout/SettingsHeader`) — the switcher there also swaps
 * out this nav, so it can't live inside it.
 *
 * It sits next to the sidebar, not inside it: General, Members, Roles, and
 * Labels belong together and would otherwise bloat the sidebar list by a
 * handful of rows per entry.
 *
 * The rows are the same as in the sidebar (`NavLink`) — two levels of the
 * same navigation shouldn't feel different, and the active marking
 * therefore follows the same rule too (`isNavActive`, so without a pattern
 * it's the whole path, not just its prefix). That keeps this component a
 * Server Component: the row reads the path itself.
 */
export function SettingsNav({
  subject,
  color,
  image,
  siblings,
  siblingsLabel,
  title,
  items,
  groups = [],
}: Props) {
  // The header only becomes a switcher when there's something to switch
  // between: one's own account has no siblings, and a single project isn't
  // a choice.
  const switchable =
    siblingsLabel && color && siblings && siblings.length > 1 ? siblings : null;

  return (
    <nav className={styles.nav} aria-label={title}>
      {switchable && color && siblingsLabel ? (
        <SettingsSubjectMenu
          name={subject}
          color={color}
          image={image}
          siblings={switchable}
          label={siblingsLabel}
        />
      ) : (
        <div className={styles.head}>
          {color && (
            <Avatar
              avatar={{ name: subject, color, image }}
              shape="square"
              size={20}
            />
          )}
          <span className={styles.subject} title={subject}>
            {subject}
          </span>
        </div>
      )}
      <SettingsNavSections
        sections={[...sectionsOf(items, title), ...groups]}
      />
    </nav>
  );
}

/** The items, cut into sections where their `group` changes. */
function sectionsOf(
  items: SettingsNavItem[],
  fallback: string,
): SettingsNavSection[] {
  const sections: SettingsNavSection[] = [];
  for (const item of items) {
    const title = item.group ?? fallback;
    const last = sections.at(-1);
    if (last?.title === title) last.items.push(item);
    else sections.push({ title, items: [item] });
  }
  return sections;
}
