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
  Plugin,
  type RowPart,
} from "@barynt/plugin-sdk";
import {
  badge,
  button,
  card,
  keyValue,
  progressBar,
  row,
  stack,
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
