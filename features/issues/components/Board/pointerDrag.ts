"use client";

/**
 * Dragging on the board with pointer events instead of the browser's native
 * drag and drop.
 *
 * A native drag hands the mouse to the operating system for as long as it
 * runs: the page gets no wheel events, so neither the mouse wheel nor a
 * second finger on a trackpad can scroll a column while a card is held.
 * Here the page keeps the pointer, so all of that simply works — the
 * browser scrolls whatever is under the pointer, with its own momentum.
 *
 * What it does: waits for the pointer to move a few pixels (a click stays a
 * click), then lets a copy of the dragged element follow the pointer,
 * reports the element under it on every move — and again after anything
 * scrolls, since the board then moves under a pointer that stands still —
 * and ends with a drop on release, or a cancel on Escape. The click the
 * release would fire is swallowed, so dropping a card doesn't open it.
 */

/** How far the pointer moves before a press becomes a drag. */
const THRESHOLD = 4;

export interface PointerDragSpec {
  /** What is copied to follow the pointer, and where it was grabbed. */
  source: HTMLElement;
  /** Class for the copy (lift, shadow) — its position is set here. */
  ghostClass?: string;
  onStart: () => void;
  /** The element under the pointer — never the copy, which lets it through. */
  onMove: (x: number, y: number, target: Element | null) => void;
  onDrop: (x: number, y: number, target: Element | null) => void;
  onCancel: () => void;
}

/** A copy of `source` at its place on screen, ignored by the pointer. */
function makeGhost(source: HTMLElement, className?: string) {
  const rect = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  // The copy is a picture, not part of the board: nothing may find it as a
  // card, a column or something to scroll.
  for (const el of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
    for (const name of [
      "data-issue-id",
      "data-group-id",
      "data-autoscroll",
      "data-autoscroll-lane",
      "id",
    ])
      el.removeAttribute(name);
  }
  ghost.setAttribute("aria-hidden", "true");
  if (className) ghost.classList.add(className);
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "1000",
  });
  document.body.append(ghost);
  return { ghost, rect };
}

export function startPointerDrag(e: React.PointerEvent, spec: PointerDragSpec) {
  const startX = e.clientX;
  const startY = e.clientY;
  const pointerId = e.pointerId;
  let x = startX;
  let y = startY;
  let started = false;
  let ghost: HTMLElement | null = null;
  let offset = { x: 0, y: 0 };
  const body = document.body.style;
  const saved = { userSelect: body.userSelect, cursor: body.cursor };

  const under = () => document.elementFromPoint(x, y);

  const place = () => {
    if (ghost)
      ghost.style.transform = `translate3d(${x - offset.x}px, ${y - offset.y}px, 0)`;
  };

  const begin = () => {
    started = true;
    const made = makeGhost(spec.source, spec.ghostClass);
    ghost = made.ghost;
    // Kept as a translation from the copy's start, so it moves on the GPU.
    ghost.style.left = "0";
    ghost.style.top = "0";
    offset = { x: startX - made.rect.left, y: startY - made.rect.top };
    place();
    // No text gets selected along the way, and the hand says "holding".
    window.getSelection()?.removeAllRanges();
    body.userSelect = "none";
    body.cursor = "grabbing";
    spec.onStart();
  };

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    x = ev.clientX;
    y = ev.clientY;
    if (!started) {
      if (Math.hypot(x - startX, y - startY) < THRESHOLD) return;
      begin();
    }
    place();
    spec.onMove(x, y, under());
  };

  // The board scrolled (wheel, trackpad, auto-scroll) under a pointer that
  // didn't move: what's under it has changed all the same.
  const scrolled = () => {
    if (started) spec.onMove(x, y, under());
  };

  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    window.removeEventListener("keydown", key, true);
    document.removeEventListener("scroll", scrolled, true);
    ghost?.remove();
    ghost = null;
    body.userSelect = saved.userSelect;
    body.cursor = saved.cursor;
  };

  /** The release over a card would also click it — once, that click goes. */
  const swallowClick = () => {
    const stop = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    // A release that fires no click (outside any element) leaves nothing
    // to swallow — the next real click must not be eaten instead.
    setTimeout(() => window.removeEventListener("click", stop, true), 0);
  };

  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    x = ev.clientX;
    y = ev.clientY;
    const target = started ? under() : null;
    cleanup();
    if (!started) return;
    swallowClick();
    spec.onDrop(x, y, target);
  };

  const cancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (started) spec.onCancel();
  };

  const key = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape" || !started) return;
    ev.preventDefault();
    ev.stopPropagation();
    cleanup();
    // The button is still held: the click comes with its release.
    window.addEventListener("pointerup", swallowClick, { once: true });
    spec.onCancel();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", key, true);
  document.addEventListener("scroll", scrolled, true);
}
