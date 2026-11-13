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
| `ui:dashboard-widget` | Add a dashboard widget | `contributes.dashboardWidgets` |
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

Each entry carries the plugin's mark, and its page names the plugin under
the title, so it's always clear what comes from a plugin. `icon` isn't
shown yet.

> [!NOTE]
> Dashboard widgets, issue panels, badges and actions can be declared
> already; Barynt shows them in a coming release.

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
| `type` | `text`, `number`, `boolean` or `select`. |
| `label` | Up to 60 characters. |
| `description` | Optional, up to 300 characters, shown under the field. |
| `default` | Optional: a string, number or boolean. For `select`, an option's `id`. |
| `options` | For `select` only, and required there: `{ id, label }`, up to 50. |

Barynt checks what's saved against these types; text is trimmed and at most
2000 characters.

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
  `fields`, `settings` and `issueBadges`.
- A `service` plugin has no browser surface; it may only contribute `fields`
  and `settings`.
- A credential's `host` is in `network`, and a `workspace` or `project`
  credential matches one of the plugin's `levels`.
- Ids are unique within each list; `select` settings and choice fields need
  options, other types must not have them.
- `maxBaryntVersion` isn't lower than `minBaryntVersion`.
- The release's manifest must have the same `id`, `version`, `kind` and
  `levels` as its [directory entry](plugins-publishing.md#the-directory-entry).
