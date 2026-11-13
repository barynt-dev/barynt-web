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
| `slot` | `{ kind: "projectView" \| "page" \| "widget" \| "settings"; id: string }` | The place it fills: which of its views, pages or widgets, or its settings page. |
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

### `registerPage()`

```ts
registerPage(page: { id: string; render(el, context) }): void;
```

The same for a page from `contributes.navItems`, opened from its entry in
the sidebar's "Plugins" section. A view and a page may share an `id`; each
frame is for one of them.

### `registerBadges()`

```ts
registerBadges(badges: { provide(issues: BadgeIssue[]): Record<string, Badge[]> }): void;
```

Badges on a project's board cards and list rows, for the badges in
`contributes.issueBadges`. Barynt runs one hidden frame per plugin and board
and calls `provide` with the issues it shows, in batches of up to 200 — and
again when they change. Return the chips by issue id; Barynt checks and
draws them.

```ts
this.registerBadges({
  provide: (issues) => {
    const out: Record<string, Badge[]> = {};
    for (const issue of issues) {
      if (!issue.dueDate) continue;
      const left = Math.round((Date.parse(issue.dueDate) - Date.now()) / 86_400_000);
      out[issue.id] = [{
        badge: "due",                       // one of your issueBadges
        text: left < 0 ? `${-left}d late` : `in ${left}d`,
        icon: "calendar",
        tone: left < 0 ? "danger" : "neutral",
        tooltip: "Due date",
      }];
    }
    return out;
  },
});
```

| `BadgeIssue` | |
| --- | --- |
| `id`, `ref` | always |
| `title`, `priority`, `dueDate`, `created` | with `issues:read` confirmed |

| `Badge` | |
| --- | --- |
| `badge` | which of your `issueBadges` — what "Display" hides |
| `text` | up to 24 characters |
| `icon` | `BadgeIcon`: `clock`, `timer`, `calendar`, `check`, `circle-check`, `circle-x`, `triangle-alert`, `info`, `flag`, `star`, `bug`, `zap`, `lock`, `eye`, `link`, `user`, `message-square`, `git-pull-request`, `git-merge`, `git-branch`, `rocket`, `package` |
| `tone` | `neutral`, `primary`, `info`, `success`, `warning`, `danger` |
| `tooltip` | up to 120 characters |

At most 3 chips per issue are taken; anything that isn't one of these is
dropped.

**A row across the card.** With `kind: "row"`, a badge is a line across
the board card, between the labels and the footer — a merge request, a
build, a deployment. **You decide what's in it**: `parts`, left to right,
in any order. Barynt draws every part — no frame per card, so a board with
hundreds of cards stays fast and nothing a plugin sends can run on the
page. In the list, where there's no room, a row shows as a chip: its first
icon and its `text` (or its texts). Up to 2 rows per issue, next to the 3
chips; each **at most two lines high**.

There are two ways to fill a row, and you can mix them:

- **Building blocks** for the usual things — a pipeline, a state, a date —
  one line each:

```ts
{
  badge: "review",
  kind: "row",
  tone: "warning",                        // tints the row
  panel: "review",                        // a click opens the issue at this panel
  parts: [
    { type: "icon", icon: "git-pull-request", tone: "success" },
    { type: "text", text: "#410", mono: true, tone: "subtle" },
    { type: "text", text: "Changes requested", tone: "warning", strong: true },
    { type: "spacer" },
    { type: "steps", steps: ["success", "success", "success"] },
    { type: "status", status: "success" },
  ],
}
```

- **Free layout** for anything else: `group`s — side by side or stacked,
  with gap, alignment, growth, padding, background, border and corners —
  of `text`, `icon`, `dot` and `image`, and a `break` for the second line:

```ts
{
  badge: "deploy",
  kind: "row",
  text: "Deploy to staging",              // what the list shows
  parts: [
    { type: "group", direction: "column", gap: 0, grow: true, children: [
      { type: "text", text: "Deploy to staging", strong: true },
      { type: "text", text: "build 1842 · 4 min", size: "xs", tone: "subtle", mono: true },
    ] },
    { type: "image", src: canvas.toDataURL("image/png"), alt: "Build times", width: 48, height: 24 },
    { type: "sparkline", values: [5, 7, 6, 9, 8, 11], tone: "success" },
    { type: "break" },                    // second line
    { type: "avatar", name: "Grace Hopper" },
    { type: "label", name: "staging", color: "teal" },
    { type: "date", date: deployedAt },
    { type: "spacer" },
    { type: "link", text: "Logs", href: "https://ci.example.com/builds/1842" },
  ],
}
```

| Free layout | |
| --- | --- |
| `{ type: "group", children, direction?, gap?, align?, justify?, grow?, padding?, background?, border?, radius? }` | `direction` `row` / `column`; `gap` 0–3 and `padding` 0–2 on Barynt's scale; `align` `start` / `center` / `end`; `justify` `start` / `between` / `end`; `background` a tone or `subtle`; `radius` `sm` / `md` / `pill` |
| `{ type: "text", text, tone?, size?, mono?, strong?, italic? }` | up to 40 characters; `size` `xs` / `sm` / `base`; `tone` also `subtle` |
| `{ type: "icon", icon, tone? }` | one of the badge icons |
| `{ type: "dot", tone? }` | a small dot |
| `{ type: "image", src, alt, width, height, rounded? }` | a `data:image/png`, `jpeg` or `webp` URL up to 24 kB — draw on a canvas and `toDataURL()`; up to 64 × 32 px; no SVG, no address |
| `{ type: "spacer" }` | pushes what follows to its line's right end |
| `{ type: "break" }` | starts the second line (once, at the top level) |

| Building blocks | |
| --- | --- |
| `{ type: "steps", steps }` | a pipeline: up to 8 of `success`, `running`, `warning`, `danger`, `pending` |
| `{ type: "status", status }` | a mark: `success`, `danger`, `warning`, `pending` |
| `{ type: "progress", value, max }` | a short bar |
| `{ type: "sparkline", values, tone? }` | a small line of 2–30 numbers |
| `{ type: "date", date, format? }` | in the person's language: `relative` ("in 3 days", default) or `short` ("13 Nov") |
| `{ type: "label", name, color }` | a label as Barynt shows one; `color` a palette name or `#hex` |
| `{ type: "avatar", name }` | a person's initials |
| `{ type: "chip", text, tone? }` | a small chip |
| `{ type: "link", text, href }` | `https` only; opens in a new tab, not the issue |

Limits: 24 parts in a row (groups and their children counted), groups 3
deep, one `break`. A part Barynt doesn't know, or one with a value it
won't take, is dropped; a row with nothing left to read isn't drawn.

**More than a card can hold?** Give the row a `panel` — one of your
`issuePanels`. A click on the row opens the issue at that panel, where you
draw whatever you like ([`registerIssuePanel()`](#registerissuepanel)).

The demo plugin **Demo Code Review** (`scripts/plugins/demo-plugins/code-review.ts`)
does all of this.

### `registerIssuePanel()`

```ts
registerIssuePanel(panel: { id: string; render(el, context) }): void;
```

A panel in an issue's detail, from `contributes.issuePanels` — in the side
panel, the dialog, the full page and the phone sheet. `context.issueId` is
the issue; read it with `api.issues.get()`. The frame grows to your
content's height on its own, so there's nothing to size.

```ts
this.registerIssuePanel({
  id: "schedule",
  render: async (el, { issueId }) => {
    const issue = await this.api.issues.get(issueId!);
    el.replaceChildren(keyValue({ items: [{ label: "Created", value: issue.created }] }));
  },
});
```

Opening another issue opens a new frame, with that issue's `issueId`.

A panel with `"placement": "sidebar"` in the manifest is drawn the same way;
the sidebar is narrow, so draw for about 300 px. The issue's custom fields
come with `api.issues.get()` as `customFields`, by field key — a panel can
build on what a project already keeps there:

```ts
this.registerIssuePanel({
  id: "development",
  render: async (el, { issueId }) => {
    const issue = await this.api.issues.get(issueId!);
    const branch = (issue.customFields?.branch as string) ?? `${issue.ref.toLowerCase()}-work`;
    el.replaceChildren(
      stack(
        copyField({ value: branch, icon: "git-branch", href: branchUrl }),
        card({ compact: true, tone: "warning", children: [
          sectionHeader({ title: "#410", icon: "git-pull-request", status: { text: "Changes requested", tone: "warning" } }),
          text({ text: "fix(theme): lighter muted token" }),
          row(diffStat({ added: 9, removed: 4 }), avatar({ name: "Ada Rahman", size: "sm" })),
        ] }),
        card({ compact: true, children: [
          sectionHeader({ title: "Pipeline", icon: "circle-check", status: { text: "Passed", tone: "success" } }),
          stepList({ steps: [{ label: "Build", state: "success", meta: "1m 12s" }, { label: "Test", state: "success", meta: "3m 40s" }] }),
        ] }),
        navList({ items: [{ icon: "git-commit-horizontal", count: 1, label: "Commit", href: commitsUrl }] }),
      ),
    );
  },
});
```

### `registerWidget()`

```ts
registerWidget(widget: { id: string; render(el, context) }): void;
```

A dashboard widget from `contributes.dashboardWidgets`. Its frame fills the
widget below Barynt's header, in the size someone picked (S to XL) — watch
`el` with a `ResizeObserver` to show more when there's room. For a widget of
Barynt's own blocks you need no code at all — see
[widget templates](plugins-manifest.md#widget-templates).

### `registerBlock()`

```ts
registerBlock(block: { id: string; data?(context): BlockData; render?(el, context) }): void;
showBlock(data: BlockData): void;
```

A [building block](plugins-manifest.md#building-blocks) from
`contributes.widgetBlocks`, which people put into their custom widgets. Barynt
opens a frame per block in a widget; `context.config` holds the settings
someone chose for it in the builder.

With `data` (`draw: "barynt"`, the default) your frame runs out of sight:
return what to show, and Barynt draws it like its own blocks. Call
`showBlock()` to show something new later — on a timer, say.

```ts
this.registerBlock({
  id: "due-soon",
  data: async ({ config }) => {
    const days = Number(config?.days ?? 7);
    const { issues } = await this.api.issues.list({ take: 100 });
    const soon = issues.filter((i) => i.dueDate && daysUntil(i.dueDate) <= days);
    return {
      kind: "list",
      items: soon.map((i) => ({ title: `${i.ref} ${i.title}`, meta: `in ${daysUntil(i.dueDate!)} d` })),
      empty: `Nothing due in the next ${days} days.`,
    };
  },
});
```

| `kind` | Fields |
| --- | --- |
| `kpi` | `value`, `label`, `trend?: { text, good? }` |
| `list` | `items: { title, meta?, href? }[]`, `empty?` |
| `bars` | `bars: { label, value, color? }[]` — `color` a `#hex` or `var(--token)` |
| `progress` | `value`, `max?` (100), `label?` |

Texts are cut to 200 characters, lists and bars to 20 entries, links to
`http(s)`; anything else is dropped. With `render` instead (`draw: "plugin"`),
you draw the block yourself, like a view — the [UI kit](#the-ui-kit) helps.

### `registerSettings()`

```ts
registerSettings(page: { render(el, context) }): void;
```

Its own settings (`contributes.settingsPage`): with `true` a page shown
instead of Barynt's form, with `"section"` a part below it — see
[Manifest → Its own settings page](plugins-manifest.md#its-own-settings-page).
`context.slot.id` says which: `"settings"` or `"section"`. Read the values
with `loadSettings()`, save them with `api.settings.set(values)`.

```ts
import { button, status, stack } from "@barynt/plugin-sdk/ui";

this.registerSettings({
  render: (el) => {
    const line = status();
    const check = button({
      label: "Check connection",
      onClick: async () => {
        const { gitlabProject } = await this.loadSettings<{ gitlabProject: string | null }>();
        const res = await this.api.net.fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlabProject ?? "")}`);
        line.set(res.ok ? "Connected." : `GitLab answered ${res.status}.`, res.ok ? "success" : "error");
      },
    });
    el.replaceChildren(stack(check, line.el));
  },
});
```

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
| `api.settings.set(values)` | `settings.set`: saves its settings, for someone with `plugin.enable` there |
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

## The UI kit

`@barynt/plugin-sdk/ui` has Barynt's components for your frame — the pieces
Barynt's own pages are made of — so a plugin looks like Barynt without
rebuilding it. They're plain DOM, no framework: each function returns an
element (an input returns a field with its element in `el`) to put wherever
you like, next to your own. They're drawn with the
[design tokens](#design-tokens), light and dark like Barynt, keyboard- and
screen-reader-friendly. Their styles go into the frame once, the first time
you use one.

```ts
import { badge, button, card, stack, table, textField, toast, user } from "@barynt/plugin-sdk/ui";

const project = textField({ label: "GitLab project", placeholder: "acme/web", onEnter: () => save() });
const save = async () => {
  await this.api.settings.set({ gitlabProject: project.value.trim() });
  toast("Saved", { tone: "success" });
};
el.replaceChildren(
  stack(
    card({ title: "Connection", children: [project.el, button({ label: "Save", variant: "primary", onClick: save })] }),
    table({
      columns: [{ key: "title", label: "Title" }, { key: "author", label: "Author" }, { key: "state", label: "State" }],
      rows: mrs.map((mr) => ({ title: mr.title, author: user({ name: mr.author }), state: badge({ text: "Open", tone: "primary" }) })),
    }),
  ),
);
```

> [!TIP]
> The demo plugin **Demo UI Kit** (`scripts/plugins/demo-plugins/ui-kit.ts`)
> shows every component and token on one page — the quickest way to see
> what there is.

**Safe by default.** Text always goes in as text, never as HTML — a title
like `<img onerror=…>` shows as those characters. A `link` or a list's
`href` only takes `http(s)` and `mailto`; anything else stays plain text. A
`color` only takes a palette name (`"teal"`), a `#hex` or a token — nothing
else reaches a style.

### Inputs

Each returns a field: `el`, `value`, `disabled`, `focus()`. All take
`label` and `hint`; the label is tied to the control.

| Function | What | Options |
| --- | --- | --- |
| `textField()` | one line | `value`, `placeholder`, `type` (`text`, `url`, `email`, `number`, `password`, `search`), `onInput`, `onEnter` |
| `textArea()` | several lines | `value`, `placeholder`, `rows`, `onInput` |
| `dateField()` | a date, `YYYY-MM-DD` | `value`, `min`, `max`, `onChange` |
| `select()` | one of many, as a dropdown | `options: { value, label }[]`, `value`, `onChange` |
| `radioGroup()` | one of a few, all in view | `options: { value, label, hint? }[]`, `value`, `onChange` |
| `segmentedControl()` | one of a few, side by side (arrow keys) | `options`, `value`, `onChange` |
| `multiSelect()` | any number, as chips | `options`, `value: string[]`, `onChange` |
| `toggle()` | on or off — a switch | `checked`, `onChange` |
| `checkbox()` | on or off — a box | `checked`, `onChange` |
| `swatchPicker()` | a colour of the palette | `value`, `colors`, `onChange` |
| `button()` | an action | `label`, `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`), `icon`, `iconOnly`, `onClick` — disabled while a returned promise runs |

The sandbox doesn't submit forms, so there's no `form()`: a field's
`onEnter` and a button's `onClick` do the saving.

### Text and layout

| Function | What |
| --- | --- |
| `heading({ text, level? })` | `h1`–`h4`, sized like Barynt's |
| `text({ text, tone?, size?, weight?, mono?, inline? })` | a paragraph; `tone` `subtle`, `primary`, `success`, `warning`, `danger` |
| `link({ text, href })` | a link out, in a new tab |
| `stack(...children)`, `row(...children)` | under each other / next to each other, with room between |
| `grid({ children, minWidth? })` | as many columns as fit, each at least `minWidth` (`12rem`) |
| `card({ title?, description?, children?, actions?, tone?, compact? })` | a framed section; `tone` colours its edge, `compact` takes less room (a sidebar) |
| `divider()` | a line |
| `icon(name, { size?, label? })` | one of the built-in icons (`IconName`: `check`, `x`, `plus`, `search`, `calendar`, `git-pull-request` … — `ICONS` lists them); no network needed |

### Small things and feedback

| Function | What |
| --- | --- |
| `badge({ text, tone? })` | a short state: `neutral`, `primary`, `info`, `success`, `warning`, `danger` |
| `tag({ text, color?, onRemove? })` | a coloured tag, removable |
| `labelChip({ name, color? })` | a label as Barynt shows one |
| `avatar({ name, color?, size? })`, `user({ name, color?, meta? })` | initials; a person with a line about them |
| `statusDot({ label, category })` | a status by its category: `backlog`, `unstarted`, `started`, `completed`, `canceled` |
| `tooltip(element, text)` | shows on hover and focus, read out by screen readers |
| `notice({ text, title?, tone?, action? })` | a message in the page — `danger` is announced at once |
| `toast(text, { tone?, duration? })` | a short message in the corner |
| `status()` | a line that says how it went: `set(text, tone?)`, `clear()` |
| `spinner({ label? })`, `skeleton({ lines? })` | while something loads |
| `emptyState({ title, text?, icon?, action? })` | where there's nothing yet |
| `sectionHeader({ title, icon?, meta?, status? })` | a head over a card or section: icon, title, on the right a note or a state in its tone |
| `copyField({ value, icon?, href?, label? })` | a value to copy — a branch, a hash — with a copy button and, with `href`, one to open it |
| `stepList({ steps })` | steps with their state (`success`, `running`, `warning`, `danger`, `pending`) and, on the right, a note — a pipeline |
| `navList({ items })` | rows that lead somewhere: `{ label, icon?, count?, href? \| onClick? }` with a › at the end |
| `diffStat({ added, removed })` | "+9 −4" |

### Data and numbers

| Function | What |
| --- | --- |
| `table({ columns, rows, caption?, empty? })` | rows under headings; a cell is text or an element; `align: "end"` for numbers; scrolls sideways when narrow |
| `keyValue({ items })` | labels and values side by side |
| `tabs({ tabs, value?, label?, onChange? })` | tabs (arrow keys); a tab's `content` can be a function, drawn when first opened |
| `accordion({ items })` | sections that open and close |
| `kpi({ value, label, trend? })` | a big number; `trend: { text, good? }` |
| `list({ items, empty? })` | rows of `{ title, meta?, href? }` |
| `barChart({ bars, max? })` | horizontal bars of `{ label, value, color? }` |
| `progressBar({ value, max?, label?, tone? })`, `progressRing({ value, max?, label?, size? })` | how far along |

### Overlays

| Function | What |
| --- | --- |
| `dialog({ title, content?, actions?, onClose? })` | a dialog over the frame: `open()`, `close()`; Escape and ✕ close it |
| `confirm({ title, text?, confirmLabel?, cancelLabel?, danger? })` | asks first, resolves `true` or `false` — the sandbox blocks the browser's own `confirm()` |

## Design tokens

Barynt's colours, sizes and spaces, under stable names, light or dark as
Barynt is right now — see
[Sandbox → Looking like Barynt](plugins-sandbox.md#looking-like-barynt) for
the list. From code:

```ts
import { onThemeChange, theme, token, tokenValue } from "@barynt/plugin-sdk";

el.style.gap = token("space.3");                 // "var(--barynt-space-3)"
ctx.strokeStyle = tokenValue("color.primary");   // the colour itself, for a canvas
this.register(onThemeChange(() => redraw()));    // light ↔ dark
if (theme() === "dark") …
```

| Function | Gives |
| --- | --- |
| `token(name)` | `var(--barynt-…)` — for a style; follows the theme on its own |
| `tokenVariable(name)` | the variable's name, `--barynt-…` |
| `tokenValue(name)` | its value right now — read again after a theme change |
| `theme()` | `"light"` or `"dark"` (also `<html data-theme>`) |
| `onThemeChange(callback)` | runs on a switch; returns what stops it |
| `TOKEN_NAMES` | every name, for tooling |

`TokenName` is the type of a name, so your editor completes them.

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
