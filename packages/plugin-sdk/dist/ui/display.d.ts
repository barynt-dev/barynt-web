import { type Child, type Tone } from "./core";
import { type IconName } from "./icons";
/** One of the built-in icons (`IconName`), in the text's colour. With a
 *  `label` it's announced; without, it's decoration. */
export declare function icon(name: IconName, options?: {
    size?: number;
    label?: string;
}): SVGSVGElement;
export declare function heading(options: {
    text: string;
    /** 1 to 4 — the page's outline, and the size. Default 2. */
    level?: 1 | 2 | 3 | 4;
}): HTMLHeadingElement;
/** A paragraph (or, `inline`, a span) of text in Barynt's type. */
export declare function text(options: {
    text: string;
    tone?: "default" | "subtle" | "primary" | "success" | "warning" | "danger";
    size?: "xs" | "sm" | "base" | "lg";
    weight?: "regular" | "medium" | "semibold" | "bold";
    mono?: boolean;
    inline?: boolean;
}): HTMLElement;
/** A link out of Barynt, in a new tab. Only `http(s)` and `mailto` — any
 *  other address leaves plain text. */
export declare function link(options: {
    text: string;
    href: string;
}): HTMLElement;
/** Elements under each other, with room between. */
export declare function stack(...children: Child[]): HTMLElement;
/** Elements next to each other, wrapping. */
export declare function row(...children: Child[]): HTMLElement;
/** Columns as many as fit, each at least `minWidth` (default `12rem`). */
export declare function grid(options: {
    children: Child[];
    minWidth?: string;
}): HTMLElement;
export declare function divider(): HTMLHRElement;
/** A section with a frame: title, description, content, actions on top.
 *  `tone` colours its edge ("Changes requested"); `compact` takes less room
 *  — a sidebar's width. */
export declare function card(options: {
    title?: string;
    description?: string;
    children?: Child[];
    actions?: Child[];
    tone?: Tone;
    compact?: boolean;
}): HTMLElement;
/** A short state in colour: "New", "Failed", "3 open". */
export declare function badge(options: {
    text: string;
    tone?: Tone;
}): HTMLElement;
/** A tag in a colour — a palette name or a `#hex` — that can be removed. */
export declare function tag(options: {
    text: string;
    color?: string;
    onRemove?: () => void;
}): HTMLElement;
/** A label as Barynt shows one: its colour as a dot, its name. */
export declare function labelChip(options: {
    name: string;
    color?: string;
}): HTMLElement;
/** Initials in a circle. */
export declare function avatar(options: {
    name: string;
    color?: string;
    size?: "sm" | "md" | "lg";
}): HTMLElement;
/** A person: avatar, name, and a line about them. */
export declare function user(options: {
    name: string;
    color?: string;
    meta?: string;
}): HTMLElement;
/** A status as Barynt draws one, by its category. */
export declare function statusDot(options: {
    label: string;
    category: "backlog" | "unstarted" | "started" | "completed" | "canceled";
}): HTMLElement;
/** Shows `text` on hover and focus, and tells screen readers. */
export declare function tooltip<T extends HTMLElement>(target: T, text: string): T;
export declare function spinner(options?: {
    label?: string;
}): HTMLElement;
/** Grey bars where text will be, while it loads. */
export declare function skeleton(options?: {
    lines?: number;
}): HTMLElement;
/** Where there's nothing yet: what it is, why, what to do. */
export declare function emptyState(options: {
    title: string;
    text?: string;
    icon?: IconName;
    action?: Child;
}): HTMLElement;
/** A message in the page: information, a warning, an error. An error is
 *  announced right away (`role="alert"`). */
export declare function notice(options: {
    text: string;
    title?: string;
    tone?: Tone;
    action?: Child;
}): HTMLElement;
/** A short message in the frame's corner, gone after `duration` ms. */
export declare function toast(message: string, options?: {
    tone?: Tone;
    duration?: number;
}): void;
/** A line that says how something went — read out by screen readers. */
export interface Status {
    el: HTMLElement;
    set(text: string, tone?: StatusTone): void;
    clear(): void;
}
export type StatusTone = "info" | "success" | "warning" | "error";
export declare function status(): Status;
/** How far along, as a bar. */
export declare function progressBar(options: {
    value: number;
    max?: number;
    label?: string;
    tone?: Tone;
}): HTMLElement;
/** A number that matters, with what it is — and how it moved. */
export declare function kpi(options: {
    value: string | number;
    label: string;
    /** "+3 this week"; `good` colours it (green up, red down — your call). */
    trend?: {
        text: string;
        good?: boolean;
    };
}): HTMLElement;
export interface ListItem {
    title: string;
    /** Small text on the right: a date, a count, a name. */
    meta?: string;
    /** Makes the title a link, opened outside Barynt. */
    href?: string;
}
/** Rows of a title and a note. `empty` shows when there are none. */
export declare function list(options: {
    items: ListItem[];
    empty?: string;
}): HTMLElement;
/** Horizontal bars, one per entry, to the largest — or to `max`. A bar's
 *  `color` is a palette name, a `#hex` or a token. */
export declare function barChart(options: {
    bars: {
        label: string;
        value: number;
        color?: string;
    }[];
    max?: number;
}): HTMLElement;
/** How far along something is, as a ring with the percentage. */
export declare function progressRing(options: {
    value: number;
    max?: number;
    label?: string;
    size?: number;
}): HTMLElement;
declare const STEP_ICON: {
    readonly success: "circle-check";
    readonly danger: "circle-x";
    readonly warning: "triangle-alert";
    readonly running: "loader-circle";
    readonly pending: "circle-dashed";
};
export type StepState = keyof typeof STEP_ICON;
/** A head over a section or a card: an icon, a title, and on the right a
 *  note or a state in its tone — "Pipeline · Passed". */
export declare function sectionHeader(options: {
    title: string;
    icon?: IconName;
    meta?: string;
    status?: {
        text: string;
        tone?: Tone;
    };
}): HTMLElement;
/** A value to copy — a branch, a hash, a command — with a copy button and,
 *  with `href`, one to open it. */
export declare function copyField(options: {
    value: string;
    icon?: IconName;
    href?: string;
    /** What the buttons say to screen readers: "Copy branch". */
    label?: string;
}): HTMLElement;
/** Steps of a pipeline, a checklist, a rollout — each with its state and,
 *  on the right, how long it took. */
export declare function stepList(options: {
    steps: {
        label: string;
        state: StepState;
        meta?: string;
    }[];
}): HTMLElement;
/** Rows that lead somewhere — "1 Commit ›" — a link out, or your own
 *  `onClick` (open a dialog, show a list). */
export declare function navList(options: {
    items: {
        label: string;
        icon?: IconName;
        count?: number;
        href?: string;
        onClick?: () => void;
    }[];
}): HTMLElement;
/** Lines added and removed: "+9 −4". */
export declare function diffStat(options: {
    added: number;
    removed: number;
}): HTMLElement;
export {};
