# Plugin SDK

`@barynt/plugin-sdk` is how a sandboxed plugin talks to Barynt. You extend
its `Plugin` class, Barynt creates it and calls `onload()`; everything else
goes through the class.

> [!NOTE]
> The SDK lives in the Barynt repository (`packages/plugin-sdk`) and isn't on
> npm yet. Build it with `bun run build` there and depend on it with a
> `file:` path, as in [Your first plugin](plugins-first-plugin.md#1-the-project).
> It's bundled into your `main.js`; nothing is loaded at runtime.

```ts
import { Plugin } from "@barynt/plugin-sdk";

export default class Timeline extends Plugin {
  async onload() {
    const settings = await this.loadSettings<{ weeks: number }>();
    this.registerProjectView({
      id: "timeline",
      render: async (el) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        draw(el, issues, settings.weeks);
      },
    });
  }
}
```

## Lifecycle

1. Someone opens a place the plugin fills — today, one of its project
   views. Barynt opens a **frame** for it: a sandbox of its own (see
   [Sandbox and limits](plugins-sandbox.md)).
2. Barynt creates your class (`new YourPlugin(host)`) and calls
   **`onload()`**. Set everything up there: register the views, start what
   needs starting. Errors you throw here show as the plugin's error, with a
   way to load it again.
3. The plugin runs as long as the frame is open.
4. When the frame goes away, Barynt calls **`onunload()`**. Everything you
   registered through a `register*` method is undone on its own afterwards.

There's one frame per view: two views of the same plugin are two
instances, each with its own `context`.

## The `Plugin` class

### `onload()`

```ts
abstract onload(): void | Promise<void>;
```

Required. Called once when the plugin starts. May be `async`; Barynt waits
for it before it counts the plugin as started (at most 10 seconds).

### `onunload()`

```ts
onunload(): void;
```

Optional. Called when the frame goes away. Only for what you set up yourself
without a `register*` method — the registered things are cleaned up after it
anyway.

### `api`

```ts
readonly api: Api;
```

Barynt's API, typed. See [The API object](#the-api-object) below and every
call in [Host API](plugins-host-api.md).

### `context`

```ts
readonly context: Context;
```

Where this instance runs:

| Field | Type | Meaning |
| --- | --- | --- |
| `slot` | `{ kind: "projectView"; id: string }` | The place it fills: which of its views. |
| `workspaceId` | `string` | The workspace. |
| `projectId` | `string \| null` | The project, or `null` for a workspace's plugin. |
| `locale` | `string` | The person's language, e.g. `de` or `en`. |

### `root`

```ts
readonly root: HTMLElement;
```

The element the frame shows. `registerProjectView` hands it to `render` too.

### `registerProjectView()`

```ts
registerProjectView(view: {
  id: string;
  render(el: HTMLElement, context: Context): void | Cleanup | Promise<void | Cleanup>;
}): void;
```

Registers one of the views from the manifest's `contributes.projectViews`.
Because each frame is for exactly one view, `render` is called right away
when this frame is for `id`, and never otherwise — so register all your
views in `onload()` and let the SDK pick. `render` may be `async` and may
return a function that undoes what it did; it runs on unload.

### `whenRendered()`

```ts
whenRendered(): Promise<void>;
```

Resolves once every view registered so far has rendered, and rejects with
the first error a `render` threw. `loadPlugin` in tests waits for it, so a
test sees the finished view; you rarely call it yourself.

### `register()`

```ts
register(cleanup: () => void): void;
```

Runs `cleanup` when the plugin unloads. For anything that needs undoing —
an observer, a subscription, a timer you started without the SDK.

### `registerInterval()`

```ts
registerInterval(callback: () => void, ms: number): number;
```

`setInterval`, cleared on unload. Returns the interval's id.

### `registerDomEvent()`

```ts
registerDomEvent(target: HTMLElement | Window | Document, type: string, listener: (event) => void, options?): void;
```

`addEventListener`, removed on unload. Typed by event name
(`"click"` gives a `MouseEvent`).

### `loadSettings()`

```ts
loadSettings<T extends Record<string, Json>>(): Promise<T>;
```

The plugin's [settings](plugins-manifest.md#settings) in this place, each with the
saved value or the manifest's `default` (`null` when it has neither).
Settings are per place: a project's values for a project view.

### Cleaning up

Everything registered is undone in reverse order — last registered, first
undone — after your own `onunload()`, even if that throws. A cleanup that
throws doesn't stop the others.

## The API object

`this.api` groups the [Host API](plugins-host-api.md) by what it's about. Every
method returns a `Promise` and rejects with a [`BaryntError`](#errors).

| Call | Host API method |
| --- | --- |
| `api.issues.list(params?)` | `issues.list` |
| `api.issues.get(id)` | `issues.get` |
| `api.issues.create(input)` | `issues.create` |
| `api.issues.update(id, patch)` | `issues.update` |
| `api.comments.list(issueId)` | `comments.list` |
| `api.comments.create(issueId, body, parentId?)` | `comments.create` |
| `api.labels.list(params?)` | `labels.list` |
| `api.projects.list()` | `projects.list` |
| `api.members.list(params?)` | `members.list` |
| `api.fields.list(params?)` | `fields.list` |
| `api.storage.get<T>(key)` | `storage.get` |
| `api.storage.set(key, value)` | `storage.set` |
| `api.storage.delete(key)` | `storage.delete` |
| `api.storage.list()` | `storage.list` |
| `api.settings.get()` | `settings.get` (what `loadSettings()` uses) |
| `api.net.fetch(url, init?)` | `net.fetch`: a request to one of the manifest's hosts; returns a `NetResponse` with `status`, `ok`, `headers`, `text`, `base64` and `json()` |

```ts
const issue = await this.api.issues.create({ title: "Follow up", priority: 2 });
await this.api.comments.create(issue.id, "Created from the timeline.");
await this.api.storage.set("lastRun", new Date().toISOString());
```

## Errors

When Barynt refuses a request, the promise rejects with a `BaryntError`:

```ts
import { BaryntError } from "@barynt/plugin-sdk";

try {
  await this.api.issues.update(id, { status: "done" });
} catch (error) {
  if (error instanceof BaryntError && error.code === "capability_not_confirmed") {
    showHint("Ask an admin to confirm “Create and change issues”.");
  } else throw error;
}
```

`error.code` is one of the codes in
[Host API → Errors](plugins-host-api.md#errors). An error you don't catch ends up as
the plugin's error in Barynt.

## Types

The SDK exports the types of everything it hands you: `Issue`, `Comment`,
`Label`, `Project`, `Member`, `CustomField`, `IssueInput`, `NetResponse`, `Context`,
`Json`, `ErrorCode`, and `Methods` — each Host API method's params and
result.

```ts
import type { Issue } from "@barynt/plugin-sdk";
```

## Without the SDK

The SDK is a thin layer. A plugin can also export any class: Barynt calls
`new YourClass(host)` and `onload()`, and `host` has `call(method, params)`,
`context` and `root`. The SDK adds the types, the cleanup and the errors —
there's little reason to go without it.
