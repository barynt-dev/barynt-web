import { describe, expect, it } from "bun:test";
import {
  checkSettings,
  keepUnshown,
  SETTING_JSON_MAX,
  SETTING_TEXT_MAX,
} from "@/lib/plugins/settings";

// A plugin's settings form (BARY-201): only what the manifest declares is
// kept, each value checked by its type.

const specs = [
  { key: "channel", type: "text" as const },
  { key: "hour", type: "number" as const },
  { key: "mention", type: "boolean" as const },
  {
    key: "events",
    type: "select" as const,
    options: [{ id: "new" }, { id: "all" }],
  },
];

describe("checkSettings", () => {
  it("keeps the declared keys, typed", () => {
    expect(
      checkSettings(specs, {
        channel: "  #dev ",
        hour: "22",
        mention: false,
        events: "all",
        injected: "x",
      }),
    ).toEqual({
      ok: true,
      values: { channel: "#dev", hour: 22, mention: false, events: "all" },
    });
  });

  it("leaves empty text and numbers out, so the default applies", () => {
    expect(
      checkSettings(specs, { channel: "  ", hour: "", events: "" }),
    ).toEqual({ ok: true, values: {} });
  });

  it("refuses a value of the wrong type or outside a select", () => {
    expect(checkSettings(specs, { mention: "yes" })).toEqual({
      ok: false,
      key: "mention",
    });
    expect(checkSettings(specs, { events: "everything" })).toEqual({
      ok: false,
      key: "events",
    });
    expect(checkSettings(specs, { hour: "soon" })).toEqual({
      ok: false,
      key: "hour",
    });
    expect(
      checkSettings(specs, { channel: "x".repeat(SETTING_TEXT_MAX + 1) }),
    ).toEqual({ ok: false, key: "channel" });
  });
});

describe("checkSettings, the other types (BARY-204)", () => {
  const more = [
    { key: "body", type: "textarea" as const },
    { key: "link", type: "url" as const },
    {
      key: "days",
      type: "multiselect" as const,
      options: [{ id: "mon" }, { id: "tue" }],
    },
    { key: "assignee", type: "member" as const, options: [{ id: "u1" }] },
    { key: "tag", type: "label" as const, options: [{ id: "l1" }] },
    { key: "merged", type: "status" as const, options: [{ id: "done" }] },
  ];

  it("keeps them, typed", () => {
    expect(
      checkSettings(more, {
        body: " line one\nline two ",
        link: "https://wiki.acme.example/agenda",
        days: ["tue", "mon", "tue"],
        assignee: "u1",
        tag: "l1",
        merged: "done",
      }),
    ).toEqual({
      ok: true,
      values: {
        body: "line one\nline two",
        link: "https://wiki.acme.example/agenda",
        days: ["tue", "mon"],
        assignee: "u1",
        tag: "l1",
        merged: "done",
      },
    });
  });

  it("lets a multi-line text be longer than a line", () => {
    const long = "x".repeat(SETTING_TEXT_MAX + 1);
    expect(checkSettings(more, { body: long }).ok).toBe(true);
    expect(checkSettings(specs, { channel: long })).toEqual({
      ok: false,
      key: "channel",
    });
  });

  it("leaves empty ones out", () => {
    expect(
      checkSettings(more, {
        link: " ",
        days: [],
        assignee: "",
        tag: "",
        merged: "",
      }),
    ).toEqual({ ok: true, values: {} });
  });

  it("refuses what isn't an address, an option, a member, a label or a status", () => {
    for (const [key, value] of [
      ["link", "javascript:alert(1)"],
      ["link", "not a url"],
      ["days", "mon"],
      ["days", ["mon", "sun"]],
      ["assignee", "u2"],
      ["tag", "l2"],
      ["merged", "in_review"],
    ] as const)
      expect(checkSettings(more, { [key]: value })).toEqual({
        ok: false,
        key,
      });
  });

  it("takes no member or label without the place's options", () => {
    expect(
      checkSettings([{ key: "assignee", type: "member" }], { assignee: "u1" }),
    ).toEqual({ ok: false, key: "assignee" });
  });
});

describe("a json setting, the plugin's own (BARY-238)", () => {
  const own = [
    { key: "channel", type: "text" as const },
    { key: "deployments", type: "json" as const },
  ];

  it("keeps an object, refuses anything else or too much", () => {
    expect(
      checkSettings(own, { deployments: { auto: false, stages: [] } }),
    ).toEqual({
      ok: true,
      values: { deployments: { auto: false, stages: [] } },
    });
    expect(checkSettings(own, { deployments: [1] }).ok).toBe(false);
    expect(checkSettings(own, { deployments: "x" }).ok).toBe(false);
    expect(
      checkSettings(own, { deployments: { x: "y".repeat(SETTING_JSON_MAX) } })
        .ok,
    ).toBe(false);
  });

  it("stays when Barynt's form saves without it", () => {
    expect(
      keepUnshown(
        own,
        { channel: "old", deployments: { auto: false } },
        { channel: "new" },
      ),
    ).toEqual({ channel: "new", deployments: { auto: false } });
    expect(keepUnshown(own, null, { channel: "new" })).toEqual({
      channel: "new",
    });
  });
});
