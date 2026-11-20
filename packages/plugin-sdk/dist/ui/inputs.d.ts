import { type Field, type FieldOptions, type PaletteColor } from "./core";
import type { IconName } from "./icons";
/**
 * A one-line text field. `onEnter` runs on Enter — the sandbox doesn't
 * submit forms, so this is how a field saves.
 */
export declare function textField(options: FieldOptions & {
    value?: string;
    placeholder?: string;
    type?: "text" | "url" | "email" | "number" | "password" | "search";
    onInput?: (value: string) => void;
    onEnter?: () => void;
}): Field<string>;
/** A multi-line text field. */
export declare function textArea(options: FieldOptions & {
    value?: string;
    placeholder?: string;
    rows?: number;
    onInput?: (value: string) => void;
}): Field<string>;
/** A date (`YYYY-MM-DD`), with the browser's own picker. */
export declare function dateField(options: FieldOptions & {
    value?: string;
    min?: string;
    max?: string;
    onChange?: (value: string) => void;
}): Field<string>;
export interface Option {
    value: string;
    label: string;
    /** Smaller text with it (radio buttons). */
    hint?: string;
}
/** A choice of one, as a dropdown. */
export declare function select(options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
}): Field<string>;
/** An on/off switch, with its label on the left. */
export declare function toggle(options: FieldOptions & {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}): Field<boolean>;
/** A checkbox with its label on the right — for "I agree", a list of them. */
export declare function checkbox(options: FieldOptions & {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}): Field<boolean>;
/** A choice of one, every option in view — for two to five. */
export declare function radioGroup(options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
}): Field<string>;
/** Buttons side by side, one of them chosen — a short choice that should
 *  stay in view (a view mode, a range). Arrow keys move between them. */
export declare function segmentedControl(options: FieldOptions & {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
}): Field<string>;
/** Any number of options, as chips — pressed when chosen. */
export declare function multiSelect(options: FieldOptions & {
    options: Option[];
    value?: string[];
    onChange?: (value: string[]) => void;
}): Field<string[]>;
/** One of the palette's colours — for a plugin's own labels, markers. */
export declare function swatchPicker(options: FieldOptions & {
    value?: PaletteColor;
    colors?: readonly PaletteColor[];
    onChange?: (value: PaletteColor) => void;
}): Field<PaletteColor | "">;
/**
 * A button. An `onClick` that returns a promise keeps it disabled (and
 * `aria-busy`) until it settles, so nobody saves twice. With only an `icon`
 * and no visible text, `label` is what screen readers say.
 */
export declare function button(options: {
    label: string;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md";
    icon?: IconName;
    /** Show only the icon; `label` becomes its accessible name and tooltip. */
    iconOnly?: boolean;
    onClick?: () => void | Promise<unknown>;
}): HTMLButtonElement;
