import { describe, expect, it } from "bun:test";
import { isCardFieldEntry } from "@/features/issues/card-fields";
import {
  BADGES_PER_ISSUE,
  parseBadges,
  pluginBadgeEntry,
} from "@/lib/plugins/badges";
import { parseFrameMessage } from "@/lib/plugins/bridge";

// Plugins' badges on cards and rows (BARY-151): whatever a plugin's frame
// answers, only chips Barynt can draw reach a card.

const asked = new Set(["i1", "i2"]);
const declared = new Set(["due", "age"]);

describe("parseBadges", () => {
  it("keeps chips of declared badges for issues it was asked about", () => {
    expect(
      parseBadges(
        {
          i1: [
            {
              badge: "due",
              text: "in 3d",
              icon: "calendar",
              tone: "warning",
              tooltip: "Due Friday",
            },
          ],
          i9: [{ badge: "due", text: "nobody asked" }],
        },
        asked,
        declared,
      ),
    ).toEqual({
      i1: [
        {
          badge: "due",
          text: "in 3d",
          icon: "calendar",
          tone: "warning",
          tooltip: "Due Friday",
        },
      ],
    });
  });

  it("drops what it can't draw, cuts what's too long", () => {
    const out = parseBadges(
      {
        i1: [
          { badge: "other", text: "undeclared" },
          { badge: "due", text: "" },
          {
            badge: "age",
            text: "x".repeat(80),
            icon: "skull",
            tone: "rainbow",
            tooltip: "y".repeat(500),
          },
        ],
        i2: Array.from({ length: 10 }, () => ({ badge: "age", text: "a" })),
      },
      asked,
      declared,
    );
    expect(out.i1).toEqual([
      { badge: "age", text: "x".repeat(24), tooltip: "y".repeat(120) },
    ]);
    expect(out.i2).toHaveLength(BADGES_PER_ISSUE);
  });

  it("shows nothing for an answer that isn't one", () => {
    for (const input of [null, "x", [1, 2], { i1: "due" }])
      expect(parseBadges(input, asked, declared)).toEqual({});
  });

  it("comes back with its request's number", () => {
    expect(
      parseFrameMessage({ type: "badges", seq: 1001, badges: { i1: [] } }),
    ).toEqual({ type: "badges", seq: 1001, badges: { i1: [] } });
    expect(parseFrameMessage({ type: "badges", seq: "x" })).toBeNull();
  });

  it("hides a badge in Display as pb:<plugin>:<badge>", () => {
    expect(pluginBadgeEntry("demo-timeline", "due")).toBe(
      "pb:demo-timeline:due",
    );
    expect(isCardFieldEntry("pb:demo-timeline:due")).toBe(true);
    expect(isCardFieldEntry("pb:../x:due")).toBe(false);
    expect(isCardFieldEntry("pb:")).toBe(false);
  });
});

describe("rows across the card (BARY-207)", () => {
  const row = (parts: unknown[], more: object = {}) => ({
    badge: "due",
    kind: "row",
    parts,
    ...more,
  });

  it("keeps the parts the plugin chose, in its order", () => {
    const out = parseBadges(
      {
        i1: [
          row(
            [
              { type: "icon", icon: "git-pull-request", tone: "success" },
              { type: "text", text: "#410", mono: true, tone: "subtle" },
              {
                type: "text",
                text: "Changes requested",
                tone: "warning",
                strong: true,
              },
              { type: "spacer" },
              { type: "steps", steps: ["success", "success", "running"] },
              { type: "status", status: "success" },
            ],
            { tone: "warning" },
          ),
        ],
      },
      asked,
      declared,
    );
    expect(out.i1[0]).toMatchObject({
      kind: "row",
      tone: "warning",
      // No summary given: its texts.
      text: "#410 Changes requested",
      parts: [
        { type: "icon", icon: "git-pull-request", tone: "success" },
        { type: "text", text: "#410", mono: true, tone: "subtle" },
        {
          type: "text",
          text: "Changes requested",
          tone: "warning",
          strong: true,
        },
        { type: "spacer" },
        { type: "steps", steps: ["success", "success", "running"] },
        { type: "status", status: "success" },
      ],
    });
  });

  it("drops parts it can't draw, and a row with none", () => {
    const out = parseBadges(
      {
        i1: [
          row([
            { type: "html", html: "<b>x</b>" },
            { type: "icon", icon: "skull" },
            { type: "steps", steps: ["success", "exploded"] },
            { type: "progress", value: 9, max: 3 },
            { type: "avatar", name: "<img src=x>" },
          ]),
          row([{ type: "html" }]),
        ],
      },
      asked,
      declared,
    );
    expect(out.i1).toHaveLength(1);
    expect(out.i1[0].parts).toEqual([
      { type: "steps", steps: ["success"] },
      { type: "progress", value: 3, max: 3 },
      { type: "avatar", name: "<img src=x>" },
    ]);
  });

  it("takes 2 rows and 3 chips per issue, side by side", () => {
    const out = parseBadges(
      {
        i1: [
          ...Array.from({ length: 4 }, () =>
            row([{ type: "text", text: "r" }]),
          ),
          ...Array.from({ length: 5 }, () => ({ badge: "age", text: "c" })),
        ],
      },
      asked,
      declared,
    );
    expect(out.i1.filter((b) => b.kind === "row")).toHaveLength(2);
    expect(out.i1.filter((b) => b.kind !== "row")).toHaveLength(3);
  });
});
