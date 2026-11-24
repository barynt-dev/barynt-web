# Manifest

Every plugin ships a `manifest.json` next to its `main.js`. Barynt reads it
when a plugin is installed and checks it strictly: an unknown field, a
missing capability or a contribution its kind can't have is an error, and
the plugin isn't installed.

Check yours before you release, from a Barynt checkout:

```bash
bun scripts/validate-plugin-manifest.ts path/to/manifest.json
```

## Example

```json
{
  "id": "gantt-timeline",
  "name": "Gantt Timeline",
  "version": "1.2.0",
  "minBaryntVersion": "1.0.0",
  "author": "Acme GmbH",
  "authorUrl": "https://acme.example",
  "description": {
    "short": "Issues on a time line, as a project view.",
    "about": "about.md"
  },
  "license": "MIT",
  "kind": "sandbox",
  "levels": ["project"],
  "capabilities": ["issues:read", "issues:write", "storage:own", "ui:project-view"],
  "network": [],
  "contributes": {
    "projectViews": [{ "id": "timeline", "title": "Timeline", "icon": "lucide:gantt-chart" }],
    "settings": [
      { "key": "weeks", "type": "number", "label": "Weeks shown", "default": 6 }
    ]
  },
  "previews": [
    { "file": "preview-1.webp", "title": "Timeline per project" }
  ]
}
```

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | 3 to 40 characters: lower-case letters, digits and `-`, starting with a letter. `barynt`, `core`, `system` and `admin` are reserved. Never change it — it's how Barynt knows the plugin. |
| `name` | yes | Up to 60 characters, shown everywhere. |
| `version` | yes | `MAJOR.MINOR.PATCH`, optionally `-prerelease` (`1.2.0-beta.1`). Each version is a release. |
| `minBaryntVersion` | yes | The lowest Barynt version it works with. Older instances can't install it. |
| `maxBaryntVersion` | no | The highest version it was tested on. |
| `author` | yes | Up to 80 characters. |
| `authorUrl` | no | An `http(s)` address, linked in the store. |
| `description` | yes | In English: `short`, one or two sentences up to 300 characters, and optionally `about`, the plugin's page in the store — see [Page text and links](#page-text-and-links). |
| `links` | no | Up to 10 addresses — homepage, docs, community — see [Page text and links](#page-text-and-links). |
| `locales` | no | Texts in Barynt's other languages: the description (`{ "de": { "description": { "short": "…", "about": "…" } } }`, either text optional) and the titles, labels and descriptions of what it contributes, see [Translations](#translations). Barynt shows each person the texts in their language, else the English ones. |
| `logo` | no | `logo.png` or `logo.webp`, a file in the release: the plugin's picture in the store, the sidebar and its settings, see [Publishing](plugins-publishing.md#logo-and-screenshots). Without one, its first letter. |
| `license` | yes | E.g. `MIT`, `Apache-2.0`, `Proprietary`. |
| `kind` | yes | `declarative`, `sandbox` or `service`, see [Building plugins](plugins.md#the-three-kinds). |
| `levels` | yes | Where it can be switched on: `workspace`, `project`, or both. |
| `capabilities` | yes | What it asks for, from the list below. Ask for as little as you need — people read this list before they say yes. |
| `network` | yes | Host names it may call through Barynt with [`net.fetch`](plugins-host-api.md#netfetch), e.g. `api.acme.example`: no scheme, port or wildcard, at most 10. `[]` for none. People see them before they switch the plugin on. |
| `contributes` | no | What it adds, see below. |
| `service` | no | Its own server and the events it hears about, see [Its server](#its-server). |
| `previews` | no | Up to 6 screenshots for the store, see [Publishing](plugins-publishing.md#logo-and-screenshots). |

## Page text and links

`description.short` is the short line on tiles and in lists.
`description.about` is the plugin's page in the store: what it does, how to
set it up, what it needs. Without it the page shows the short text.

`about` is Markdown, up to 5000 characters — written in the manifest, or,
easier to keep, in a file of the release: `about.md`, and `about.de.md` for
another language. Barynt loads the file with the release (it's part of the
[release hash](plugins-publishing.md#the-release-hash)), checks that it's
UTF-8 text and short enough, and keeps its text with the manifest.

Either way it's shown the same: paragraphs, headings, lists, quotes, code,
**bold**, _italic_ — never links, images or HTML. A link's text stays, its
address doesn't; an image or HTML is left out. Addresses go in `links`,
which the store shows in a box of their own:

```json
"description": {
  "short": "Pull requests and checks on their issues.",
  "about": "about.md"
},
"locales": {
  "de": {
    "description": {
      "short": "Pull Requests und Checks an ihren Issues.",
      "about": "about.de.md"
    }
  }
},
"links": [
  { "kind": "docs", "url": "https://docs.acme.dev/gantt" },
  { "kind": "issues", "url": "https://github.com/acme/gantt/issues" },
  { "kind": "github", "url": "https://github.com/acme/gantt" },
  { "kind": "discord", "url": "https://discord.gg/acme" }
]
```

| `kind` | Shown as |
| --- | --- |
| `docs`, `changelog`, `issues`, then `homepage`, `support`, `privacy`, `terms` | a row each, always in this order, with a label (or your `title`, up to 60 characters) and the address's host. A kind you don't link isn't shown. |
| `github`, `gitlab`, `discord`, `slack`, `matrix`, `mastodon`, `bluesky`, `x`, `youtube`, `linkedin` | below the rows, past a line: one as a row like the others, two or more as a centered row of icon buttons |

`https` only, each address once. Both fields need Barynt 1.1.0-beta.5 or
later — set `minBaryntVersion` accordingly, an older Barynt refuses the
manifest. `description` as `{ short, about }` needs a Barynt released after
1.1.0-beta.5; it's the only form Barynt takes — a plain string, or `about`
beside `description`, is refused.

## Translations

The manifest is written in English, and English is what Barynt shows when a
language has no text of its own. `locales.<lang>` (`de`) holds only what
differs: the description (above), and the texts of the plugin's
contributions and previews, **by id**:

```json
"locales": {
  "de": {
    "contributes": {
      "actions": { "create-branch": "Branch erstellen" },
      "issuePanels": { "development": "Entwicklung" },
      "settings": {
        "branchPattern": { "label": "Branch-Name", "description": "{key} ist der Schlüssel des Issues." },
        "mode": { "label": "Modus", "options": { "fast": "Schnell" } }
      },
      "credentials": { "token": "Token" },
      "inboundHooks": { "github": { "title": "GitHub-Repository", "rules": { "merged": "Wenn ein Pull Request gemergt wird" } } }
    },
    "previews": { "preview-1.webp": "Pull Requests auf dem Board" }
  }
}
```

- Under `contributes`, a list of the manifest (`actions`, `settings` …) maps
  an item's `id` — a setting's or credential's `key` — to its texts.
- A string translates the item's main text: its `title`, else its `label`.
  An object names them: `title`, `label`, `description`, `hint`, and
  `options`, `rules` or `suggestions` — those by their `id` again, the same
  way.
- `previews` maps a file to its caption.
- Anything left out stays English, so a language can grow bit by bit.
- `fields` can't be translated: a custom field becomes the project's own,
  with one name for everyone.

Barynt checks them like the rest: an id, a text or an option the manifest
doesn't have is refused with where it is (most likely a typo, which would
otherwise just stay English), and each text keeps its limit (60 characters
for a title or label, 300 for a description).

What the plugin draws itself in its frame isn't in the manifest — translate
that with the SDK's [`translator()`](plugins-sdk.md#translations).

## Capabilities

| Capability | Shown as | What it allows |
| --- | --- | --- |
| `issues:read` | Read issues | `issues.list`, `issues.get` |
| `issues:write` | Create and change issues | `issues.create`, `issues.update` |
| `comments:read` | Read comments | `comments.list` |
| `comments:write` | Write comments | `comments.create` |
| `labels:read` | Read labels | `labels.list` |
| `projects:read` | Read projects | `projects.list` |
| `members:read` | See members | `members.list` |
| `fields:read` | Read custom fields | `fields.list` |
| `fields:write` | Change custom field values | `customFields` in `issues.create`/`issues.update`; needed for `contributes.fields` |
| `storage:own` | Keep its own data | `storage.*` |
| `notify:send` | Send notifications | reserved, not callable yet |
| `events:issue` | Hear about issue changes | `issue.*` and `label.*` in [`service.events`](#its-server) |
| `events:comment` | Hear about comments | `comment.*` in `service.events` |
| `events:project` | Hear about project changes | `project.*` in `service.events` |
| `events:member` | Hear about people joining and leaving | `member.*` in `service.events` |
| `webhooks:receive` | Receive webhooks from other services | `contributes.inboundHooks` |
| `ui:project-view` | Add a project view | `contributes.projectViews` |
| `ui:nav-item` | Add an entry to the sidebar | `contributes.navItems` |
| `ui:dashboard-widget` | Add a dashboard widget | `contributes.dashboardWidgets`, `contributes.widgetTemplates`, `contributes.widgetBlocks` |
| `ui:issue-panel` | Add a panel to issues | `contributes.issuePanels` |
| `ui:issue-badge` | Show badges on cards and rows | `contributes.issueBadges` |
| `ui:action` | Add actions and commands | `contributes.actions` |

Which call needs which capability, and what it returns, is in
[Host API](plugins-host-api.md).

## Contributions

`contributes` says what the plugin adds. Each kind of contribution needs its
capability, and each entry an `id` that's unique in its list.

| Key | Entries | Needs | Kinds |
| --- | --- | --- | --- |
| `projectViews` | `{ id, title, icon? }`, up to 5 | `ui:project-view` | sandbox |
| `navItems` | `{ id, title, icon? }`, up to 5 | `ui:nav-item` | sandbox |
| `dashboardWidgets` | `{ id, title, icon? }`, up to 5 | `ui:dashboard-widget` | sandbox |
| `widgetTemplates` | [widget templates](#widget-templates), up to 10 | `ui:dashboard-widget` | all |
| `widgetBlocks` | [building blocks](#building-blocks), up to 10 | `ui:dashboard-widget` | sandbox |
| `issuePanels` | `{ id, title, icon? }`, up to 5 | `ui:issue-panel` | sandbox |
| `issueBadges` | `{ id, title, icon? }`, up to 5 | `ui:issue-badge` | sandbox, declarative |
| `actions` | `{ id, title, icon?, where?, confirm?, danger? }`, up to 20 — see [Actions](#actions) | `ui:action` | sandbox |
| `fields` | custom fields, up to 20 | `fields:write` | all |
| `settings` | settings, up to 30 | — | all |
| `credentials` | credentials, up to 10 | a host in `network` | sandbox |
| `connections` | [connections](#connections), `{ id, title, provider }`, up to 3 | the provider's API host in `network` | sandbox |

`icon` is an [Iconify](https://icon-sets.iconify.design) name like
`lucide:clock`.

### Where they show

| Contribution | Switched on in a project | Switched on in the workspace |
| --- | --- | --- |
| `projectViews` | in the sidebar under the project, next to its Dashboard, Board and Issues | in the sidebar's main group, next to the workspace's Dashboard and Board (on a phone, whose main group is the bottom bar: in the "Plugins" section) |
| `navItems` | in the sidebar under the project, below a "Plugins" heading | in the sidebar's own "Plugins" section |
| `dashboardWidgets`, `widgetTemplates` | in the project's dashboard's widget gallery, under "Plugins" | in the workspace's (and its views') dashboard gallery, under "Plugins" |
| `issuePanels` | in every issue of the project — side panel, dialog, page, phone sheet — below the attachments; with `"placement": "sidebar"` a section of the issue's sidebar, next to its fields | — (a workspace plugin has no issue panels) |
| `issueBadges` | on the project's board cards and list rows (the list's "Fields" column); each can be hidden in **Display** | — |

Each entry carries the plugin's mark, and its page names the plugin under
the title, so it's always clear what comes from a plugin. `icon` isn't
shown yet.

A widget is added like any other: **Add widget**, then the plugin's entry
in the gallery, in the sizes S, M, L, T and XL. Its frame fills the widget
below Barynt's header. If the plugin is switched off later, the widget says
so instead of staying empty.

An issue panel is a section of its own in the issue, after the attachments,
headed by the panel's title and the plugin's name. People can fold it; only
an open panel has a frame, and it stays folded for them. The frame grows to
its content's height (up to 640 px, then it scrolls), so draw what you need
and no more. See [`registerIssuePanel()`](plugins-sdk.md#registerissuepanel).

An issue panel can also live in the **sidebar**, next to the issue's
properties, labels and custom fields — "Development" with a branch, a merge
request and a pipeline, say:

```json
"issuePanels": [{ "id": "development", "title": "Development", "placement": "sidebar" }]
```

There it's headed like the sidebar's own sections (the title, the plugin's
name on the right) and has no box of its own. Where an issue has no sidebar
— the side panel, a phone — it sits with the properties.

A badge is a small chip on a card or row — "in 3d", "MR open" — or a row
across the card that you put together from parts (a merge request's number,
state and pipeline). You don't
draw it: Barynt runs one hidden frame per plugin and board, hands it the
issues shown in batches, and draws the chips you return with its own
components — at most 3 per issue from you, the rest as "+N", texts short,
icons only from a fixed set. Each entry in `issueBadges` is one switch in
**Display**, so people can hide what they don't need. See
[`registerBadges()`](plugins-sdk.md#registerbadges). Only a `sandbox`
plugin fills badges for now.

### Actions

An action is an entry people pick for an issue: in its **"…" menu**, in a
**card's quick actions** (a long press on a phone or tablet) and in the
**command palette** while an issue is open. Barynt runs it in the plugin's
hidden frame and shows what it answers as a toast.

```json
"actions": [
  { "id": "rerun", "title": "Re-run pipeline", "icon": "lucide:rocket" },
  { "id": "close-mr", "title": "Close merge request", "icon": "lucide:circle-x",
    "where": ["issueMenu"], "confirm": "It's closed in GitLab; the issue stays.", "danger": true }
]
```

| Field | |
| --- | --- |
| `where` | `issueMenu`, `cardMenu`, `commandPalette` — every place by default |
| `confirm` | up to 120 characters: Barynt asks this first, and runs the action only on yes |
| `danger` | the question's button is red |
| `icon` | one of the badge icons (`lucide:rocket`, `lucide:git-pull-request` …); any other shows the puzzle |

What the action does, it does through the [host API](plugins-host-api.md)
— with the capabilities that were confirmed, and in the audit log like
everything a plugin does. See [`registerAction()`](plugins-sdk.md#registeraction).

### Building blocks

A building block is smaller than a widget: people put it into their own
custom widgets — next to Barynt's blocks (a number, a list …), several in
one widget if they like. In the builder, **Add block** lists the blocks of
the plugins switched on there.

```json
"widgetBlocks": [
  {
    "id": "due-soon",
    "title": "Due soon",
    "description": "Open issues due in the next days.",
    "settings": [{ "key": "days", "type": "number", "label": "Days ahead", "default": 7 }]
  },
  { "id": "done-ring", "title": "Done", "draw": "plugin" }
]
```

| Field | |
| --- | --- |
| `id`, `title`, `icon` | Like every entry. |
| `description` | Optional, up to 200 characters — in the builder. |
| `draw` | `barynt` (default): you hand over data, Barynt draws it like its own blocks. `plugin`: you draw it in a frame of your own. |
| `settings` | Up to 10, set per block in the builder: `text`, `number`, `boolean` or `select`, written like [settings](#settings). The plugin gets them in `context.config`. |

With `draw: "barynt"` your code still runs — out of sight — and hands
over one of four shapes: a number, a list, bars or a progress; see
[`registerBlock()`](plugins-sdk.md#registerblock). That's the default
because it looks like the rest of the widget at every size. If the plugin
is switched off, the block says so; the widget's other blocks stay.

A [widget template](#widget-templates) can bring a plugin's block too:
`{ "type": "pluginBlock", "config": { "pluginId": "…", "pluginBlock": "due-soon" } }`.

### Widget templates

A plugin doesn't have to draw a widget itself. `widgetTemplates` are
dashboard widgets made of the same building blocks as a custom widget —
Barynt draws them, with no frame and no code, so any kind of plugin can
bring them, a `declarative` one too. They count Barynt's issues; for your
own data, draw the widget yourself (`dashboardWidgets`).

```json
"widgetTemplates": [
  {
    "id": "overdue",
    "title": "Overdue",
    "description": "How many are late, and which.",
    "size": "L",
    "accent": "red",
    "blocks": [
      { "type": "kpi", "config": { "metric": "overdue", "elements": [{ "id": "trend", "kind": "trend" }] } },
      {
        "type": "issues",
        "config": {
          "sort": "dueDate",
          "filter": { "op": "and", "rules": [{ "field": "dueDate", "is": "before", "value": "today" }] },
          "elements": [{ "id": "rows", "kind": "rows", "value": 4 }]
        }
      }
    ]
  }
]
```

| Field | |
| --- | --- |
| `id`, `title` | Like every entry; `id` mustn't be one of the plugin's `dashboardWidgets`. |
| `description` | Optional, up to 200 characters. |
| `size` | `S`, `M`, `L` (default), `T` or `XL` — what it starts with. |
| `accent` | Optional colour: `blue`, `teal`, `green`, `lime`, `ochre`, `amber`, `orange`, `red`, `pink`, `purple`, `indigo`, `gray`. |
| `blocks` | 1 to 6 blocks, top to bottom: `type` is `kpi`, `progress`, `distribution`, `flow`, `matrix` or `issues`; `config` what a block in the builder sets (`metric`, `groupBy`, `chart`, `sort`, `filter`, `elements` …). Barynt numbers the blocks. |

The `config` is checked with the same rules as a custom widget the builder
saves (`features/dashboard/widgets.ts`) — the quickest way to one is to
build it in the builder and copy its blocks. A filter only uses what's the
same everywhere (status categories, priorities, dates); ids of statuses,
labels or people differ between workspaces.

In the gallery a template shows with the workspace's real numbers. **Add**
puts it on the dashboard as the dashboard's own custom widget — it stays
when the plugin is switched off, and it's changed like any other.
**Customize** opens it in the builder first.

### Settings

Settings get a form in Barynt — in the project's or workspace's settings,
under **Plugins** — and the plugin reads them with
[`loadSettings()`](plugins-sdk.md#loadsettings).

```json
{ "key": "channel", "type": "text", "label": "Channel", "description": "Where to post, e.g. #dev." }
```

| Field | Meaning |
| --- | --- |
| `key` | Starts with a letter: letters, digits, `_`, up to 40 characters. |
| `type` | One of the types below. |
| `label` | Up to 60 characters. |
| `description` | Optional, up to 300 characters, shown under the field. |
| `group` | Optional, up to 60 characters: the heading it's shown under. Settings in a row with the same `group` share one heading. |
| `default` | Optional: a string, number or boolean — for `select` an option's `id`, for `multiselect` a list of them. |
| `options` | For `select` and `multiselect` only, and required there: `{ id, label }`, up to 50. |
| `suggestions` | For `text` only: ready-made values, up to 10 — `{ id, value, label, hint? }`. Barynt shows them in a menu beside the field (**Suggestions**); picking one fills it in, and the field stays free to type. `hint` (up to 120 characters) is an example of what the value gives: the menu shows it, and while the field holds that value, Barynt shows it under the field as **Example:** instead of the description. |

| Type | Barynt draws | The plugin gets |
| --- | --- | --- |
| `text` | a text field | a string, trimmed, up to 2000 characters |
| `textarea` | a multi-line text field | a string, trimmed, up to 10,000 characters |
| `number` | a number field | a number |
| `boolean` | a switch | `true` or `false` |
| `url` | an address field | an `http(s)` address |
| `select` | a choice of one of `options` | the option's `id` |
| `multiselect` | a chip per option, any number chosen | a list of option `id`s |
| `member` | a choice of the place's people — the project's members, or the workspace's | a user id |
| `label` | a choice of the place's labels — the ones the project shows, or the workspace's own | a label id |
| `status` | a choice of the workspace's statuses, in board order — in a project too | a status id |
| `repositories` | the repositories the place's [connections](#connections) reach, to tick — or, without one, a field for `owner/name` per line | a list of `owner/name` (up to 50) |

Barynt checks what's saved against these types — a `member`, `label` or
`status` against the people, labels and statuses of that place, when it's
saved. Something
left empty isn't stored, so the plugin falls back to its default.

The settings search finds each field by its `label`, and a
[credential](#credentials) by its own, wherever the plugin runs. A hit opens
the plugin's page there and shows the field. A plugin that draws its whole
page itself (`settingsPage: true`) is found by its name only. So a label
should say what the setting is about in words people would search for.

### Its own settings page

With `"settingsPage": true` in `contributes`, the plugin's page in the
workspace's or project's settings shows the plugin's own frame instead of
Barynt's form — for settings that need more than fields.

```json
"contributes": {
  "settings": [{ "key": "gitlabProject", "type": "text", "label": "GitLab project" }],
  "settingsPage": "section"
}
```

Often Barynt's form is enough, and you only want **something below it**: a
connection check, a preview, a picker that asks your service. Then use
`"settingsPage": "section"` — Barynt draws the form of `settings` as usual,
and the plugin's frame below it.

| `settingsPage` | Shows |
| --- | --- |
| `true` | the plugin's frame instead of Barynt's form |
| `"section"` | Barynt's form, and the plugin's frame below it |

Both are drawn with [`registerSettings()`](plugins-sdk.md#registersettings);
the [UI kit](plugins-sdk.md#the-ui-kit) has the inputs. The values are still
the ones in `settings`: the frame reads them with `loadSettings()` and saves
them with `api.settings.set(values)`, and Barynt checks them as it does its
own form. So `settingsPage` needs `settings`, and only a `sandbox` plugin
has it. Credentials stay on Barynt's side of the page, never in the frame.

### Credentials

A credential is a secret the plugin needs for one of its hosts — an access
token for a Git host, an API key. People keep it in Barynt; Barynt adds it
to the plugin's requests to that host itself. **The plugin never sees it.**

```json
"network": ["gitlab.acme.example"],
"contributes": {
  "credentials": [
    {
      "key": "token",
      "label": "Personal access token",
      "description": "With read_api scope.",
      "level": "user",
      "host": "gitlab.acme.example",
      "header": "PRIVATE-TOKEN",
      "format": "{value}"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `key` | Starts with a letter: letters, digits, `_`, up to 40 characters. |
| `label` | Up to 60 characters, shown above the field. |
| `description` | Optional, up to 300 characters. |
| `level` | Who keeps it, and for whom it counts: `workspace` (a workspace manager, once for the workspace — the plugin needs the `workspace` level), `project` (a project admin, per project — needs `project`), or `user` (each person their own, in their personal settings). |
| `host` | The host it's sent to. Must be in `network`. |
| `header` | The header it goes in. `Authorization` by default; not `Cookie`, `Host`, `Content-Length` or `Transfer-Encoding`. |
| `format` | How the value is written into the header, with `{value}` where it goes. `Bearer {value}` by default. |

Every request to `host` gets the header. If a credential the host needs
isn't kept, the request is refused with `credential_missing` — tell the
person where to keep it (see [Host API](plugins-host-api.md#netfetch)).

### Connections

A connection links a workspace or project to an account at another service
— so far **GitHub**, through the instance's own GitHub App (BARY-238).
Instead of everyone keeping a token, a workspace or project admin clicks
**Connect GitHub** in the plugin's settings, installs the app on an
organization there (picking its repositories on GitHub) and is back. A
workspace's connection counts in every project of it.

```json
"network": ["api.github.com"],
"contributes": {
  "connections": [{ "id": "github", "title": "GitHub", "provider": "github" }],
  "settings": [{ "key": "repositories", "type": "repositories", "label": "Repositories" }]
}
```

- A `repositories` setting lists what the place's connections reach; the
  project ticks the ones it works with. It needs a connection.
- A request to `api.github.com/repos/{owner}/{name}/…` of a **ticked**
  repository goes with the token of the connection on that owner —
  unless the person keeps a credential of their own for the host, which
  wins. Anything else (another repository, `/user`, GraphQL) goes without
  the connection's token: a person sees no more of GitHub through the plugin
  than the place's admins picked.
- GitHub's webhooks reach Barynt through the app itself. A `link` hook of
  `provider: "github"` gets every call about a ticked repository, in each
  project connected to its installation — nobody adds a webhook per
  repository. A repository's own webhook to the hook's address still works.
- The platform admin creates the app once, in the plugin's page under
  **Admin → Plugins** (GitHub's manifest flow), or sets `GITHUB_APP_ID`,
  `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`,
  `GITHUB_APP_PRIVATE_KEY` and `GITHUB_APP_WEBHOOK_SECRET`.

### Custom fields

A plugin can bring custom fields its issues carry:

```json
{ "key": "estimate", "name": "Estimate", "type": "NUMBER" }
```

`type` is one of `TEXT`, `NUMBER`, `DATE`, `SELECT`, `MULTI_SELECT`,
`CHECKBOX`, `URL`, `USER`. `SELECT` and `MULTI_SELECT` need `options`
(`{ id, label, color? }`, up to 50), the others must not have them.

## Its server

A `service` plugin — or a `sandbox` plugin that also keeps something running
in the background — names its own server, and Barynt sends it events there:

```json
{
  "kind": "service",
  "capabilities": ["issues:read", "events:issue", "events:member"],
  "network": ["ci.acme.dev"],
  "service": {
    "url": "https://ci.acme.dev/barynt/events",
    "events": ["issue.status_changed", "member.added"]
  }
}
```

- `address` says who runs the server and so who gives its address — your
  choice as its maker:

  | `address` | Who runs it | Where the address comes from |
  | --- | --- | --- |
  | `fixed` (default) | you, one server for every Barynt | `url`, its host in `network` |
  | `platform` | whoever runs that Barynt — a container beside it, say | the platform admin, under **Admin → Plugins**, or `PLUGIN_SERVICE_URLS` |
  | `activation` | whoever switches it on, for that workspace or project alone | its settings there |

  For `platform` and `activation`, `url` is optional and only suggested in
  the form; its host needn't be in `network`. Until someone gives an address
  the plugin runs without its server — no `app.installed`, no events. A new
  address gets `app.installed` with a new secret and token; the server
  before stops being able to read anything. **Test connection** in the
  plugin's settings sends `app.installed` again.
- A `fixed` `url` is `https`, its host in `network`. Only `http://localhost` or
  `http://127.0.0.1` may be plain — for building on your own machine; Barynt
  reaches it only in development (`PLUGIN_DEV_BASE`). An address given for
  `activation` is `https` too, unless its host is in `PLUGIN_INTERNAL_HOSTS`;
  one the operator gives (`platform`) may be plain `http` to a host on the
  private network — they run both.
- `events` are the [webhook events](../guide/en/api-reference/webhook-events.md)
  except `view.*`; each needs its capability (`issue.*` and `label.*` →
  `events:issue`, `comment.*` → `events:comment`, `project.*` →
  `events:project`, `member.*` → `events:member`).

**What arrives** is a signed `POST`, the same envelope and headers as a
workspace webhook (`X-Barynt-Event`, `X-Barynt-Delivery`, `X-Barynt-Attempt`,
`X-Barynt-Timestamp`, `X-Barynt-Signature`), retried the same way. Each
installation — the plugin switched on in a workspace or project — has its own
secret:

1. When it's switched on, Barynt sends **`app.installed`** with
   `data: { installationId, pluginId, baryntUrl, secret, token, botUserId }`. Keep the secret
   per `installationId`; every later message is signed with it. Switched on
   again later, the same message comes again with the same secret. Barynt
   keeps the secret sealed; the delivery log shows `[sealed]` in its place.
2. Then the events it subscribed to, as they happen.
3. When it's switched off, **`app.uninstalled`** with
   `data: { installationId, pluginId, baryntUrl }` — no secret.

What a server gets of an event follows what was confirmed: without
`issues:read` an issue is only `{ id, ref, projectId }` and has no `changes`;
without `comments:read` a comment has no `body`. A project's installation hears
only about its project, a workspace's never about a private project, and a
change the plugin made itself doesn't come back to it.

**Acting in Barynt** (BARY-213): `token` is an app token (`bpa_…`) for the
[REST API](../guide/en/integrations/api.md), `Authorization: Bearer <token>`.
It acts as the plugin's bot — "<Plugin name> (App)", shown so on every comment
or change it makes — not as a person. The bot is no member and can't sign in;
what it may do comes from the capabilities confirmed for this installation:

| Capability | The bot may |
| --- | --- |
| any `…:read`/`…:write` | see the projects it's switched on for |
| `issues:write` | create, change and assign issues |
| `fields:write` | change custom field values (by changing the issue) |
| `comments:write` | write comments, change and delete its own |
| `members:read` | see the workspace's members |

Never anything that manages: roles, members, settings, plugins, deleting
issues. A workspace's bot sees the workspace's public projects, never a private one;
a project's bot only its project. Each
time the plugin is switched on, a new token comes with `app.installed` and the
one before stops; switched off, its token stops at once.

**Acting for a person** (BARY-214): an event a person caused carries
`acting: { token, userId, expiresAt }` — a token (`bpt_…`) to act for exactly
that person, for 15 minutes. It can do what the person may **and** the plugin
may (its capabilities, its workspace or project, no private projects for a
workspace's plugin) — never more than either. What it changes shows as theirs,
"Ada via GitLab" in the activity log. It's made fresh for each attempt and
never stored; an event an app caused, or one with no person behind it, has
none. Use it to read what the person sees; use the app token to act as the
plugin itself.

Every message to a server also carries `X-Barynt-Installation`: which
installation it's for — the secret to check it with. The SDK's
[`createService`](plugins-sdk.md#a-plugins-server) does all of this.

A server that fails for a day is **paused**, not switched off: Barynt stops
sending, logs it, and the plugin's settings show it with **Send again**. The
settings also show the log of deliveries. Answer with a `2xx` within ten
seconds, and skip an `X-Barynt-Delivery` you've already handled.

## Webhooks from other services

A plugin can take webhooks another service sends — GitLab, GitHub — through
Barynt, without anyone pointing that service at the plugin's own server:

```json
"capabilities": ["webhooks:receive"],
"contributes": {
  "inboundHooks": [
    { "id": "gitlab", "title": "GitLab project", "provider": "gitlab", "handle": "forward" }
  ]
}
```

- When the plugin is switched on, each hook gets an address
  (`/api/plugins/hooks/<token>`, unguessable) and a secret. Its settings show
  both, with how to enter them at the provider, and what came last.
- `provider` decides how a call is checked: **GitHub** and **generic** sign
  the body (`X-Hub-Signature-256: sha256=<HMAC-SHA256>`), **GitLab** sends the
  secret as `X-Gitlab-Token`. Anything else is refused (401). At most 1 MB,
  120 calls a minute per hook; a provider's retry (same `X-GitHub-Delivery` /
  `X-Gitlab-Event-UUID`) is taken once. Barynt answers 202 at once.
- `handle: "forward"` hands the call to the plugin's [server](#its-server), as
  the event `inbound.<id>` with `data: { hook, provider, providerEvent,
  deliveryId, headers, body }` — signed, retried and logged like any event.
  It needs `service`. The provider's secret is never passed on.
- With `forward`, what a call means — which issue a merge request belongs
  to — is the plugin's to work out; its server keeps the result on the issue
  (`PUT /api/v1/issues/{id}/plugin-data/{key}`) and its frames show it with
  [`api.issueData.list`](plugins-host-api.md#what-it-keeps-on-issues).

### `handle: "link"` — Barynt reads the call

For `provider: "github"`, Barynt can read the call itself, with no server:
it finds the issue keys of the projects the plugin runs in (`WEB-42` in a
branch name, a title, a description, a commit message — `web-42-fix` and
`WEB_42` count too) and keeps one entry per pull request, branch, commit
and checks on each of those issues, as the plugin's data. Boards and open
issues showing the plugin ask it again on their own.

```json
"inboundHooks": [
  { "id": "github", "title": "GitHub repository", "provider": "github", "handle": "link" }
]
```

| GitHub event | Entry (`value.kind`) | Key |
| --- | --- | --- |
| `pull_request`, `pull_request_review` | `pull_request`: `repo`, `number`, `title`, `state` (`draft`/`open`/`merged`/`closed`), `review` (`approved`/`changes_requested`/`null`), `url`, `branch`, `base`, `author`, `additions`, `deletions` | `pr:<owner>:<repo>:<number>` |
| `create`, `delete` (branches), `push` deleting one | `branch`: `repo`, `name`, `url`, `deleted` | `branch:<owner>:<repo>:<hash>` |
| `push` | `commit`: `repo`, `sha`, `message` (first line), `url`, `author`, `branch` — the last 20 | `commit:<owner>:<repo>:<sha12>` |
| `check_run`, `check_suite` | `checks`: `repo`, `branch`, `sha`, `state` (`pending`/`success`/`failure`/`neutral`), `runs` (`name`, `state`, `url`) | `checks:<owner>:<repo>:<hash>` |

Every entry has `at`, the time of the call. A review is kept on its pull
request until another one decides; check runs gather by name until a new
commit starts them over. `link` reads GitHub only so far — GitLab comes
next.

#### Rules

A `link` hook can name rules — what Barynt may do with an issue when a pull
request that works on it takes a step, the checks on its branch fail, or
it's deployed.
Each project that switches the plugin on picks, per rule, the status to set
(any of the workspace's), or leaves it off, and may limit the pull
request's rules to target branches (`main, release/*`; none: all). The
settings page shows them in a section each — _Pull requests_, _Checks &
Actions_ and _Deployments_ — saved with its Save button. A deployment
names the issue by its branch (a preview); for one of `main`, a GitHub
connection's app finds the issues the shipped commits close — merges since
the environment's deployment before, and pull requests Barynt keeps whose
merge commit is among them. With a connection, a place can also have
Barynt comment the issues on the pull request (`_prComment`). Barynt sets the status as the
plugin's app and, with `comments:write`, comments why. Rules need
`issues:write`.

```json
"capabilities": ["issues:read", "issues:write", "comments:write", "webhooks:receive"],
"inboundHooks": [{
  "id": "github", "title": "GitHub repository", "provider": "github", "handle": "link",
  "rules": [
    { "id": "opened", "title": "When a pull request is opened", "on": "pull_request.opened" },
    { "id": "merged", "title": "When a pull request is merged", "on": "pull_request.merged" }
  ]
}]
```

| `on` | When |
| --- | --- |
| `pull_request.draft` | opened as a draft, or turned back into one |
| `pull_request.opened` | opened (not as a draft), or a draft marked ready |
| `pull_request.review_requested` | a review asked for |
| `pull_request.approved` | a review approved it |
| `pull_request.changes_requested` | a review asked for changes |
| `pull_request.merged` | merged |
| `pull_request.closed` | closed without merging |
| `checks.failed` | a check on the branch failed — GitHub Actions or any other (the branch's name carries the key) |
| `deployment.test` | deployed successfully to an environment GitHub doesn't mark as production (staging, a preview) |
| `deployment.production` | deployed successfully to production |

A rule moves an issue only when the pull request works on it: its key is
in the branch's name, or follows *fixes*, *closes* or *resolves* in the
title or description (`Fixes WEB-42`, `closes WEB-7, WEB-8 and WEB-9`). A
key only named elsewhere links the pull request and nothing more. An issue
already in the status stays as it is.

## Rules Barynt checks

- Each contribution needs its capability (`projectViews` → `ui:project-view`,
  `fields` → `fields:write` …).
- A `declarative` plugin has no code and no `network`; it may only contribute
  `fields`, `settings`, `issueBadges` and `widgetTemplates`.
- A `service` plugin has no browser surface; it may only contribute `fields`,
  `settings` and `widgetTemplates`.
- A widget template's blocks follow the custom widget's rules.
- `widgetBlocks` need a `sandbox` plugin; their settings are `text`,
  `number`, `boolean` or `select`, keys unique within a block.
- `settingsPage` needs `settings`, and only a `sandbox` plugin has it.
- A credential's `host` is in `network`, and a `workspace` or `project`
  credential matches one of the plugin's `levels`.
- A connection's API host (`api.github.com`) is in `network`, one connection
  per provider; a `repositories` setting needs a connection and has no
  default.
- Ids are unique within each list; `select` and `multiselect` settings and
  choice fields need options, other types must not have them; only a
  `multiselect`'s default is a list.
- `maxBaryntVersion` isn't lower than `minBaryntVersion`.
- [Translations](#translations) name only ids, texts and options the
  manifest has, within their limits; `fields` aren't translated.
- `service` isn't for a `declarative` plugin; its `url` is `https` on a host
  in `network` (or local `http`), each of its `events` once and with its
  capability.
- The release's manifest must have the same `id`, `version`, `kind` and
  `levels` as its [directory entry](plugins-publishing.md#the-directory-entry).
