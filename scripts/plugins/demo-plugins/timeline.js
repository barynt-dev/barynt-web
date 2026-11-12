// Demo Timeline (BARY-144): a project's issues on a time line — each from
// when it was created to its due date (or when it was closed, or today).
// It runs in Barynt's sandbox: no network, no cookies; the only way to data
// is `host.call`, which Barynt checks against what was confirmed. Plain
// DOM, no framework, no innerHTML with data — a plugin is a guest.

const DAY = 86_400_000;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export default class Timeline {
  constructor(host) {
    this.host = host;
  }

  async onload() {
    const root = this.host.root;
    root.replaceChildren(el("p", "tl-muted", "Loading issues…"));
    const { issues } = await this.host.call("issues.list", { take: 100 });
    this.render(root, issues);
  }

  render(root, issues) {
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
    const at = (t) => `${((t - from) / range) * 100}%`;

    const head = el("div", "tl-head");
    head.append(
      el("strong", null, `${issues.length} issues`),
      el(
        "span",
        "tl-muted",
        `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`,
      ),
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
