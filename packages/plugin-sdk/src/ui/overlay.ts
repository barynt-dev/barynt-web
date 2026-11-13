import { append, type Child, el, nextId, styled } from "./core";
import { button } from "./inputs";

// The UI kit's overlays (BARY-206). A dialog inside the plugin's frame —
// the sandbox blocks `alert()` and `confirm()`, so `confirm` is here too.

export interface Dialog {
  el: HTMLDialogElement;
  open(): void;
  close(): void;
}

/** A dialog over the frame, with a title, content and buttons. Escape and
 *  the ✕ close it; focus stays inside while it's open. */
export function dialog(options: {
  title: string;
  content?: Child[];
  actions?: Child[];
  onClose?: () => void;
}): Dialog {
  styled();
  const id = nextId();
  const node = el("dialog", "bui-dialog");
  node.setAttribute("aria-labelledby", id);
  const title = el("h2", "bui-dialog-title", options.title);
  title.id = id;
  const close = button({
    label: "Close",
    variant: "ghost",
    size: "sm",
    icon: "x",
    iconOnly: true,
    onClick: () => node.close(),
  });
  node.append(el("div", "bui-dialog-head", title, close));
  const body = el("div", "bui-dialog-body");
  append(body, options.content ?? []);
  node.append(body);
  if (options.actions?.length)
    node.append(el("div", "bui-dialog-foot", ...options.actions));
  node.addEventListener("close", () => {
    options.onClose?.();
    node.remove();
  });
  return {
    el: node,
    open() {
      if (!node.isConnected) document.body.append(node);
      node.showModal();
    },
    close: () => node.close(),
  };
}

/** Asks before something that can't be undone. Resolves `true` on the
 *  confirming button, `false` on cancel, Escape or ✕. */
export function confirm(options: {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** A red button: deleting, removing. */
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const d = dialog({
      title: options.title,
      content: options.text ? [options.text] : [],
      actions: [
        button({
          label: options.cancelLabel ?? "Cancel",
          variant: "secondary",
          onClick: () => d.close(),
        }),
        button({
          label: options.confirmLabel ?? "OK",
          variant: options.danger ? "danger" : "primary",
          onClick: () => {
            answer = true;
            d.close();
          },
        }),
      ],
      onClose: () => resolve(answer),
    });
    d.open();
  });
}
