# Host API

A sandboxed plugin reaches Barynt only through its host. With the
[SDK](plugins-sdk.md) that's `this.api`; underneath, each call is a method of the
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

A **workspace's** plugin without `projectId` gets the newest across the
workspace's projects the person can see — one page of up to `take`, with
`nextCursor` always `null`. Name a `projectId` to page through one.

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

`api.settings.set(values)` saves them — from its own settings page
(`settingsPage`), and only when the person may change the plugin's
settings there (`plugin.enable` in the project or workspace; otherwise
`forbidden`). Values are checked against the manifest's `settings` like
Barynt's own form (a key it doesn't declare is dropped, a wrong type — or a
`member` or `label` that isn't one of the place's — is `invalid_params`),
and the change lands in the audit log. It saves every setting at once:
send the ones you leave alone too.

`api.settings.get()` (or [`loadSettings()`](plugins-sdk.md#loadsettings)) needs no
capability: the plugin's own [settings](plugins-manifest.md#settings) in this
place, each with its saved value or its default.

## Network

### `net.fetch`

No capability — the host must be in the manifest's `network`, which people
saw before they switched the plugin on. `api.net.fetch(url, init?)`

Barynt sends the request for the plugin:

- `url` must be `https`, on a host from `network` exactly: no other host, no
  port, no user or password in the address.
- Barynt resolves the host and refuses private and local addresses — unless
  the operator let the host through (`PLUGIN_INTERNAL_HOSTS`, for a company's
  own Git server; a port is allowed there). It connects to exactly the
  address it checked, so a DNS answer that changes in between can't send the
  request elsewhere.
- It adds the [credentials](plugins-manifest.md#credentials) the manifest
  declares for that host. If one isn't kept, the request is refused with
  `credential_missing`.
- Redirects aren't followed: you get the `3xx` and its `location`, and may
  ask again — for a host you're allowed.

| `init` | Type | Meaning |
| --- | --- | --- |
| `method` | `"GET"`, `"HEAD"`, `"POST"`, `"PUT"`, `"PATCH"`, `"DELETE"` | `GET` by default. |
| `headers` | `Record<string, string>` | Only `Accept`, `Accept-Language`, `Content-Type`, `If-Match`, `If-None-Match`, `If-Modified-Since` and `X-…` headers go along; the rest are dropped. |
| `body` | `string` | Text, up to 1 MB. Not for `GET` or `HEAD`. Send JSON as `JSON.stringify(…)` with a `Content-Type`. |

The answer:

| Field | Meaning |
| --- | --- |
| `status` | The HTTP status — also `4xx` and `5xx`; they're answers, not errors. |
| `ok` | `status` from 200 to 299. |
| `headers` | `Content-Type`, `ETag`, `Last-Modified`, `Location`, `Link`, `Retry-After`, `X-Total-Count`, `X-Request-Id` and `X-RateLimit-*` — nothing else (no cookies). |
| `text` | The body, when it's text: JSON, XML, `text/*`. |
| `base64` | The body as base64 when it isn't text; `null` otherwise. |
| `json()` | `text`, parsed. |

```ts
import { BaryntError } from "@barynt/plugin-sdk";

try {
  const res = await this.api.net.fetch(
    "https://gitlab.acme.example/api/v4/merge_requests?state=opened",
  );
  if (!res.ok) throw new Error(`GitLab answered ${res.status}`);
  const mergeRequests = res.json<{ iid: number; title: string }[]>();
} catch (error) {
  if (error instanceof BaryntError && error.code === "credential_missing")
    showHint("Keep your GitLab token in your personal settings → Plugins.");
  else throw error;
}
```

Limits: 10 seconds per request, 2 MB per answer, and it counts against
the plugin's budget like every other call.

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
| `host_not_allowed` | `net.fetch` to a host or address that isn't allowed. |
| `credential_missing` | `net.fetch` to a host whose credential isn't kept. |
| `upstream_failed` | The host couldn't be reached, or its answer was over 2 MB. |
| `timeout` | No answer within 15 seconds (`net.fetch`: from the host within 10). |
| `too_many_requests` | Over the budget: 300 calls per person and minute, or 20 open at once. |

## Coming next

Events (`events:issue`, `events:comment`) and notifications
(`notify:send`). The capabilities exist already; the calls come in the next
releases.
