# @barynt/plugin-sdk

Build sandboxed plugins for Barynt. A plugin is a class; Barynt runs it in a
sandbox and checks everything it asks for on the server.

```ts
import { Plugin } from "@barynt/plugin-sdk";

export default class Timeline extends Plugin {
  async onload() {
    const settings = await this.loadSettings();
    this.registerProjectView({
      id: "timeline", // as in the manifest's contributes.projectViews
      render: async (el) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        for (const issue of issues) {
          const row = document.createElement("div");
          row.textContent = `${issue.ref} ${issue.title}`;
          el.append(row);
        }
      },
    });
    this.registerInterval(() => this.refresh(), 60_000);
  }

  refresh() {}
}
```

- **`this.api`** — Barynt's API, typed: `issues`, `comments`, `labels`,
  `projects`, `members`, `fields`, `storage`, `settings`. Each call needs its
  capability in the manifest and confirmed where the plugin runs; a refusal
  is a `BaryntError` with a `code`.
- **`register*`** — `registerProjectView`, `registerInterval`,
  `registerDomEvent`, `register(cleanup)`. All undone on their own when the
  plugin unloads; `onunload()` is only for what you set up yourself.
- **`this.context`** — where it runs: slot, workspace, project, locale.

Build `main.js` as one ES module with the SDK bundled in, e.g.
`bun build src/main.ts --outfile main.js --format esm --target browser`.

## Testing

```ts
import { createTestHost, loadPlugin } from "@barynt/plugin-sdk/testing";

const host = createTestHost({
  context: { slot: { kind: "projectView", id: "timeline" } },
  handlers: { "issues.list": () => ({ issues: [], nextCursor: null }) },
});
const { unload } = await loadPlugin(Timeline, host);
expect(host.calls[0].method).toBe("issues.list");
unload();
```

The runtime contract, every method and its limits:
[docs/plugins/runtime.md](../../docs/plugins/runtime.md).

Not on npm yet — it lives in the Barynt repository for now.
