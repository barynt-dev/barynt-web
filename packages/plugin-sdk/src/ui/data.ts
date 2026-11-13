import { append, type Child, el, nextId, styled } from "./core";
import { icon } from "./display";

// The UI kit's ways to show data (BARY-206): a table, label–value pairs,
// tabs and sections that open — accessible as Barynt's own.

export interface Column {
  key: string;
  label: string;
  /** `end` for numbers. */
  align?: "start" | "end";
}

/** Rows under column headings. A cell is text or an element (a badge, a
 *  link, a user …); it scrolls sideways when the frame is narrow. */
export function table(options: {
  columns: Column[];
  rows: Record<string, Child>[];
  /** Read out before the table. */
  caption?: string;
  /** When there are no rows. */
  empty?: string;
}): HTMLElement {
  styled();
  if (options.rows.length === 0)
    return el("p", "bui-empty", options.empty ?? "Nothing here.");
  const t = el("table", "bui-table");
  if (options.caption) t.append(el("caption", undefined, options.caption));
  const head = el("tr");
  for (const c of options.columns) {
    const th = el("th", undefined, c.label);
    th.scope = "col";
    if (c.align === "end") th.dataset.align = "end";
    head.append(th);
  }
  t.append(el("thead", undefined, head));
  const body = el("tbody");
  for (const r of options.rows) {
    const tr = el("tr");
    for (const c of options.columns) {
      const td = el("td");
      append(td, [r[c.key]]);
      if (c.align === "end") td.dataset.align = "end";
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  return el("div", "bui-table-wrap", t);
}

/** Labels and their values, side by side — an object's details. */
export function keyValue(options: {
  items: { label: string; value: Child }[];
}): HTMLElement {
  styled();
  const dl = el("dl", "bui-kv");
  for (const item of options.items)
    dl.append(el("dt", undefined, item.label), el("dd", undefined, item.value));
  return dl;
}

export interface Tab {
  id: string;
  label: string;
  /** Its content — or a function, drawn the first time the tab opens. */
  content: Child | (() => Child);
}

/** Tabs. Arrow keys move between them, as screen readers expect. */
export function tabs(options: {
  tabs: Tab[];
  value?: string;
  /** What the tabs are about, for screen readers. */
  label?: string;
  onChange?: (id: string) => void;
}): HTMLElement {
  styled();
  const root = el("div", "bui-tabs");
  const listEl = el("div", "bui-tablist");
  listEl.setAttribute("role", "tablist");
  if (options.label) listEl.setAttribute("aria-label", options.label);
  const prefix = nextId();
  const drawn = new Set<string>();
  let current = options.value ?? options.tabs[0]?.id ?? "";
  const panels = new Map<string, HTMLElement>();
  const buttons = options.tabs.map((tab) => {
    const b = el("button", "bui-tab", tab.label);
    b.type = "button";
    b.id = `${prefix}-tab-${tab.id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", `${prefix}-panel-${tab.id}`);
    b.dataset.tab = tab.id;
    b.addEventListener("click", () => open(tab.id, true));
    listEl.append(b);
    const panel = el("div");
    panel.id = `${prefix}-panel-${tab.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", b.id);
    panel.tabIndex = 0;
    panels.set(tab.id, panel);
    return b;
  });
  const open = (id: string, tell: boolean) => {
    current = id;
    for (const b of buttons) {
      const on = b.dataset.tab === id;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    for (const tab of options.tabs) {
      const panel = panels.get(tab.id);
      if (!panel) continue;
      panel.hidden = tab.id !== id;
      if (tab.id === id && !drawn.has(id)) {
        drawn.add(id);
        append(panel, [
          typeof tab.content === "function" ? tab.content() : tab.content,
        ]);
      }
    }
    if (tell) options.onChange?.(id);
  };
  listEl.addEventListener("keydown", (event) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const i = buttons.findIndex((b) => b.dataset.tab === current);
    const next = buttons[(i + step + buttons.length) % buttons.length];
    open(next.dataset.tab ?? "", true);
    next.focus();
  });
  root.append(listEl, ...panels.values());
  open(current, false);
  return root;
}

/** Sections that open and close — for details most people don't need. */
export function accordion(options: {
  items: { title: string; content: Child; open?: boolean }[];
}): HTMLElement {
  styled();
  const root = el("div", "bui-accordion");
  for (const item of options.items) {
    const details = el(
      "details",
      undefined,
      el("summary", undefined, icon("chevron-right", { size: 14 }), item.title),
      el("div", "bui-accordion-body", item.content),
    );
    details.open = item.open ?? false;
    root.append(details);
  }
  return root;
}
