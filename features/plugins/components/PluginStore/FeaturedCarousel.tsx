"use client";

import { Icon } from "@iconify/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

/**
 * The featured cards (BARY-237). Up to three sit side by side; with more
 * they become a carousel — a row that scrolls and snaps card by card, the
 * next one peeking in from the right, with arrows on a mouse (CSS decides
 * which of the two, by the number of cards).
 */
export function FeaturedCarousel({ children }: { children: ReactNode }) {
  const text = usePluginText();
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft < 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const step = (by: 1 | -1) => {
    const el = track.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: by * (card.offsetWidth + gap), behavior: "smooth" });
  };

  return (
    <div className={styles.featuredWrap}>
      <div className={styles.featured} ref={track} onScroll={measure}>
        {children}
      </div>
      <button
        type="button"
        className={styles.featuredArrow}
        data-side="prev"
        aria-label={text.t("previousFeatured")}
        disabled={edge.start}
        onClick={() => step(-1)}
      >
        <Icon icon="lucide:chevron-left" width={20} />
      </button>
      <button
        type="button"
        className={styles.featuredArrow}
        data-side="next"
        aria-label={text.t("nextFeatured")}
        disabled={edge.end}
        onClick={() => step(1)}
      >
        <Icon icon="lucide:chevron-right" width={20} />
      </button>
    </div>
  );
}
