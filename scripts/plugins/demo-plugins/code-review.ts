// Demo Code Review (BARY-207): a row across board cards, made of the parts
// the plugin picks — the way a code host would show its merge request on
// the issue it closes. The data here is made up from the issue's number, so
// the demo needs no server; a real plugin would ask its host once per batch
// (`net.fetch`).

import {
  type Badge,
  type BadgeIssue,
  Plugin,
  type RowPart,
} from "@barynt/plugin-sdk";

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

function review(issue: BadgeIssue): Badge[] {
  const n = seed(issue.ref);
  // Not every issue has a merge request.
  if (n % 3 === 0) return [];
  const state = STATES[n % STATES.length];
  const passed = state.tone === "danger" ? 1 : 3;
  const parts: RowPart[] = [
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
  ];
  const badges: Badge[] = [
    {
      badge: "review",
      kind: "row",
      tone: state.tone,
      parts,
      tooltip: `Merge request: ${state.text}`,
    },
  ];
  // Some get a second row, laid out differently: who reviews, how far.
  if (n % 4 === 1)
    badges.push({
      badge: "review",
      kind: "row",
      parts: [
        { type: "avatar", name: PEOPLE[n % PEOPLE.length] },
        { type: "text", text: PEOPLE[n % PEOPLE.length], tone: "subtle" },
        { type: "spacer" },
        { type: "text", text: "2/3 files", tone: "subtle" },
        { type: "progress", value: 2, max: 3 },
      ],
      tooltip: "Review progress",
    });
  return badges;
}

export default class CodeReview extends Plugin {
  onload() {
    this.registerBadges({
      provide: (issues) =>
        Object.fromEntries(
          issues.flatMap((issue) => {
            const badges = review(issue);
            return badges.length ? [[issue.id, badges]] : [];
          }),
        ),
    });
  }
}
