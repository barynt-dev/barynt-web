/** Puts the kit's styles into the frame once. */
export declare function styled(): void;
/** What a component takes as content: elements, or text — never HTML. */
export type Child = Node | string | number | false | null | undefined;
/** Appends children, strings as text. */
export declare function append(parent: Node, children: readonly Child[]): void;
export declare function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, ...children: Child[]): HTMLElementTagNameMap[K];
/** An id for a label's `for`, an `aria-describedby` … */
export declare const nextId: () => string;
/** A link Barynt lets out: `http(s)` or `mailto` — never `javascript:`. */
export declare function safeHref(href: string): string | null;
/** The palette's names — what `color` options take besides a `#hex`. */
export declare const PALETTE: readonly ["blue", "teal", "green", "lime", "amber", "orange", "red", "purple", "indigo"];
export type PaletteColor = (typeof PALETTE)[number];
/** A colour as CSS: a palette name as its token, a `#hex` as it is — or
 *  `null` for anything else, so nothing but a colour gets into a style. */
export declare function safeColor(color: string | undefined): string | null;
/** How a component says what it's about. */
export type Tone = "neutral" | "primary" | "info" | "success" | "warning" | "danger";
/** An input with its element and its value. */
export interface Field<T> {
    /** Put this where the field goes. */
    el: HTMLElement;
    value: T;
    /** Grey it out while something runs. */
    disabled: boolean;
    focus(): void;
}
export interface FieldOptions {
    label: string;
    /** Smaller text below the field. */
    hint?: string;
}
/** Label, control and hint, stacked — the label tied to the control. */
export declare function fieldShell(options: FieldOptions, control: HTMLElement, id?: string): HTMLElement;
/** A hint under a group, tied to `control` for screen readers. */
export declare function describe(wrap: HTMLElement, control: HTMLElement, id: string, hint: string | undefined): void;
