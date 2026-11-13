import { BRIDGE_MAX_PENDING, BRIDGE_TIMEOUT_MS } from "./bridge";
import { tokenCss } from "./tokens";

// The document a sandboxed plugin runs in (BARY-144). Everything the plugin
// gets is inside it: its code and styles inline, a small runtime, nothing
// to load from anywhere. The response's CSP makes it a sandbox with an
// opaque origin — no Barynt cookies, no storage, no network — so the only
// way out is the private channel the host hands over with `barynt:init`.

/**
 * The runtime, run before the plugin. It waits for the host's first message
 * (from the parent window, with a port), loads the plugin's code as a module
 * from a blob, and gives its default export a host object: `call(method,
 * params)` over the channel, the `context` and a `root` element. Errors —
 * thrown, rejected, or a request without an answer — go to the host, which
 * shows them as the plugin's, not the page's.
 */
const RUNTIME = `(() => {
  "use strict";
  const TIMEOUT = ${BRIDGE_TIMEOUT_MS};
  const MAX_PENDING = ${BRIDGE_MAX_PENDING};
  const pending = new Map();
  let port = null;
  let seq = 0;
  let instance = null;

  const send = (message) => port && port.postMessage(message);
  const fail = (error) =>
    send({ type: "error", message: String((error && error.message) || error) });

  // Barynt's variables, and \`data-theme\` (light or dark) for a plugin's
  // own CSS; a change after the start is announced (BARY-206).
  const applyTheme = (theme, announce) => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme || {}))
      if (/^--[a-z0-9-]+$/.test(name)) root.style.setProperty(name, String(value));
    const scheme = String((theme || {})["--color-scheme"] || "");
    root.dataset.theme = /dark/.test(scheme)
      ? "dark"
      : /light/.test(scheme)
        ? "light"
        : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (announce) window.dispatchEvent(new Event("barynt:themechange"));
  };

  const call = (method, params) =>
    new Promise((resolve, reject) => {
      if (pending.size >= MAX_PENDING)
        return reject(new Error("too_many_requests"));
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("timeout"));
      }, TIMEOUT);
      pending.set(id, { resolve, reject, timer });
      send({ type: "call", id, method, params: params ?? {} });
    });

  window.addEventListener("error", (e) => fail(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => fail(e.reason));

  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (port || event.source !== window.parent) return;
    if (!data || data.type !== "barynt:init" || !event.ports[0]) return;
    port = event.ports[0];
    applyTheme(data.theme);
    port.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "theme") return applyTheme(m.theme, true);
      if (m.type !== "result") return;
      const open = pending.get(m.id);
      if (!open) return;
      pending.delete(m.id);
      clearTimeout(open.timer);
      if (m.ok) open.resolve(m.result);
      else open.reject(new Error(String(m.error)));
    };
    try {
      const code = JSON.parse(document.getElementById("plugin-code").textContent);
      const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
      const mod = await import(url);
      URL.revokeObjectURL(url);
      const Plugin = mod.default;
      if (typeof Plugin !== "function") throw new Error("main.js has no default export");
      const host = Object.freeze({
        call,
        context: Object.freeze(data.context),
        root: document.getElementById("root"),
        // A building block's data, for Barynt to draw (BARY-205).
        show: (blockData) => send({ type: "blockData", data: blockData }),
      });
      instance = new Plugin(host);
      if (instance && typeof instance.onload === "function") await instance.onload();
      send({ type: "ready" });
    } catch (error) {
      fail(error);
    }
  });

  window.addEventListener("pagehide", () => {
    try {
      if (instance && typeof instance.onunload === "function") instance.onunload();
    } catch {}
  });
})();`;

/** What every frame starts with: Barynt's tokens as a plugin's defaults.
 *  The host sets `--color-scheme` to its own — a frame whose scheme differs
 *  from the page's gets an opaque backdrop — and `--frame-bg` to
 *  `transparent` where the frame sits on a card (a widget, a block). */
const BASE_CSS = `
:root { color-scheme: var(--color-scheme, light dark); }
${tokenCss()}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--frame-bg, var(--barynt-color-surface, transparent));
  color: var(--barynt-color-text, CanvasText);
  font-family: var(--barynt-font-family, system-ui, sans-serif);
  font-size: var(--barynt-font-size-sm, 14px);
  line-height: var(--barynt-line-height-normal);
}
#root { min-height: 100%; }
`;

/** Text that's safe inside a `<script>` or `<style>` element: no closing
 *  tag can end it early. */
const scriptSafe = (text: string) => text.replace(/</g, "\\u003c");
const styleSafe = (text: string) => text.replace(/<\/style/gi, "<\\/style");

/** The frame document for a plugin's `main.js` and optional `styles.css`. */
export function buildFrameDocument(input: {
  code: string;
  css: string | null;
  nonce: string;
  title: string;
}): string {
  const title = input.title.replace(/[<&"]/g, "");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${BASE_CSS}</style>
${input.css ? `<style>${styleSafe(input.css)}</style>` : ""}
</head>
<body>
<div id="root"></div>
<script type="application/json" id="plugin-code">${scriptSafe(JSON.stringify(input.code))}</script>
<script nonce="${input.nonce}">${RUNTIME}</script>
</body>
</html>`;
}

/** The frame's CSP: a sandbox with scripts only, its own inline runtime by
 *  nonce and the plugin's module from a blob; no network at all. */
export function frameCsp(nonce: string): string {
  return [
    "sandbox allow-scripts",
    "default-src 'none'",
    `script-src 'nonce-${nonce}' blob:`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'self'",
  ].join("; ");
}
