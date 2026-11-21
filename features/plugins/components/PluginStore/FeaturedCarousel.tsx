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

/** The index of the card holding `target`, -1 for none. */
function cardAt(track: Element, target: EventTarget): number {
  return Array.from(track.children).findIndex((card) =>
    card.contains(target as Node),
  );
}

/**
 * The featured cards (BARY-237) under their heading. Up to three sit side by
 * side. With more they are a carousel like Material Design 3's hero
 * carousel: the card in focus is large — laid out like a lone featured
 * plugin, always the same width, in the middle — with one small card (logo
 * and name) on each side that has a neighbour. The arrows at its sides, the
 * indicator below, a click on a small card, a swipe or tabbing into a card
 * move on, animated. CSS does the sizes and the slide; this holds the
 * position.
 */
export function FeaturedCarousel({
  head,
  names,
  children,
}: {
  head: ReactNode;
  /** The cards' plugin names, for the indicator. */
  names: string[];
  children: ReactNode;
}) {
  const text = usePluginText();
  const cards = Children.toArray(children);
  const [at, setAt] = useState(0);
  const swipe = useRef<{ x: number } | null>(null);
  const swiped = useRef(false);
  const last = Math.max(cards.length - 1, 0);
  const go = (to: number) => setAt(Math.min(Math.max(to, 0), last));
  const lead = Math.min(at, last);
  const carousel = cards.length > 3;

  return (
    <section
      className={`${styles.homeSection} ${styles.featuredWrap}`}
      data-carousel={carousel ? "" : undefined}
    >
      <header className={styles.homeHead}>{head}</header>
      <div className={styles.featuredStage}>
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
          onPointerCancel={() => {
            swipe.current = null;
          }}
          onClickCapture={(e) => {
            // A swipe that ended on a card is not a click on it, and a click on
            // a small card brings it to the front instead of opening it.
            const i = cardAt(
              e.currentTarget.firstElementChild ?? e.currentTarget,
              e.target,
            );
            if (swiped.current || (i >= 0 && i !== lead)) {
              e.preventDefault();
              e.stopPropagation();
              if (!swiped.current) go(i);
            }
            swiped.current = false;
          }}
          onFocus={(e) => {
            // Only a keyboard's focus: a click focuses too, and must still
            // find the card it hit as it was.
            if (!(e.target as HTMLElement).matches(":focus-visible")) return;
            const i = cardAt(
              e.currentTarget.firstElementChild ?? e.currentTarget,
              e.target,
            );
            if (i >= 0 && i !== lead) go(i);
          }}
        >
          <div className={styles.featuredTrack}>
            {cards.map((card, i) =>
              carousel && isValidElement(card)
                ? cloneElement(card as ReactElement<Record<string, unknown>>, {
                    "data-slot": i === lead ? "lead" : "side",
                  })
                : card,
            )}
          </div>
        </div>
        <button
          type="button"
          className={`${styles.arrow} ${styles.featuredArrow}`}
          data-side="prev"
          aria-label={text.t("previousFeatured")}
          disabled={lead === 0}
          onClick={() => go(lead - 1)}
        >
          <Icon icon="lucide:chevron-left" width={20} />
        </button>
        <button
          type="button"
          className={`${styles.arrow} ${styles.featuredArrow}`}
          data-side="next"
          aria-label={text.t("nextFeatured")}
          disabled={lead === last}
          onClick={() => go(lead + 1)}
        >
          <Icon icon="lucide:chevron-right" width={20} />
        </button>
      </div>
      <div className={styles.featuredDots}>
        {names.map((name, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: the cards' order is their identity here
            key={i}
            type="button"
            aria-label={text.t("featuredShow", { name })}
            aria-current={i === lead ? "true" : undefined}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </section>
  );
}
