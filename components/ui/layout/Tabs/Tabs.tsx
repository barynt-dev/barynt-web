"use client";

import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import styles from "./tabs.module.scss";

interface TabsProps {
  /** Where the active indicator sits. `top` hangs it off a divider above
   *  the tabs — e.g. tabs sitting in a header right under its top border. */
  indicator?: "top" | "bottom";
  /** Names the set of tabs for assistive tech. */
  label: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Material-style primary tabs: a row of links, the active one marked by a
 * short bar against the divider (`indicator`). Scrolls sideways when the
 * tabs don't fit: the active tab is brought into view, and an edge with
 * more tabs behind it fades out (`data-more`). Domain-agnostic — callers
 * pass `Tab`s.
 */
export function Tabs({
  indicator = "bottom",
  label,
  className,
  children,
}: TabsProps) {
  const ref = useRef<HTMLElement>(null);
  const shownActive = useRef<Element | null>(null);

  // Brings the active tab fully into view; only the row scrolls, never the
  // page. `force` after another tab became active, otherwise only when the
  // row's content changed size (a font or a count arriving late).
  const showActive = (force: boolean) => {
    const row = ref.current;
    const active = row?.querySelector(":scope > [data-active]");
    if (!row || !active) return;
    if (!force && active !== shownActive.current) return;
    shownActive.current = active;
    const bounds = row.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    const margin = 24;
    if (box.left < bounds.left)
      row.scrollLeft -= bounds.left - box.left + margin;
    else if (box.right > bounds.right)
      row.scrollLeft += box.right - bounds.right + margin;
  };

  // Which edges have tabs behind them — for the fade, in CSS. The row and
  // every tab are watched: a tab growing changes how far the row reaches.
  // biome-ignore lint/correctness/useExhaustiveDependencies: set up once; reads the row through its ref
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    const mark = () => {
      const start = row.scrollLeft > 1;
      const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
      const more = start && end ? "both" : start ? "start" : end ? "end" : "";
      if (more) row.dataset.more = more;
      else delete row.dataset.more;
    };
    const resized = () => {
      showActive(false);
      mark();
    };
    mark();
    row.addEventListener("scroll", mark, { passive: true });
    const resize = new ResizeObserver(resized);
    resize.observe(row);
    for (const tab of row.children) resize.observe(tab);
    return () => {
      row.removeEventListener("scroll", mark);
      resize.disconnect();
    };
  }, []);

  // Another tab became active: bring it into view.
  useEffect(() => {
    const active = ref.current?.querySelector(":scope > [data-active]");
    if (active && active !== shownActive.current) showActive(true);
  });

  return (
    <nav
      ref={ref}
      className={[styles.tabs, className].filter(Boolean).join(" ")}
      data-indicator={indicator}
      aria-label={label}
    >
      {children}
    </nav>
  );
}

interface TabProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Where the tab leads. Without one the tab is a button that calls
   *  `onSelect` instead — tabs inside a window, switching what it shows. */
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
  /** After the label, outside the link — e.g. a menu button. Sits above the
   *  link, which otherwise covers the whole tab. */
  trailing?: React.ReactNode;
  /** Right-click on the tab's link. */
  onLinkContextMenu?: React.MouseEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}

/** One tab: a link (or, without `href`, a button) over the whole tab, plus an
 *  optional trailing control. */
export function Tab({
  href,
  onSelect,
  active = false,
  icon,
  trailing,
  onLinkContextMenu,
  className,
  children,
  ...rest
}: TabProps) {
  return (
    <div
      className={[styles.tab, className].filter(Boolean).join(" ")}
      data-active={active || undefined}
      {...rest}
    >
      {href !== undefined ? (
        <Link
          href={href}
          className={styles.link}
          aria-current={active ? "page" : undefined}
          onContextMenu={onLinkContextMenu}
        >
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.label}>{children}</span>
        </Link>
      ) : (
        <button
          type="button"
          className={styles.link}
          aria-current={active ? "true" : undefined}
          onClick={onSelect}
        >
          {icon && <span className={styles.icon}>{icon}</span>}
          <span className={styles.label}>{children}</span>
        </button>
      )}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
}
