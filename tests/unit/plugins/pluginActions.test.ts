import { describe, expect, it } from "bun:test";
import { parseFrameMessage } from "@/lib/plugins/bridge";
import { validateManifest } from "@/lib/plugins/manifest";
import { actionIcon, parseActionResult } from "@/lib/plugins/plugin-actions";

// Plugins' actions (BARY-152): what an action's answer may be, where it
// may show, how the frame reports it.

describe("an action's answer", () => {
  it("keeps a message, a tone, refresh and a panel", () => {
    expect(
      parseActionResult({
        message: "  Pipeline #2290 started ",
        tone: "success",
        refresh: true,
        openPanel: "review",
        html: "<b>x</b>",
      }),
    ).toEqual({
      message: "Pipeline #2290 started",
      tone: "success",
      refresh: true,
      openPanel: "review",
    });
  });

  it("drops what it can't use", () => {
    expect(
      parseActionResult({
        message: "x".repeat(500),
        tone: "rainbow",
        refresh: "yes",
        openPanel: "../x",
      }),
    ).toEqual({ message: "x".repeat(120) });
    for (const input of [null, "done", [1], 42])
      expect(parseActionResult(input)).toEqual({});
  });

  it("comes back with its run's number", () => {
    expect(
      parseFrameMessage({
        type: "actionDone",
        seq: 7,
        ok: true,
        result: { message: "ok" },
      }),
    ).toEqual({
      type: "actionDone",
      seq: 7,
      ok: true,
      result: { message: "ok" },
    });
    expect(
      parseFrameMessage({
        type: "actionDone",
        seq: 7,
        ok: false,
        result: "e".repeat(900),
      }),
    ).toEqual({
      type: "actionDone",
      seq: 7,
      ok: false,
      result: "e".repeat(300),
    });
    expect(parseFrameMessage({ type: "actionDone", seq: "7" })).toBeNull();
  });

  it("shows only icons Barynt has", () => {
    expect(actionIcon("lucide:rocket")).toBe("lucide:rocket");
    expect(actionIcon("lucide:skull")).toBeNull();
    expect(actionIcon("mdi:rocket")).toBeNull();
    expect(actionIcon(undefined)).toBeNull();
  });
});

describe("actions in the manifest", () => {
  const manifest = (actions: unknown[]) =>
    validateManifest({
      id: "acme-ci",
      name: "Acme CI",
      version: "1.0.0",
      minBaryntVersion: "0.1.0",
      author: "Acme",
      description: "CI.",
      license: "MIT",
      kind: "sandbox",
      levels: ["project"],
      capabilities: ["ui:action"],
      network: [],
      contributes: { actions },
    });

  it("say where they show and what to ask first", () => {
    expect(
      manifest([
        {
          id: "close",
          title: "Close merge request",
          where: ["issueMenu", "cardMenu"],
          confirm: "It's closed in GitLab.",
          danger: true,
        },
      ]).ok,
    ).toBe(true);
    expect(manifest([{ id: "x", title: "X", where: ["toolbar"] }]).ok).toBe(
      false,
    );
    expect(manifest([{ id: "x", title: "X", where: [] }]).ok).toBe(false);
  });
});
