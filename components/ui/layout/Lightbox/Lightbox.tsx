"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import styles from "./lightbox.module.scss";

export interface LightboxImage {
  src: string;
  title?: string;
}

/** How far a finger has to travel before a swipe counts, in px. */
const SWIPE_MIN = 60;

/**
 * Images over the whole screen, one at a time: arrows, the arrow keys or a
 * swipe step through them (round), the thumbnails below jump. Escape, the
 * close button, a click beside the image or a swipe down closes it.
 *
 * A native `<dialog>` opened with `showModal()`: the top layer, focus kept
 * inside and given back to the opener, Escape for free. Controlled — the
 * opener owns `index`, so its own gallery stays on the image last seen.
 */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  labels,
}: {
  images: LightboxImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  labels: { dialog: string; close: string; previous: string; next: string };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  // What had the focus before, to get it back — leaving with the component
  // rather than through `close()` doesn't return it by itself.
  const [opener] = useState(() =>
    typeof document === "undefined"
      ? null
      : (document.activeElement as HTMLElement | null),
  );

  // Open as a modal once mounted; it leaves the top layer with the
  // component. No `close()` on cleanup — that fires `close`, and a re-run
  // effect (Strict Mode) would close it right away.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => opener?.focus();
  }, [opener]);

  const count = images.length;
  const at = Math.min(Math.max(index, 0), count - 1);
  const thumbs = useRef<HTMLElement>(null);

  // The current thumbnail stays in view when the row is wider than the
  // screen.
  useEffect(() => {
    thumbs.current
      ?.querySelector(`[data-index="${at}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [at]);
  const current = images[at];
  const step = (by: number) => count > 1 && onIndex((at + by + count) % count);

  const end = (e: React.PointerEvent) => {
    const from = start.current;
    start.current = null;
    setDrag(null);
    if (!from || from.id !== e.pointerId) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_MIN)
      step(dx < 0 ? 1 : -1);
    else if (dy > SWIPE_MIN * 2) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={styles.lightbox}
      aria-label={labels.dialog}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "ArrowRight") step(1);
        else return;
        e.preventDefault();
      }}
      onClick={(e) => {
        // Beside the image — the dialog, the stage or the bar's empty part.
        if (
          e.target === e.currentTarget ||
          "backdrop" in (e.target as HTMLElement).dataset
        )
          onClose();
      }}
    >
      <header className={styles.bar} data-backdrop>
        <span className={styles.counter} aria-live="polite">
          {count > 1 && `${at + 1} / ${count}`}
          {current?.title && (
            <span className={styles.title}>{current.title}</span>
          )}
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
        >
          <Icon icon="lucide:x" width={22} />
        </button>
      </header>

      <div
        className={styles.stage}
        data-backdrop
        data-dragging={drag ? "" : undefined}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
        }}
        onPointerMove={(e) => {
          const from = start.current;
          if (from?.id === e.pointerId)
            setDrag({
              x: e.clientX - from.x,
              y: Math.max(0, e.clientY - from.y),
            });
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
      >
        {current && (
          // biome-ignore lint/performance/noImgElement: any image the opener hands in, shown as it is
          <img
            key={current.src}
            className={styles.image}
            src={current.src}
            alt={current.title ?? ""}
            draggable={false}
            style={
              drag
                ? ({
                    "--drag-x": `${drag.x}px`,
                    "--drag-y": `${drag.y}px`,
                  } as React.CSSProperties)
                : undefined
            }
          />
        )}
        {count > 1 && (
          <>
            <button
              type="button"
              className={styles.arrow}
              data-side="prev"
              aria-label={labels.previous}
              title={labels.previous}
              onClick={() => step(-1)}
            >
              <Icon icon="lucide:chevron-left" width={26} />
            </button>
            <button
              type="button"
              className={styles.arrow}
              data-side="next"
              aria-label={labels.next}
              title={labels.next}
              onClick={() => step(1)}
            >
              <Icon icon="lucide:chevron-right" width={26} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <nav ref={thumbs} className={styles.thumbs} data-backdrop>
          {images.map((image, i) => (
            <button
              key={image.src}
              type="button"
              className={styles.thumb}
              data-index={i}
              aria-current={i === at || undefined}
              aria-label={image.title ?? `${i + 1} / ${count}`}
              onClick={() => onIndex(i)}
            >
              {/* biome-ignore lint/performance/noImgElement: see above */}
              <img src={image.src} alt="" draggable={false} />
            </button>
          ))}
        </nav>
      )}
    </dialog>
  );
}
