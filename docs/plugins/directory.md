# Plugin directory (`plugins.json`)

A directory is a list of plugins with the versions it vouches for. Barynt reads it
from a source: a Git repository with a `plugins.json` in its root (GitHub, GitLab,
Gitea/Forgejo, Bitbucket), or the file's own address on a web server. The format and
its checks are in `lib/plugins/directory.ts`; a broken entry is left out and
reported, the others still load.

## Example

```json
[
  {
    "id": "gantt-timeline",
    "name": "Gantt Timeline",
    "author": "Acme GmbH",
    "description": "Issues on a time line, as a project view.",
    "repo": "https://gitlab.acme.dev/plugins/gantt-timeline",
    "levels": ["project"],
    "kind": "sandbox",
    "versions": {
      "1.2.0": "4f1c…e9",
      "1.1.0": "a03b…71"
    },
    "categories": ["planning"],
    "featured": true,
    "added": "2026-09-14",
    "notes": {
      "1.2.0": "Bars can be dragged now.\n- Drag to reschedule\n- Weekends are shaded"
    }
  }
]
```

## Fields

| Field | Required | Meaning |
|---|---|---|
| `id`, `name`, `author`, `description` | yes | As in the plugin's [manifest](manifest.md); the release's manifest must name the same id. |
| `repo` | yes | Where the releases are: GitHub's `owner/name`, or a repository address on any Git host. |
| `provider` | no | `github`, `gitlab`, `gitea`, `bitbucket` or `https`, when the address doesn't tell. |
| `levels`, `kind` | yes | Must match the release's manifest. |
| `versions` | yes | Every version the directory vouches for, mapped to the SHA-256 of its files: `sha256sum manifest.json main.js styles.css preview-*.* \| sort -k2 \| sha256sum`. |
| `categories` | no | Up to three of `development`, `planning`, `communication`, `reports`, `time`, `automation`, `support` — the store's start page groups by them. |
| `featured` | no | `true` puts the plugin in the store's "Featured" row (at most three are shown). |
| `added` | no | Since when it's listed, `YYYY-MM-DD` — the store's "New in the directory" shows the four most recent. |
| `notes` | no | Release notes per version (`"1.2.0": "…"`), up to 2000 characters each. Plain text: lines starting with `- ` become a list; nothing is read as HTML or Markdown. The store shows them under each version. |

The last four only change how the store presents a plugin, never what it may do.
