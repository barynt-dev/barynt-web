"use client";

import { type RefObject, useEffect, useState } from "react";
import type { GroupKey } from "@/features/issues/group";

/**
 * Widths of the board's columns, dragged at the edge of a column's header —
 * a wider column shows more of each card's title.
 *
 * Kept per device in `localStorage`, not as a preference on the server: how
 * wide a column should be depends on the screen it's looked at. Keyed by
 * grouping and group ("status:<id>"), so the same column has the same width
 * on every board that shows it.
 */
const STORAGE_KEY = "barynt-board-column-widths";

export const MIN_COLUMN_WIDTH = 224;
export const MAX_COLUMN_WIDTH = 640;
/** `--col-w`'s default in `boardColumn.module.scss` (20rem). */
const DEFAULT_COLUMN_WIDTH = 320;
/** Near the board's right edge while resizing, the board scrolls on. */
const RESIZE_EDGE = 48;
/** Pixels per second right at that edge. */
const RESIZE_SPEED = 900;
/** One arrow key press on the handle. */
const KEY_STEP = 16;

type Widths = Record<string, number>;

function load(): Widths {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}

function save(widths: Widths) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {}
}

const clamp = (width: number) =>
  Math.round(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, width)));

export function useColumnWidths(
  groupKey: GroupKey,
  containerRef: RefObject<HTMLElement | null>,
) {
  const [widths, setWidths] = useState<Widths>({});
  // After mount: the server can't know this device's widths.
  useEffect(() => setWidths(load()), []);

  const key = (groupId: string) => `${groupKey}:${groupId}`;

  /** Every element of one column — with swimlanes its head and each cell. */
  const columnEls = (groupId: string) =>
    containerRef.current?.querySelectorAll<HTMLElement>(
      `[data-group-id="${CSS.escape(groupId)}"]`,
    ) ?? [];

  /** Straight onto the elements, without a render — for every pointer move. */
  const apply = (groupId: string, width: number | null) => {
    for (const el of columnEls(groupId)) {
      if (width === null) el.style.removeProperty("--col-w");
      else el.style.setProperty("--col-w", `${width}px`);
    }
  };

  const commit = (groupId: string, width: number | null) => {
    apply(groupId, width);
    setWidths((prev) => {
      const next = { ...prev };
      if (width === null) delete next[key(groupId)];
      else next[key(groupId)] = width;
      save(next);
      return next;
    });
  };

  /** As drawn — a stored width may be capped on a narrow window (84vw). */
  const currentWidth = (groupId: string) =>
    columnEls(groupId)[0]?.getBoundingClientRect().width ??
    widths[key(groupId)] ??
    DEFAULT_COLUMN_WIDTH;

  /** Props for a column's resize handle. */
  const handleProps = (groupId: string) => ({
    // From state, not measured: this runs while rendering.
    "aria-valuenow": widths[key(groupId)] ?? DEFAULT_COLUMN_WIDTH,
    "aria-valuemin": MIN_COLUMN_WIDTH,
    "aria-valuemax": MAX_COLUMN_WIDTH,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      const container = containerRef.current;
      const column = handle.closest<HTMLElement>("[data-group-id]");
      if (!column) return;
      const startWidth = currentWidth(groupId);
      // Where on the handle it was caught, relative to the column's edge.
      const grab = column.getBoundingClientRect().right - e.clientX;
      let width = startWidth;
      let pointerX = e.clientX;
      let frame = 0;
      let last = 0;
      handle.setPointerCapture(e.pointerId);
      // Cursor and no text selection on the whole board while dragging.
      if (container) container.dataset.resizing = "";

      /**
       * From the column's left edge as it is on screen right now to the
       * pointer — not "start width + distance dragged". The board scrolls
       * under the column while it's resized (at the right edge, below, or
       * by itself when a narrower column leaves less to scroll), and only
       * a width measured from where the column actually is keeps its edge
       * under the pointer through all of that. Twice: a narrower column
       * can pull the board's scroll back, which moves the column again.
       */
      const update = () => {
        for (let pass = 0; pass < 2; pass++) {
          const left = column.getBoundingClientRect().left;
          const next = clamp(pointerX + grab - left);
          if (next === width && pass > 0) break;
          width = next;
          apply(groupId, width);
        }
      };

      // A column at the screen's right edge can't be dragged wider — the
      // pointer has nowhere further to go. Held near the board's right
      // edge, the column keeps growing (faster the closer) and the board
      // scrolls along by as much, so its edge stays under the pointer. The
      // column first, then the scroll: until it's wider, there may be
      // nothing to scroll yet.
      const tick = (now: number) => {
        frame = 0;
        if (!container) return;
        const dt = Math.min(now - last, 50) / 1000;
        last = now;
        const right = container.getBoundingClientRect().right;
        const into = (pointerX - (right - RESIZE_EDGE)) / RESIZE_EDGE;
        if (into <= 0 || width >= MAX_COLUMN_WIDTH) return;
        const step = Math.max(
          1,
          Math.round(RESIZE_SPEED * Math.min(1, into) ** 2 * dt),
        );
        const wider = clamp(width + step);
        apply(groupId, wider);
        container.scrollLeft += wider - width;
        width = wider;
        update();
        frame = requestAnimationFrame(tick);
      };

      const move = (ev: PointerEvent) => {
        pointerX = ev.clientX;
        update();
        if (!frame) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      };
      const end = () => {
        cancelAnimationFrame(frame);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        if (container) delete container.dataset.resizing;
        if (width !== startWidth) commit(groupId, width);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
    // Back to the default width.
    onDoubleClick: () => commit(groupId, null),
    onKeyDown: (e: React.KeyboardEvent) => {
      const step =
        e.key === "ArrowRight"
          ? KEY_STEP
          : e.key === "ArrowLeft"
            ? -KEY_STEP
            : 0;
      if (step === 0) return;
      e.preventDefault();
      commit(groupId, clamp(currentWidth(groupId) + step));
    },
  });

  return {
    widthOf: (groupId: string): number | undefined => widths[key(groupId)],
    handleProps,
  };
}
