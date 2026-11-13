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
  "description": "Issues on a time line, as a project view.",
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
| `description` | yes | One or two sentences, up to 300 characters. |
| `license` | yes | E.g. `MIT`, `Apache-2.0`, `Proprietary`. |
| `kind` | yes | `declarative`, `sandbox` or `service`, see [Building plugins](plugins.md#the-three-kinds). |
| `levels` | yes | Where it can be switched on: `workspace`, `project`, or both. |
| `capabilities` | yes | What it asks for, from the list below. Ask for as little as you need — people read this list before they say yes. |
| `network` | yes | Host names it may call through Barynt with [`net.fetch`](plugins-host-api.md#netfetch), e.g. `api.acme.example`: no scheme, port or wildcard, at most 10. `[]` for none. People see them before they switch the plugin on. |
| `contributes` | no | What it adds, see below. |
| `previews` | no | Up to 6 screenshots for the store, see [Publishing](plugins-publishing.md#screenshots). |

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
| `events:issue`, `events:comment` | Hear about changes | reserved, not callable yet |
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
| `actions` | `{ id, title, icon? }`, up to 20 | `ui:action` | sandbox |
| `fields` | custom fields, up to 20 | `fields:write` | all |
| `settings` | settings, up to 30 | — | all |
| `credentials` | credentials, up to 10 | a host in `network` | sandbox |

`icon` is an [Iconify](https://icon-sets.iconify.design) name like
`lucide:clock`.

### Where they show

| Contribution | Switched on in a project | Switched on in the workspace |
| --- | --- | --- |
| `projectViews` | in the sidebar under the project, next to its Dashboard, Board and Issues | in the sidebar's main group, next to the workspace's Dashboard and Board (on a phone, whose main group is the bottom bar: in the "Plugins" section) |
| `navItems` | in the sidebar under the project, below a "Plugins" heading | in the sidebar's own "Plugins" section |
| `dashboardWidgets`, `widgetTemplates` | in the project's dashboard's widget gallery, under "Plugins" | in the workspace's (and its views') dashboard gallery, under "Plugins" |
| `issuePanels` | in every issue of the project — side panel, dialog, page, phone sheet — below the attachments | — (a workspace plugin has no issue panels) |
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

A badge is a small chip on a card or row — "in 3d", "MR open". You don't
draw it: Barynt runs one hidden frame per plugin and board, hands it the
issues shown in batches, and draws the chips you return with its own
components — at most 3 per issue from you, the rest as "+N", texts short,
icons only from a fixed set. Each entry in `issueBadges` is one switch in
**Display**, so people can hide what they don't need. See
[`registerBadges()`](plugins-sdk.md#registerbadges). Only a `sandbox`
plugin fills badges for now.

> [!NOTE]
> Actions can be declared already; Barynt shows them in a coming release.

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
| `default` | Optional: a string, number or boolean — for `select` an option's `id`, for `multiselect` a list of them. |
| `options` | For `select` and `multiselect` only, and required there: `{ id, label }`, up to 50. |

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

Barynt checks what's saved against these types — a `member` or `label`
against the people and labels of that place, when it's saved. Something
left empty isn't stored, so the plugin falls back to its default.

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

### Custom fields

A plugin can bring custom fields its issues carry:

```json
{ "key": "estimate", "name": "Estimate", "type": "NUMBER" }
```

`type` is one of `TEXT`, `NUMBER`, `DATE`, `SELECT`, `MULTI_SELECT`,
`CHECKBOX`, `URL`, `USER`. `SELECT` and `MULTI_SELECT` need `options`
(`{ id, label, color? }`, up to 50), the others must not have them.

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
- Ids are unique within each list; `select` and `multiselect` settings and
  choice fields need options, other types must not have them; only a
  `multiselect`'s default is a list.
- `maxBaryntVersion` isn't lower than `minBaryntVersion`.
- The release's manifest must have the same `id`, `version`, `kind` and
  `levels` as its [directory entry](plugins-publishing.md#the-directory-entry).
