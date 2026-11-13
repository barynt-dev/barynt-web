import { describe, expect, it } from "bun:test";
import { BLOCK_MAX_ITEMS, parseBlockData } from "@/lib/plugins/blocks";
import { parseFrameMessage } from "@/lib/plugins/bridge";

// A plugin's building block (BARY-205): whatever its frame sends, only one
// of the fixed shapes reaches the page, cut to size.

describe("parseBlockData", () => {
  it("takes the four shapes", () => {
    expect(
      parseBlockData({
        kind: "kpi",
        value: 12,
        label: "Open MRs",
        trend: { text: "+3", good: false },
      }),
    ).toEqual({
      kind: "kpi",
      value: "12",
      label: "Open MRs",
      trend: { text: "+3", good: false },
    });
    expect(
      parseBlockData({
        kind: "list",
        items: [{ title: "WEB-7", meta: "2 d", href: "https://x.example/7" }],
        empty: "None",
      }),
    ).toEqual({
      kind: "list",
      items: [{ title: "WEB-7", meta: "2 d", href: "https://x.example/7" }],
      empty: "None",
    });
    expect(
      parseBlockData({ kind: "bars", bars: [{ label: "Old", value: 3 }] }),
    ).toEqual({ kind: "bars", bars: [{ label: "Old", value: 3 }] });
    expect(parseBlockData({ kind: "progress", value: 12, max: 10 })).toEqual({
      kind: "progress",
      value: 10,
      max: 10,
    });
  });

  it("drops what could run or style the page", () => {
    const list = parseBlockData({
      kind: "list",
      items: [
        { title: "a", href: "javascript:alert(1)" },
        { title: "b", href: "data:text/html,x" },
        { nope: true },
      ],
    });
    expect(list).toEqual({
      kind: "list",
      items: [{ title: "a" }, { title: "b" }],
    });
    const bars = parseBlockData({
      kind: "bars",
      bars: [
        { label: "x", value: 1, color: "red;background:url(x)" },
        { label: "y", value: 2, color: "var(--error)" },
        { label: "z", value: Number.NaN },
      ],
    });
    expect(bars).toEqual({
      kind: "bars",
      bars: [
        { label: "x", value: 1 },
        { label: "y", value: 2, color: "var(--error)" },
      ],
    });
  });

  it("cuts texts and lists to size", () => {
    const data = parseBlockData({
      kind: "list",
      items: Array.from({ length: 50 }, () => ({ title: "t".repeat(500) })),
    });
    if (data?.kind !== "list") throw new Error("not a list");
    expect(data.items).toHaveLength(BLOCK_MAX_ITEMS);
    expect(data.items[0].title).toHaveLength(200);
  });

  it("refuses anything else", () => {
    for (const input of [
      null,
      "kpi",
      { kind: "html", html: "<b>x</b>" },
      { kind: "kpi", label: "no value" },
      { kind: "progress", value: 1, max: 0 },
      { kind: "list", items: "x" },
    ])
      expect(parseBlockData(input)).toBeNull();
  });

  it("is what a frame's blockData message carries", () => {
    expect(
      parseFrameMessage({
        type: "blockData",
        data: { kind: "kpi", value: 1, label: "x", extra: 1 },
      }),
    ).toEqual({
      type: "blockData",
      data: { kind: "kpi", value: "1", label: "x" },
    });
    expect(
      parseFrameMessage({ type: "blockData", data: { kind: "html" } }),
    ).toBeNull();
  });
});
