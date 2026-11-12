---
title: Host API
description: Every call a sandboxed plugin can make, the capability it needs, what it takes and returns, and the errors.
sidebar:
  order: 5
---

A sandboxed plugin reaches Barynt only through its host. With the
[SDK](sdk.md) that's `this.api`; underneath, each call is a method of the
host API, sent to Barynt's server and checked there:

1. The method exists.
2. The person is within the plugin's budget (300 calls a minute).
3. The plugin is switched on in this place, in an installed, unblocked
   version.
4. The method's **capability** was confirmed here — not just listed in the
   manifest.
5. The **person** may do it. Barynt runs the same checks as for its REST
   API: a plugin can never see or change more than the person whose session
   it runs in.

## Where a plugin works

- A **project's** plugin works in its own project. Asking for another one is
  refused with `forbidden`; an issue elsewhere is `not_found`.
- A **workspace's** plugin works in the workspace's projects the person can
  see.

`projectId` in the params below defaults to the plugin's own project.

## In someone's name

What a plugin writes, it writes as the person: an issue or comment shows as
theirs, like anything they wrote in Barynt. Which plugin did it is in the
audit log — every change shows there as "Plugin changed something in their
name", with the plugin and the person.

## Issues

### `issues.list`

Needs `issues:read`. `api.issues.list(params?)`

| Param | Type | Meaning |
| --- | --- | --- |
| `projectId` | `string?` | Defaults to the plugin's project. |
| `q` | `string?` | Text in title or description. |
| `status` | `string?` | A status key. |
| `take` | `number?` | 1 to 100, default 50. |
| `cursor` | `string?` | `nextCursor` of the page before. |

Returns `{ issues: Issue[], nextCursor: string | null }`, newest first.

```ts
let cursor: string | undefined;
do {
  const page = await this.api.issues.list({ take: 100, cursor });
  handle(page.issues);
  cursor = page.nextCursor ?? undefined;
} while (cursor);
```

### `issues.get`

Needs `issues:read`. `api.issues.get(id)` — `id` is the issue's id or its
`PREFIX-123`. Returns the `Issue`.

### `issues.create`

Needs `issues:write`. `api.issues.create(input)`

`input` takes `title` (required), `projectId?`, and the fields of the REST
API's `POST /api/v1/projects/:id/issues`: `description` (Markdown),
`status`, `priority`, `assignee`, `labels`, `type`, `parentId`, `dueDate`,
`storyPoints`, `customFields`. Setting `customFields` needs `fields:write`
too. Returns the new `Issue`.

### `issues.update`

Needs `issues:write`. `api.issues.update(id, patch)` — `patch` takes the
fields of `PATCH /api/v1/issues/:id`. Returns `{ id }`.

## Comments

### `comments.list`

Needs `comments:read`. `api.comments.list(issueId)` — the issue's comments,
oldest first.

### `comments.create`

Needs `comments:write`. `api.comments.create(issueId, body, parentId?)` —
`body` is Markdown, up to 20,000 characters; `parentId` answers a comment.
Returns the `Comment`.

## Workspace data

| Call | Needs | Returns |
| --- | --- | --- |
| `api.labels.list({ projectId? })` | `labels:read` | The workspace's labels and the project's. |
| `api.projects.list()` | `projects:read` | The projects the plugin works in that the person can see. |
| `api.members.list({ projectId? })` | `members:read` | The project's members — or, for a workspace's plugin without `projectId`, the workspace's. |
| `api.fields.list({ projectId? })` | `fields:read` | The project's custom fields. |

## Storage

Needs `storage:own`. The plugin's own key–value store, **per place**: a
project's data is that project's, kept when the plugin is switched off,
gone when someone deletes the plugin's data.

| Call | Meaning |
| --- | --- |
| `api.storage.get<T>(key)` | The value, or `null`. |
| `api.storage.set(key, value)` | Stores any JSON value. |
| `api.storage.delete(key)` | Removes it. |
| `api.storage.list()` | All keys, sorted. |

| Limit | |
| --- | --- |
| Key | up to 128 characters |
| One value | up to 64 KB as JSON |
| Keys | up to 500 |
| All values | up to 1 MB as JSON |

Over a limit, `set` is refused with `storage_full`.

## Settings

`api.settings.get()` (or [`loadSettings()`](sdk.md#loadsettings)) needs no
capability: the plugin's own [settings](manifest.md#settings) in this
place, each with its saved value or its default.

## Errors

| Code | Means |
| --- | --- |
| `unknown_method` | There's no such method. |
| `invalid_params` | A parameter is missing or doesn't fit (e.g. an issue without a title). |
| `not_active` | The plugin isn't switched on here, is blocked, or the person can't see this place. |
| `capability_not_confirmed` | The capability isn't confirmed here — maybe after an update that asks for more. |
| `forbidden` | Outside the plugin's place, or the person may not do it. |
| `not_found` | It doesn't exist, or the person can't see it. |
| `storage_full` | Over a [storage](#storage) limit. |
| `timeout` | No answer within 15 seconds. |
| `too_many_requests` | Over the budget: 300 calls per person and minute, or 20 open at once. |

## Coming next

Calls to your own servers through Barynt (`network` in the manifest), with
credentials Barynt keeps; events (`events:issue`, `events:comment`); and
notifications (`notify:send`). The capabilities exist already; the calls
come in the next releases.
