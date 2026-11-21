"use client";

import { Icon } from "@iconify/react";
import {
  isValidElement,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { COMPACT_QUERY, useMediaQuery } from "@/lib/utils/useMediaQuery";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

const PER_COLUMN = 3;

function columnsOf<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += PER_COLUMN)
    out.push(items.slice(i, i + PER_COLUMN));
  return out;
}

/**
 * "New in the directory" (BARY-237). What fits shows as it is — two cards
 * to a row on a desktop, one column on a tablet or phone. More than that
 * (six on a desktop, three below) is an endless row: columns of three that
 * scroll sideways and start over after the last, by a swipe, a trackpad or
 * the arrows at its sides. It renders the columns three times and, once a
 * scroll comes to rest, jumps back into the middle copy; the copies either
 * side are only to look at (`inert`).
 */
export function NewestRow({ cards }: { cards: ReactElement[] }) {
  const text = usePluginText();
  const compact = useMediaQuery(COMPACT_QUERY);
  const loop = cards.length > (compact ? PER_COLUMN : 2 * PER_COLUMN);
  const columns = columnsOf(cards);
  const row = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    // The width of one copy: from the first column to the middle copy's.
    const copy = () => {
      const middle = el.children[columns.length] as HTMLElement | undefined;
      const first = el.firstElementChild as HTMLElement | null;
      return middle && first ? middle.offsetLeft - first.offsetLeft : 0;
    };
    const recentre = () => {
      const width = copy();
      if (!width) return;
      if (el.scrollLeft < width * 0.5) el.scrollLeft += width;
      else if (el.scrollLeft >= width * 1.5) el.scrollLeft -= width;
    };
    const measure = () =>
      setEdge({
        start: el.scrollLeft < 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });

    if (loop) {
      el.scrollLeft = copy();
      let rest: ReturnType<typeof setTimeout> | undefined;
      // `scrollend` where there is one, a pause in scrolling elsewhere.
      const onScroll = () => {
        clearTimeout(rest);
        rest = setTimeout(recentre, 160);
      };
      el.addEventListener("scroll", onScroll, { passive: true });
      el.addEventListener("scrollend", recentre);
      const resize = new ResizeObserver(() => {
        el.scrollLeft = copy();
      });
      resize.observe(el);
      return () => {
        clearTimeout(rest);
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("scrollend", recentre);
        resize.disconnect();
      };
    }

    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, [loop, columns.length]);

  const step = (by: 1 | -1) => {
    const el = row.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: by * (first.offsetWidth + gap), behavior: "smooth" });
  };

  const keyOf = (card: ReactElement, i: number) =>
    isValidElement(card) && card.key != null ? String(card.key) : String(i);

  return (
    <div className={styles.featuredStage}>
      <ul className={styles.newest} ref={row} data-loop={loop ? "" : undefined}>
        {loop
          ? [0, 1, 2].flatMap((copy) =>
              columns.map((column, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place in a copy
                  key={`${copy}-${i}`}
                  className={styles.newestColumn}
                  inert={copy !== 1}
                  aria-hidden={copy !== 1 || undefined}
                >
                  {column}
                </li>
              )),
            )
          : cards.map((card, i) => <li key={keyOf(card, i)}>{card}</li>)}
      </ul>
      <button
        type="button"
        className={`${styles.arrow} ${styles.rowArrow}`}
        data-side="prev"
        aria-label={text.t("previousNewest")}
        disabled={!loop && edge.start}
        onClick={() => step(-1)}
      >
        <Icon icon="lucide:chevron-left" width={20} />
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.rowArrow}`}
        data-side="next"
        aria-label={text.t("nextNewest")}
        disabled={!loop && edge.end}
        onClick={() => step(1)}
      >
        <Icon icon="lucide:chevron-right" width={20} />
      </button>
    </div>
  );
}
