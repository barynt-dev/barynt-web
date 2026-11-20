import { type Child } from "./core";
export interface Dialog {
    el: HTMLDialogElement;
    open(): void;
    close(): void;
}
/** A dialog over the frame, with a title, content and buttons. Escape and
 *  the ✕ close it; focus stays inside while it's open. */
export declare function dialog(options: {
    title: string;
    content?: Child[];
    actions?: Child[];
    onClose?: () => void;
}): Dialog;
/** Asks before something that can't be undone. Resolves `true` on the
 *  confirming button, `false` on cancel, Escape or ✕. */
export declare function confirm(options: {
    title: string;
    text?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** A red button: deleting, removing. */
    danger?: boolean;
}): Promise<boolean>;
