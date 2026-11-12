# Running a sandboxed plugin

A plugin of `kind: "sandbox"` runs its `main.js` in the browser, inside a
sandbox Barynt sets up for it (BARY-144). This page is for plugin authors:
what the code gets, and what it can't do.

## What runs where

- The plugin's frame is a document with an **opaque origin**: no Barynt
  cookies, no `localStorage`, no network (`connect-src 'none'`), no scripts
  from anywhere. `main.js` and `styles.css` come inline with the document.
- `main.js` is an ES module. Its **default export** is a class; Barynt
  creates it with a `host` object and calls `onload()` (and `onunload()`
  when the frame goes away).
- The only way to data is **`host.call(method, params)`**. Barynt checks
  every call on the server: the plugin must be switched on in that place,
  the call's capability confirmed there, and the person whose page it is
  must be allowed to do it themselves. A plugin can never do more than
  that person.

```js
export default class Timeline {
  constructor(host) {
    this.host = host;
  }

  async onload() {
    const { issues } = await this.host.call("issues.list", { take: 50 });
    for (const issue of issues) {
      const row = document.createElement("div");
      row.textContent = `${issue.ref} ${issue.title}`;
      this.host.root.append(row);
    }
  }
}
```

## The host object

| Member | What it is |
| --- | --- |
| `host.call(method, params)` | A request to Barynt. Resolves with the result or rejects with an error code (below). At most 20 open at once, 15 seconds each. |
| `host.context` | Where it runs: `slot` (`{ kind: "projectView", id }`), `workspaceId`, `projectId`, `locale`. |
| `host.root` | The element to render into. |

Barynt's design tokens (`--surface`, `--on-surface`, `--primary`,
`--radius`, …) are set on the frame's `:root` and follow light and dark
mode, so `var(--primary)` looks like Barynt.

## Methods

| Method | Capability | Params | Result |
| --- | --- | --- | --- |
| `issues.list` | `issues:read` | `projectId?`, `q?`, `status?`, `cursor?`, `take?` (≤ 100) | `{ issues, nextCursor }` |
| `issues.get` | `issues:read` | `id` (id or `PREFIX-123`) | the issue |
| `issues.create` | `issues:write` | `projectId?`, `title`, and the fields of `POST /api/v1/projects/:id/issues` | the issue |
| `issues.update` | `issues:write` | `id`, and the fields of `PATCH /api/v1/issues/:id` | `{ id }` |
| `comments.list` | `comments:read` | `issueId` | the comments |
| `comments.create` | `comments:write` | `issueId`, `body` (Markdown), `parentId?` | the comment |
| `labels.list` | `labels:read` | `projectId?` | the workspace's labels and the project's |
| `projects.list` | `projects:read` | — | the projects it may work in |
| `members.list` | `members:read` | `projectId?` | the project's members, or the workspace's |
| `fields.list` | `fields:read` | `projectId?` | the project's custom fields |
| `storage.get` / `storage.set` / `storage.delete` / `storage.list` | `storage:own` | `key`, `value` (any JSON) | the value / — / — / the keys |
| `settings.get` | — | — | its settings in this place, defaults filled in |

A project's plugin works in its own project; a workspace's plugin in the
workspace's projects the person can see. Setting custom field values
(`customFields` in `issues.create`/`issues.update`) needs `fields:write` too.

**Storage** is the plugin's own, per place it's on in: keys up to 128
characters, a value up to 64 KB as JSON, at most 500 keys and 1 MB together.

**In someone's name.** What a plugin writes, it writes as the person whose
page it runs on, and Barynt shows it as theirs — no badge, the same as
GitHub Apps or Jira's `asUser()`. Which plugin did it is in the audit log:
every change lands there as "Plugin changed something in their name", with
the plugin and the person.

**Budget.** 300 requests per person and minute; after that the plugin gets
`too_many_requests` until the minute is over.

## Errors

`unknown_method`, `invalid_params`, `not_active`,
`capability_not_confirmed`, `forbidden`, `not_found`, `storage_full`,
`timeout`, `too_many_requests`. An error the plugin throws — or a frame
that doesn't start within 10 seconds — shows in Barynt as the plugin's
error, with a way to load it again.

## Slots

For now a sandboxed plugin fills the **project views** it declares in
`contributes.projectViews` (with `ui:project-view` confirmed). They open from
the plugin's page in the project's settings; where else plugins appear is
coming with the slots (BARY-132).
