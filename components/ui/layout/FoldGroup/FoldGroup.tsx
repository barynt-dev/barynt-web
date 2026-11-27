"use client";

import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import styles from "./foldGroup.module.scss";

/** Where this browser keeps the groups it folded away. */
const STORE = "barynt:folded";

/**
 * A group of a settings page that folds away under its heading (BARY-238):
 * a native `<details>`, open to start with, and the browser's find-in-page
 * opens it on its own. A group folded away stays so in this browser — by
 * page (one for every project's same page) and heading. `heading` is the
 * page's own `<h2>`, so each page keeps how its headings look; the chevron
 * sits after it. `className` styles the box, `bodyClassName` what's folded.
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
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // Before the browser paints, where it can: folded as it was left.
  useLayoutEffect(() => {
    const details = ref.current;
    if (!details) return;
    const key = foldKey(pathname ?? "", details);
    if (readFolded().includes(key)) details.open = false;
    const remember = () => {
      const rest = readFolded().filter((k) => k !== key);
      writeFolded(details.open ? rest : [...rest, key]);
    };
    details.addEventListener("toggle", remember);
    return () => details.removeEventListener("toggle", remember);
  }, [pathname]);

  return (
    <details
      ref={ref}
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

/**
 * The group's name in the store: its page without the language, the
 * workspace and the project — the same page of every project folds alike —
 * and its heading's text.
 */
export function foldKey(pathname: string, details: HTMLDetailsElement) {
  const page = pathname
    .replace(/^\/[a-z]{2}(?=\/|$)/, "")
    .replace(/^\/[^/]+/, "")
    .replace(/\/project\/[^/]+/, "/project/*");
  const title = details.querySelector("summary")?.textContent?.trim() ?? "";
  return `${page}#${title}`;
}

function readFolded(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    return Array.isArray(value)
      ? value.filter((k): k is string => typeof k === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFolded(keys: string[]) {
  try {
    // The newest 200 — a page renamed leaves its old keys behind.
    localStorage.setItem(STORE, JSON.stringify(keys.slice(-200)));
  } catch {
    // Private mode or blocked storage: it just doesn't stay folded.
  }
}
