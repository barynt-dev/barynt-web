"use client";

import { Icon } from "@iconify/react";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from "react";
import { usePluginText } from "../shared";
import styles from "./pluginStore.module.scss";

const SWIPE_PX = 40;

/**
 * The featured cards (BARY-237). Up to three sit side by side. With more
 * they are a carousel like Material Design 3's hero carousel: the card in
 * front is large — laid out like a lone featured plugin — the ones behind it
 * small, the next peeking in. A step (arrows, a swipe, tabbing into a card)
 * hands the large size on. CSS decides between the two by the number of
 * cards; the sizes and the slide are CSS too, this holds the position.
 */
export function FeaturedCarousel({ children }: { children: ReactNode }) {
  const text = usePluginText();
  const cards = Children.toArray(children);
  const [at, setAt] = useState(0);
  const swipe = useRef<{ x: number } | null>(null);
  const swiped = useRef(false);
  const last = Math.max(cards.length - 1, 0);
  const go = (to: number) => setAt(Math.min(Math.max(to, 0), last));
  const lead = Math.min(at, last);

  return (
    <div className={styles.featuredWrap}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a swipe is an extra way to the arrows' step; the cards themselves are links */}
      <div
        className={styles.featured}
        style={{ "--lead": lead } as React.CSSProperties}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX };
        }}
        onPointerUp={(e) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          if (Math.abs(dx) >= SWIPE_PX) {
            swiped.current = true;
            go(lead + (dx < 0 ? 1 : -1));
          }
        }}
        onClickCapture={(e) => {
          // A swipe that ended on a card is not a click on it.
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
        onFocus={(e) => {
          const i = cards.findIndex((_, n) =>
            (e.currentTarget.children[n] as HTMLElement | undefined)?.contains(
              e.target as Node,
            ),
          );
          if (i >= 0 && i !== lead) go(i);
        }}
      >
        <div className={styles.featuredTrack}>
          {cards.map((card, i) =>
            isValidElement(card)
              ? cloneElement(card as ReactElement<Record<string, unknown>>, {
                  "data-lead": i === lead ? "" : undefined,
                })
              : card,
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.featuredArrow}
        data-side="prev"
        aria-label={text.t("previousFeatured")}
        disabled={lead === 0}
        onClick={() => go(lead - 1)}
      >
        <Icon icon="lucide:chevron-left" width={20} />
      </button>
      <button
        type="button"
        className={styles.featuredArrow}
        data-side="next"
        aria-label={text.t("nextFeatured")}
        disabled={lead === last}
        onClick={() => go(lead + 1)}
      >
        <Icon icon="lucide:chevron-right" width={20} />
      </button>
    </div>
  );
}
