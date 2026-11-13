// Demo Code Review (BARY-207, BARY-208): rows across board cards, built two
// ways — from Barynt's ready-made building blocks (a merge request: number,
// state, pipeline) and freely laid out (a deployment over two lines: groups,
// an image drawn on a canvas, a sparkline, a person, a link). A click on the
// merge request opens the issue at this plugin's panel, where it draws with
// the UI kit. The data is made up from the issue's number, so the demo
// needs no server; a real plugin would ask its host once per batch.

import {
  type Badge,
  type BadgeIssue,
  type Issue,
  Plugin,
  type RowPart,
} from "@barynt/plugin-sdk";
import {
  avatar,
  badge,
  button,
  card,
  copyField,
  diffStat,
  keyValue,
  link,
  navList,
  progressBar,
  row,
  sectionHeader,
  stack,
  stepList,
  text,
  toast,
  user,
} from "@barynt/plugin-sdk/ui";

const STATES = [
  { text: "Changes requested", tone: "warning", status: "warning" },
  { text: "Approved", tone: "success", status: "success" },
  { text: "In review", tone: "primary", status: "pending" },
  { text: "Pipeline failed", tone: "danger", status: "danger" },
] as const;

const PEOPLE = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "Linus Torvalds",
];

/** A row with its ends apart — the pipeline's number left, "Logs" right. */
function apart(...children: HTMLElement[]): HTMLElement {
  const node = row(...children);
  node.style.justifyContent = "space-between";
  return node;
}

/** A stable number from a reference, so a card shows the same every time. */
const seed = (ref: string) =>
  [...ref].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A tiny bar chart drawn on a canvas — any image a plugin can draw goes
 *  on the card this way (`toDataURL`, no SVG). */
function chart(n: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 24;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  for (let i = 0; i < 6; i++) {
    const h = 6 + ((n >> i) % 16);
    ctx.fillStyle = i === 5 ? "#5ab98a" : "#3b7bd5";
    ctx.fillRect(i * 8 + 1, 24 - h, 6, h);
  }
  return canvas.toDataURL("image/png");
}

/** A merge request — Barynt's building blocks, in the plugin's order. */
function mergeRequest(n: number): Badge {
  const state = STATES[n % STATES.length];
  const passed = state.tone === "danger" ? 1 : 3;
  return {
    badge: "review",
    kind: "row",
    tone: state.tone,
    // A click opens the issue at the "Merge request" panel.
    panel: "review",
    tooltip: `Merge request: ${state.text}`,
    parts: [
      { type: "icon", icon: "git-pull-request", tone: "success" },
      { type: "text", text: `#${400 + (n % 90)}`, mono: true, tone: "subtle" },
      { type: "text", text: state.text, tone: state.tone, strong: true },
      { type: "spacer" },
      {
        type: "steps",
        steps: [0, 1, 2].map((i) =>
          i < passed ? "success" : i === passed ? "danger" : "pending",
        ),
      },
      { type: "status", status: state.status },
    ],
  };
}

/** A deployment — laid out freely, over two lines. */
function deployment(n: number): Badge {
  const who = PEOPLE[n % PEOPLE.length];
  const parts: RowPart[] = [
    {
      type: "group",
      direction: "column",
      gap: 0,
      grow: true,
      children: [
        { type: "text", text: "Deploy to staging", strong: true },
        {
          type: "text",
          text: `build ${1800 + (n % 99)} · ${2 + (n % 7)} min`,
          size: "xs",
          tone: "subtle",
          mono: true,
        },
      ],
    },
    {
      type: "image",
      src: chart(n),
      alt: "Build times",
      width: 48,
      height: 24,
    },
    {
      type: "sparkline",
      values: [5, 7, 6, 9, 8, 11, 10].map((v, i) => v + ((n >> i) % 3)),
      tone: "success",
    },
    { type: "break" },
    { type: "avatar", name: who },
    { type: "text", text: who.split(" ")[0], tone: "subtle", size: "xs" },
    { type: "label", name: "staging", color: "teal" },
    {
      type: "date",
      date: new Date(Date.now() - (n % 5) * 3_600_000).toISOString(),
    },
    { type: "spacer" },
    { type: "link", text: "Logs", href: "https://ci.example.com/builds" },
  ];
  return {
    badge: "deploy",
    kind: "row",
    text: "Deploy to staging",
    tooltip: "Deployment",
    parts,
  };
}

function rowsFor(issue: BadgeIssue): Badge[] {
  const n = seed(issue.id);
  if (n % 3 === 0) return [];
  const badges = [mergeRequest(n)];
  if (n % 4 === 1) badges.push(deployment(n));
  return badges;
}

export default class CodeReview extends Plugin {
  /** The "Development" section: built from the UI kit, the branch taken
   *  from a "Branch" custom field when the project has one. */
  development(issue: Issue): HTMLElement {
    const n = seed(issue.id);
    const state = STATES[n % STATES.length];
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    const field = issue.customFields?.branch;
    const branch =
      typeof field === "string" && field
        ? field
        : `${(issue.assignee?.name ?? "dev").split(" ")[0].toLowerCase()}/${issue.ref.toLowerCase()}-${slug}`;
    const failed = state.tone === "danger";
    const box = stack(
      copyField({
        value: branch,
        icon: "git-branch",
        href: "https://gitlab.com/acme/web/-/tree/main",
        label: "Copy branch",
      }),
      card({
        compact: true,
        tone: state.tone,
        children: [
          sectionHeader({
            title: `#${400 + (n % 90)}`,
            icon: "git-pull-request",
            status: { text: state.text, tone: state.tone },
          }),
          text({ text: `fix: ${issue.title}`, size: "base" }),
          row(
            diffStat({ added: 9 + (n % 40), removed: 4 + (n % 9) }),
            text({ text: "1d ago", tone: "subtle", inline: true }),
            avatar({ name: issue.assignee?.name ?? "Ada Rahman", size: "sm" }),
          ),
        ],
      }),
      card({
        compact: true,
        children: [
          sectionHeader({
            title: "Pipeline",
            icon: failed ? "circle-x" : "circle-check",
            status: failed
              ? { text: "Failed", tone: "danger" }
              : { text: "Passed", tone: "success" },
          }),
          stepList({
            steps: [
              { label: "Build", state: "success", meta: "1m 12s" },
              {
                label: "Test",
                state: failed ? "danger" : "success",
                meta: "3m 40s",
              },
              {
                label: "Deploy",
                state: failed ? "pending" : "success",
                meta: failed ? "–" : "58s",
              },
            ],
          }),
          apart(
            text({
              text: `#${2200 + (n % 90)} · 5m 50s`,
              mono: true,
              tone: "subtle",
              inline: true,
            }),
            link({ text: "Logs", href: "https://ci.example.com/pipelines" }),
          ),
        ],
      }),
      navList({
        items: [
          {
            icon: "git-commit-horizontal",
            count: 1,
            label: "Commit",
            onClick: () => toast("feat: lighter muted token"),
          },
          {
            icon: "git-pull-request",
            count: 1,
            label: "Merge request",
            href: "https://gitlab.com/acme/web/-/merge_requests",
          },
          {
            icon: "rocket",
            count: 1,
            label: "Deployments",
            href: "https://ci.example.com/deployments",
          },
        ],
      }),
    );
    box.style.gap = "0.625rem";
    return box;
  }

  onload() {
    this.registerBadges({
      provide: (issues) =>
        Object.fromEntries(
          issues.flatMap((issue) => {
            const badges = rowsFor(issue);
            return badges.length ? [[issue.id, badges]] : [];
          }),
        ),
    });
    // A section in the issue's sidebar (BARY-209), next to its fields:
    // the branch, the merge request, the pipeline, where it all went.
    this.registerIssuePanel({
      id: "development",
      render: async (el, { issueId }) => {
        if (!issueId) return;
        const issue = await this.api.issues.get(issueId);
        el.replaceChildren(this.development(issue));
      },
    });

    // Where a row's click leads: the plugin's own panel in the issue —
    // drawn freely, here with the UI kit.
    this.registerIssuePanel({
      id: "review",
      render: (el, { issueId }) => {
        const n = seed(issueId ?? "");
        const state = STATES[n % STATES.length];
        const panel = stack(
          card({
            title: `Merge request #${400 + (n % 90)}`,
            description: "feature/empty-states → main",
            actions: [badge({ text: state.text, tone: state.tone })],
            children: [
              keyValue({
                items: [
                  {
                    label: "Author",
                    value: user({ name: PEOPLE[n % PEOPLE.length] }),
                  },
                  { label: "Reviewers", value: "2 of 3 approved" },
                  { label: "Changes", value: "+182 −47 in 9 files" },
                ],
              }),
              progressBar({ value: 2, max: 3, label: "Review" }),
              row(
                button({
                  label: "Open in GitLab",
                  variant: "primary",
                  icon: "external-link",
                }),
                button({ label: "Re-run pipeline", icon: "refresh-cw" }),
              ),
            ],
          }),
        );
        panel.style.padding = "0.75rem";
        el.replaceChildren(panel);
      },
    });
  }
}
