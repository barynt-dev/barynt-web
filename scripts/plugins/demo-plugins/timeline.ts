// Demo Timeline (BARY-144, built with the SDK since BARY-146): a project's
// issues on a time line — each from when it was created to its due date (or
// when it was closed, or today). It runs in Barynt's sandbox: no network, no
// cookies; data only through `this.api`, which Barynt checks against what
// was confirmed. Plain DOM, no innerHTML with data — a plugin is a guest.

import { type Badge, type Issue, Plugin } from "@barynt/plugin-sdk";
import {
  badge,
  keyValue,
  kpi,
  list,
  progressBar,
  progressRing,
  stack,
  text,
} from "@barynt/plugin-sdk/ui";

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

    // A panel in every issue (BARY-150): how long it's been open, and how
    // far it is to its due date — drawn with the UI kit, as tall as it is.
    this.registerIssuePanel({
      id: "schedule",
      render: async (root, { issueId }) => {
        if (!issueId) return;
        const issue = await this.api.issues.get(issueId);
        root.replaceChildren(this.drawSchedule(issue));
      },
    });

    // Badges on the board's cards and the list's rows (BARY-151): Barynt
    // hands over the issues it shows; the chips go back, Barynt draws them.
    this.registerBadges({
      provide: (issues) => {
        const now = Date.now();
        const out: Record<string, Badge[]> = {};
        for (const issue of issues) {
          const chips: Badge[] = [];
          if (issue.dueDate) {
            const left = Math.round(
              (new Date(issue.dueDate).getTime() - now) / DAY,
            );
            chips.push({
              badge: "due",
              icon: "calendar",
              text:
                left < 0
                  ? `${-left}d late`
                  : left === 0
                    ? "today"
                    : `in ${left}d`,
              tone: left < 0 ? "danger" : left <= 2 ? "warning" : "neutral",
              tooltip: `Due ${new Date(issue.dueDate).toLocaleDateString()}`,
            });
          }
          if (issue.created) {
            const age = Math.floor(
              (now - new Date(issue.created).getTime()) / DAY,
            );
            if (age >= 7)
              chips.push({
                badge: "age",
                icon: "clock",
                text: `${age}d`,
                tone: age >= 14 ? "warning" : "neutral",
                tooltip: `Created ${age} days ago`,
              });
          }
          if (chips.length) out[issue.id] = chips;
        }
        return out;
      },
    });

    // Building blocks for custom widgets (BARY-205). Barynt draws what
    // `data` returns, like its own blocks…
    const isOpen = (i: Issue) =>
      i.statusCategory !== "completed" && i.statusCategory !== "canceled";
    const daysSince = (date: string) =>
      Math.floor((Date.now() - new Date(date).getTime()) / DAY);
    this.registerBlock({
      id: "due-soon",
      data: async ({ config }) => {
        const days = Number(config?.days ?? 7);
        const { issues } = await this.api.issues.list({ take: 100 });
        const soon = issues
          .filter((i) => isOpen(i) && i.dueDate)
          .map((i) => ({ issue: i, left: -daysSince(i.dueDate as string) }))
          .filter((x) => x.left <= days)
          .sort((a, b) => a.left - b.left);
        return {
          kind: "list",
          items: soon.slice(0, 5).map(({ issue, left }) => ({
            title: `${issue.ref}  ${issue.title}`,
            meta:
              left < 0
                ? `${-left} d late`
                : left === 0
                  ? "today"
                  : `in ${left} d`,
          })),
          empty: `Nothing due in the next ${days} days.`,
        };
      },
    });
    this.registerBlock({
      id: "by-age",
      data: async () => {
        const { issues } = await this.api.issues.list({ take: 100 });
        const ages = issues.filter(isOpen).map((i) => daysSince(i.created));
        const count = (from: number, to: number) =>
          ages.filter((a) => a >= from && a < to).length;
        return {
          kind: "bars",
          bars: [
            { label: "Under a week", value: count(0, 7) },
            { label: "1–2 weeks", value: count(7, 14) },
            {
              label: "2–4 weeks",
              value: count(14, 28),
              color: "var(--warning)",
            },
            {
              label: "Older",
              value: count(28, Infinity),
              color: "var(--error)",
            },
          ],
        };
      },
    });
    // …and this one it draws itself, with the SDK's UI kit.
    this.registerBlock({
      id: "done-ring",
      render: async (root) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        const done = issues.filter((i) => i.statusCategory === "completed");
        const wrap = el("div", "tl-ring");
        wrap.append(
          progressRing({
            value: done.length,
            max: Math.max(1, issues.length),
            label: `${done.length} of ${issues.length} done`,
          }),
        );
        root.replaceChildren(wrap);
      },
    });
  }

  drawSchedule(issue: Issue): HTMLElement {
    const day = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      });
    const created = new Date(issue.created).getTime();
    const done = issue.closedAt ? new Date(issue.closedAt).getTime() : null;
    const open = Math.max(
      0,
      Math.round(((done ?? Date.now()) - created) / DAY),
    );
    const items: { label: string; value: string | HTMLElement }[] = [
      { label: "Created", value: day(issue.created) },
      {
        label: done ? "Closed after" : "Open for",
        value: `${open} ${open === 1 ? "day" : "days"}`,
      },
    ];
    const parts: HTMLElement[] = [];
    if (issue.dueDate) {
      const due = new Date(issue.dueDate).getTime();
      const left = Math.round((due - Date.now()) / DAY);
      items.push({
        label: "Due",
        value: badge({
          text:
            done !== null
              ? day(issue.dueDate)
              : left < 0
                ? `${-left} d late`
                : left === 0
                  ? "today"
                  : `in ${left} d`,
          tone:
            done !== null
              ? "success"
              : left < 0
                ? "danger"
                : left <= 2
                  ? "warning"
                  : "neutral",
        }),
      });
      parts.push(
        progressBar({
          value: Math.min(Date.now(), due) - created,
          max: Math.max(1, due - created),
          label: "Time to the due date",
          tone: left < 0 && done === null ? "danger" : "primary",
        }),
      );
    } else
      parts.push(
        text({
          text: "No due date — set one to see how close it is.",
          tone: "subtle",
        }),
      );
    const box = stack(keyValue({ items }), ...parts);
    box.classList.add("tl-panel");
    return box;
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
