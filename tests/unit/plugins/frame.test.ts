import { describe, expect, it } from "bun:test";
import {
  BRIDGE_METHODS,
  isBridgeMethod,
  parseFrameMessage,
} from "@/lib/plugins/bridge";
import { buildFrameDocument, frameCsp } from "@/lib/plugins/frame";
import { CAPABILITIES } from "@/lib/plugins/manifest";

// The sandbox's document and the bridge's protocol (BARY-144).

describe("buildFrameDocument", () => {
  const doc = (code: string, css: string | null = null) =>
    buildFrameDocument({ code, css, nonce: "abc", title: "Timeline" });

  it("carries the plugin's code as data, never as markup", () => {
    const html = doc(
      "export default class {} // </script><script>alert(1)</script>",
    );
    // Exactly the two script elements the document has itself.
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>");
  });

  it("keeps a plugin's styles inside their element", () => {
    const html = doc("", ".a{} </style><script>x</script>");
    // The base styles' element and the plugin's — the plugin's text can't
    // end its own early.
    expect(html.match(/<\/style>/g)).toHaveLength(2);
  });

  it("runs only its own runtime, by nonce", () => {
    expect(doc("")).toContain('<script nonce="abc">');
  });
});

describe("frameCsp", () => {
  const csp = frameCsp("abc");

  it("is a sandbox with scripts and new tabs, nothing else", () => {
    expect(csp).toContain(
      "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox;",
    );
    // Never Barynt's origin, never a form, never the page around it.
    for (const flag of [
      "allow-same-origin",
      "allow-forms",
      "allow-top-navigation",
      "allow-modals",
    ])
      expect(csp).not.toContain(flag);
  });

  it("gives the plugin no network", () => {
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-abc' blob:");
  });
});

describe("bridge protocol", () => {
  it("knows only its own methods", () => {
    expect(isBridgeMethod("issues.list")).toBe(true);
    expect(isBridgeMethod("toString")).toBe(false);
    expect(isBridgeMethod("db.query")).toBe(false);
  });

  it("asks for a capability that exists for every method", () => {
    for (const capability of Object.values(BRIDGE_METHODS))
      if (capability !== null) expect(CAPABILITIES).toContain(capability);
  });

  it("drops what isn't a message of the protocol", () => {
    expect(parseFrameMessage(null)).toBeNull();
    expect(
      parseFrameMessage({ type: "call", id: "1", method: "x" }),
    ).toBeNull();
    expect(parseFrameMessage({ type: "eval" })).toBeNull();
    expect(
      parseFrameMessage({ type: "call", id: 3, method: "issues.list" }),
    ).toEqual({ type: "call", id: 3, method: "issues.list", params: {} });
    expect(
      parseFrameMessage({ type: "error", message: "x".repeat(900) }),
    ).toEqual({ type: "error", message: "x".repeat(500) });
  });

  it("opens its own settings on a level it names, no other (BARY-238)", () => {
    expect(
      parseFrameMessage({ type: "openSettings", level: "project" }),
    ).toEqual({ type: "openSettings", level: "project" });
    expect(
      parseFrameMessage({ type: "openSettings", level: "/admin" }),
    ).toBeNull();
  });

  it("opens a window with a view of its own, and closes it (BARY-238)", () => {
    expect(
      parseFrameMessage({
        type: "openModal",
        view: "deployment",
        title: "  staging ",
        data: { environment: "staging" },
      }),
    ).toEqual({
      type: "openModal",
      view: "deployment",
      title: "staging",
      data: { environment: "staging" },
      size: "md",
    });
    expect(
      parseFrameMessage({
        type: "openModal",
        view: "x",
        title: "X",
        size: "lg",
      }),
    ).toEqual({ type: "openModal", view: "x", title: "X", size: "lg" });
    // A view that isn't a plain name, no title, or too much data: none.
    for (const bad of [
      { view: "../x", title: "X" },
      { view: "x", title: " " },
      { view: "x", title: "X", data: "y".repeat(9000) },
    ])
      expect(parseFrameMessage({ type: "openModal", ...bad })).toBeNull();
    expect(parseFrameMessage({ type: "closeModal" })).toEqual({
      type: "closeModal",
    });
  });

  it("takes a settings page's unsaved changes and how saving went", () => {
    expect(parseFrameMessage({ type: "unsaved", unsaved: true })).toEqual({
      type: "unsaved",
      unsaved: true,
    });
    expect(parseFrameMessage({ type: "unsaved", unsaved: "yes" })).toEqual({
      type: "unsaved",
      unsaved: false,
    });
    expect(parseFrameMessage({ type: "saveDone", seq: 2, ok: true })).toEqual({
      type: "saveDone",
      seq: 2,
      ok: true,
    });
    expect(
      parseFrameMessage({ type: "saveDone", seq: 3, ok: false, error: "x" }),
    ).toEqual({ type: "saveDone", seq: 3, ok: false, error: "x" });
    expect(parseFrameMessage({ type: "saveDone", seq: "3" })).toBeNull();
  });
});
