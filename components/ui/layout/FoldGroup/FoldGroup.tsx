import { Icon } from "@iconify/react";
import type { ReactNode } from "react";
import styles from "./foldGroup.module.scss";

/**
 * A group of a settings page that folds away under its heading (BARY-238):
 * a native `<details>`, open to start with — no script, and the browser's
 * find-in-page opens it on its own. `heading` is the page's own `<h2>`, so
 * each page keeps how its headings look; the chevron sits after it.
 * `className` styles the box, `bodyClassName` what's folded.
 */
export function FoldGroup({
  heading,
  children,
  className,
  bodyClassName,
  id,
}: {
  heading: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <details
      className={[styles.fold, className].filter(Boolean).join(" ")}
      id={id}
      open
    >
      <summary className={styles.summary}>
        {heading}
        <Icon
          icon="lucide:chevron-down"
          width={15}
          className={styles.chevron}
          aria-hidden
        />
      </summary>
      <div className={[styles.body, bodyClassName].filter(Boolean).join(" ")}>
        {children}
      </div>
    </details>
  );
}
