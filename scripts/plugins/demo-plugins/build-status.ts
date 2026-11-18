// Demo Build Status (BARY-225): its server keeps a build's state on the
// issue (`issueData.set`), its badge and panel read it back here. When the
// server writes, Barynt has the board ask this badge again for that card and
// an open issue reload this panel — no page refresh.

import { type Badge, Plugin } from "@barynt/plugin-sdk";
import { badge, card, keyValue } from "@barynt/plugin-sdk/ui";

interface Build {
  state: "running" | "passed";
  number: number;
  at: string;
}

const LOOK = {
  running: { text: "Build running", icon: "clock", tone: "warning" },
  passed: { text: "Build passed", icon: "circle-check", tone: "success" },
} as const;

export default class BuildStatus extends Plugin {
  async builds(issueIds: string[]): Promise<Record<string, Build>> {
    const data = await this.api.issueData.list(issueIds);
    const out: Record<string, Build> = {};
    for (const [id, entries] of Object.entries(data)) {
      const build = entries.find((e) => e.key === "build")?.value;
      if (build) out[id] = build as unknown as Build;
    }
    return out;
  }

  onload() {
    this.registerBadges({
      provide: async (issues) => {
        const builds = await this.builds(issues.map((i) => i.id));
        return Object.fromEntries(
          Object.entries(builds).map(([id, b]): [string, Badge[]] => [
            id,
            [
              {
                badge: "build",
                ...LOOK[b.state],
                tooltip: `Build #${b.number}`,
              },
            ],
          ]),
        );
      },
    });
    this.registerIssuePanel({
      id: "build",
      render: async (el, { issueId }) => {
        if (!issueId) return;
        const b = (await this.builds([issueId]))[issueId];
        const look = b ? LOOK[b.state] : null;
        const panel = card({
          title: b ? `Build #${b.number}` : "No build yet",
          description: b
            ? undefined
            : "Move the issue to another status to start one.",
          actions: look ? [badge({ text: look.text, tone: look.tone })] : [],
          children: b
            ? [
                keyValue({
                  items: [
                    { label: "State", value: look?.text ?? "" },
                    {
                      label: "Updated",
                      value: new Date(b.at).toLocaleTimeString(),
                    },
                  ],
                }),
              ]
            : [],
        });
        panel.style.margin = "0.75rem";
        el.replaceChildren(panel);
      },
    });
  }
}
