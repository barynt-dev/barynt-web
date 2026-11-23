"use client";

import { type RefObject, useEffect } from "react";

/** How far from an edge the scrolling starts. */
const EDGE = 80;
/** Pixels per second right at the edge (and past it). */
const MAX_SPEED = 1200;
/** Without a fresh `dragover` for this long, the pointer has left (a native
 *  drag only — it keeps firing while the pointer rests; `pointermove` doesn't). */
const STALE_MS = 400;

/**
 * Speed along one axis: zero in the middle, rising towards an edge. Eased
 * (squared), so it starts gently and only races right at the edge — a card
 * held just inside the zone creeps, one pushed against the edge flies.
 */
function speed(pos: number, start: number, end: number) {
  const zone = Math.min(EDGE, (end - start) / 3);
  const ease = (t: number) => MAX_SPEED * Math.min(1, t) ** 2;
  if (pos < start + zone) return -ease((start + zone - pos) / zone);
  if (pos > end - zone) return ease((pos - (end - zone)) / zone);
  return 0;
}

/**
 * While something is dragged on the board, scrolls whatever it's held at
 * the edge of: a card near the top or bottom of a column scrolls that
 * column's cards (with swimlanes, the board itself), and near the left or
 * right of the board the columns scroll sideways. A column being moved
 * (`"column"`) only scrolls sideways.
 *
 * Driven by one animation frame loop, frame-rate independent, so it moves
 * smoothly instead of in the pointer events' jumps, and keeps going while
 * the pointer rests at the edge.
 *
 * The mouse wheel and a trackpad need nothing here: the board drags by
 * pointer events (`pointerDrag.ts`), so the browser scrolls whatever is
 * under the pointer on its own.
 */
export function useDragAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  mode: "card" | "column" | null,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!mode || !container) return;

    let pointer: {
      x: number;
      y: number;
      target: Element;
      at: number;
      native: boolean;
    } | null = null;
    let frame = 0;
    let last = 0;
    // Sub-pixel steps add up here instead of being rounded away.
    const carry = { x: 0, y: 0 };

    /**
     * What can scroll up and down at the pointer, innermost first: the
     * column's own card list, the swimlane's cells (`data-autoscroll` on
     * both), then the board. Only those that actually overflow.
     */
    const verticalScrollers = (target: Element): HTMLElement[] => {
      if (mode !== "card") return [];
      const list = target
        .closest("[data-group-id]")
        ?.querySelector<HTMLElement>("[data-autoscroll]");
      const lane = target.closest<HTMLElement>("[data-autoscroll-lane]");
      return [list, lane, container].filter(
        (el): el is HTMLElement => !!el && el.scrollHeight > el.clientHeight,
      );
    };

    /** Whether `el` can still move by `delta` — at its end, the next one
     *  out takes over (a lane scrolled to its bottom hands on to the board). */
    const canScroll = (el: HTMLElement, delta: number) =>
      delta < 0
        ? el.scrollTop > 0
        : el.scrollTop + el.clientHeight < el.scrollHeight - 1;

    /** The innermost scroller whose edge the pointer is at, and how fast. */
    const verticalPick = (target: Element, y: number) => {
      for (const el of verticalScrollers(target)) {
        const rect = el.getBoundingClientRect();
        const v = speed(y, rect.top, rect.bottom);
        if (v !== 0 && canScroll(el, v)) return { el, v };
      }
      return null;
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      if (!pointer || (pointer.native && now - pointer.at > STALE_MS)) {
        frame = 0;
        return;
      }
      const box = container.getBoundingClientRect();
      const inside =
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom;

      // From the column's top edge down, not the board's: the header above
      // the cards counts as "past the top".
      const picked = inside ? verticalPick(pointer.target, pointer.y) : null;
      const scroller = picked?.el;
      const vx = inside ? speed(pointer.x, box.left, box.right) : 0;
      const vy = picked?.v ?? 0;
      if (vx === 0 && vy === 0) {
        // Out of every edge zone: rest until the pointer moves again.
        frame = 0;
        return;
      }

      carry.x += vx * dt;
      carry.y += vy * dt;
      const dx = Math.trunc(carry.x);
      const dy = Math.trunc(carry.y);
      if (dx !== 0) container.scrollLeft += dx;
      if (dy !== 0 && scroller) scroller.scrollTop += dy;
      carry.x -= dx;
      carry.y -= dy;
      frame = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent | DragEvent) => {
      if (!(e.target instanceof Element)) return;
      pointer = {
        x: e.clientX,
        y: e.clientY,
        target: e.target,
        at: performance.now(),
        native: e.type === "dragover",
      };
      if (!frame) {
        last = performance.now();
        carry.x = 0;
        carry.y = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    // `pointermove` for the board's own drag (`pointerDrag.ts`), `dragover`
    // for a touch tablet's native one.
    document.addEventListener("pointermove", onMove);
    document.addEventListener("dragover", onMove);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("dragover", onMove);
      cancelAnimationFrame(frame);
    };
  }, [containerRef, mode]);
}
