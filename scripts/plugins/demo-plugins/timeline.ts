// Demo Timeline (BARY-144, built with the SDK since BARY-146): a project's
// issues on a time line — each from when it was created to its due date (or
// when it was closed, or today). It runs in Barynt's sandbox: no network, no
// cookies; data only through `this.api`, which Barynt checks against what
// was confirmed. Plain DOM, no innerHTML with data — a plugin is a guest.

import { type Issue, Plugin } from "@barynt/plugin-sdk";
import { kpi, list } from "@barynt/plugin-sdk/ui";

const DAY = 86_400_000;

const el = (tag: string, className?: string | null, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export default class Timeline extends Plugin {
  async onload() {
    const render = async (root: HTMLElement) => {
      root.replaceChildren(el("p", "tl-muted", "Loading issues…"));
      // In a project its issues; in a workspace the newest across it.
      const { issues } = await this.api.issues.list({ take: 100 });
      this.draw(root, issues);
    };
    // The view (next to the project's own, or in the sidebar's main group
    // for the workspace) and a page of its own under "Plugins".
    this.registerProjectView({ id: "timeline", render });
    this.registerPage({ id: "roadmap", render });
    // A dashboard widget: the open issues that have waited longest.
    this.registerWidget({
      id: "oldest-open",
      render: async (root) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        this.drawOldest(root, issues);
      },
    });
  }

  drawOldest(root: HTMLElement, issues: Issue[]) {
    const open = issues
      .filter(
        (i) =>
          i.statusCategory !== "completed" && i.statusCategory !== "canceled",
      )
      .sort(
        (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
      );
    // The SDK's UI kit (BARY-204): a number and a list in Barynt's look.
    const wrap = el("div", "tl-widget");
    wrap.append(
      kpi({ value: open.length, label: "open, oldest first" }),
      list({
        items: open.slice(0, 6).map((issue) => ({
          title: `${issue.ref}  ${issue.title}`,
          meta: `${Math.floor((Date.now() - new Date(issue.created).getTime()) / DAY)} d`,
        })),
        empty: "Nothing open.",
      }),
    );
    root.replaceChildren(wrap);
  }

  draw(root: HTMLElement, issues: Issue[]) {
    const wrap = el("div", "tl");
    if (issues.length === 0) {
      wrap.append(el("p", "tl-muted", "This project has no issues yet."));
      root.replaceChildren(wrap);
      return;
    }
    const today = Date.now();
    const spans = issues
      .map((issue) => {
        const start = new Date(issue.created).getTime();
        const endAt = issue.dueDate ?? issue.closedAt;
        const end = Math.max(
          endAt ? new Date(endAt).getTime() : today,
          start + DAY,
        );
        return { issue, start, end };
      })
      .sort((a, b) => a.start - b.start);
    const from = Math.min(...spans.map((s) => s.start));
    const to = Math.max(today, ...spans.map((s) => s.end));
    const range = Math.max(to - from, DAY);
    const at = (t: number) => `${((t - from) / range) * 100}%`;
    const date = (t: number) =>
      new Date(t).toLocaleDateString(this.context.locale);

    const head = el("div", "tl-head");
    head.append(
      el("strong", null, `${issues.length} issues`),
      el("span", "tl-muted", `${date(from)} – ${date(to)}`),
    );
    wrap.append(head);

    const grid = el("div", "tl-grid");
    for (const { issue, start, end } of spans) {
      const row = el("div", "tl-row");
      const label = el("div", "tl-label");
      label.append(
        el("span", "tl-ref", issue.ref),
        el("span", null, issue.title),
      );
      const lane = el("div", "tl-lane");
      const bar = el("div", "tl-bar");
      bar.dataset.category = issue.statusCategory ?? "unstarted";
      bar.style.left = at(start);
      bar.style.width = `calc(${at(end)} - ${at(start)})`;
      bar.title = `${issue.ref} · ${issue.status}`;
      const todayMark = el("div", "tl-today");
      todayMark.style.left = at(today);
      lane.append(bar, todayMark);
      row.append(label, lane);
      grid.append(row);
    }
    wrap.append(grid);
    root.replaceChildren(wrap);
  }
}
