import { describe, expect, it } from "bun:test";
import { checkSettings, SETTING_TEXT_MAX } from "@/lib/plugins/settings";

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
