import { type Child } from "./core";
export interface Column {
    key: string;
    label: string;
    /** `end` for numbers. */
    align?: "start" | "end";
}
/** Rows under column headings. A cell is text or an element (a badge, a
 *  link, a user …); it scrolls sideways when the frame is narrow. */
export declare function table(options: {
    columns: Column[];
    rows: Record<string, Child>[];
    /** Read out before the table. */
    caption?: string;
    /** When there are no rows. */
    empty?: string;
}): HTMLElement;
/** Labels and their values, side by side — an object's details. */
export declare function keyValue(options: {
    items: {
        label: string;
        value: Child;
    }[];
}): HTMLElement;
export interface Tab {
    id: string;
    label: string;
    /** Its content — or a function, drawn the first time the tab opens. */
    content: Child | (() => Child);
}
/** Tabs. Arrow keys move between them, as screen readers expect. */
export declare function tabs(options: {
    tabs: Tab[];
    value?: string;
    /** What the tabs are about, for screen readers. */
    label?: string;
    onChange?: (id: string) => void;
}): HTMLElement;
/** Sections that open and close — for details most people don't need. */
export declare function accordion(options: {
    items: {
        title: string;
        content: Child;
        open?: boolean;
    }[];
}): HTMLElement;
