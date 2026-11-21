"use client";

import { Icon } from "@iconify/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/**
 * "New in the directory" (BARY-237): three cards per column, the columns in
 * a row that scrolls sideways — a swipe or a trackpad, and arrows at its
 * sides while there's more to see. Snaps column by column.
 */
export function NewestRow({ children }: { children: ReactNode }) {
  const text = usePluginText();
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () =>
      setEdge({
        start: el.scrollLeft < 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, []);

  const step = (by: 1 | -1) => {
    const el = row.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: by * (card.offsetWidth + gap), behavior: "smooth" });
  };

  return (
    <div className={styles.featuredStage}>
      <ul className={styles.newest} ref={row}>
        {children}
      </ul>
      <button
        type="button"
        className={`${styles.arrow} ${styles.rowArrow}`}
        data-side="prev"
        aria-label={text.t("previousNewest")}
        disabled={edge.start}
        onClick={() => step(-1)}
      >
        <Icon icon="lucide:chevron-left" width={20} />
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.rowArrow}`}
        data-side="next"
        aria-label={text.t("nextNewest")}
        disabled={edge.end}
        onClick={() => step(1)}
      >
        <Icon icon="lucide:chevron-right" width={20} />
      </button>
    </div>
  );
}
