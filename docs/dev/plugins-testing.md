# Testing

`@barynt/plugin-sdk/testing` runs your plugin against a **test host**: you
say what each call answers, the host records every call. No Barynt, no
browser needed for the logic — any test runner works; the examples use
`bun test`.

```ts
import { describe, expect, it } from "bun:test";
import { createTestHost, loadPlugin } from "@barynt/plugin-sdk/testing";
import OpenIssues from "../src/main";

describe("Open Issues", () => {
  it("asks for the project's issues", async () => {
    const host = createTestHost({
      context: { slot: { kind: "projectView", id: "open" } },
      handlers: {
        "issues.list": () => ({ issues: [], nextCursor: null }),
      },
    });
    await loadPlugin(OpenIssues, host);
    expect(host.calls).toEqual([
      { method: "issues.list", params: { take: 100 } },
    ]);
  });
});
```

## `createTestHost(options?)`

| Option | Meaning |
| --- | --- |
| `handlers` | One function per [host API](plugins-host-api.md) method: gets the params, returns the result (or a promise). Typed like the real method. |
| `context` | Parts of the `context` to set; the rest defaults to a project view `main` in project `project`, locale `en`. |
| `root` | The element to render into. Defaults to a new `div` when there's a `document`. |

A method without a handler is refused with `capability_not_confirmed` —
the same as Barynt does when a capability isn't confirmed. To test another
refusal, throw its code from a handler:

```ts
handlers: {
  "issues.update": () => {
    throw new Error("forbidden");
  },
}
```

The plugin then gets a `BaryntError` with `code: "forbidden"`.

`host.calls` lists every call in order: `{ method, params }`.

## `loadPlugin(PluginClass, host?)`

Creates the plugin on the host, runs `onload()`, and returns
`{ plugin, host, unload }`. `unload()` runs `onunload()` and the cleanup, so
you can check that intervals stop and listeners go.

## Rendering

To check what a view draws, give the test a DOM — with Bun, e.g.
[happy-dom](https://github.com/capricorn86/happy-dom) — and pass
`root: document.createElement("div")`. Without one, test the logic and keep
the drawing thin.

## Trying it in Barynt

For the real thing, release it locally and switch it on in your Barynt, as
in [Your first plugin](plugins-first-plugin.md#4-a-local-release).
