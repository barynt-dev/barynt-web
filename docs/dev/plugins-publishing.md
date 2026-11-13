# Publishing

Barynt never loads code from your repository while it runs. A platform
admin installs a **release**; Barynt downloads its files once, checks them
against the **hash** a **directory** vouches for, and keeps them.

## A release

A release is one version of the plugin, its tag the version itself
(`1.2.0`, not `v1.2.0`). Its files sit flat next to each other — attached to
the release on GitHub, GitLab or Gitea, or in the tag on Bitbucket:

| File | |
| --- | --- |
| `manifest.json` | always — its `version` is the release's |
| `main.js` | for a `sandbox` plugin: one ES module, everything bundled |
| `styles.css` | optional |
| `preview-1.webp` … `preview-6.png` | optional, see [Screenshots](#screenshots) |

On a plain web server, the files of version `1.2.0` of the entry's `repo`
`https://plugins.acme.example/timeline` are at
`https://plugins.acme.example/timeline/1.2.0/<file>`.

A release is fixed: once a version is listed, its files must never change.
For a fix, release a new version.

## The release hash

The directory names, for each version, the SHA-256 of its files — all of
them, previews included. It's the hash of the list of each file's own hash
and name, sorted by name, exactly what this prints:

```bash
sha256sum manifest.json main.js styles.css preview-*.* | sort -k2 | sha256sum
```

Leave out files the release doesn't have. If a single byte differs from
what the directory says, Barynt refuses the install with "hash mismatch".

## The directory entry

A directory is a `plugins.json` — in the root of a Git repository, or
anywhere on a web server — with one entry per plugin:

```json
[
  {
    "id": "gantt-timeline",
    "name": "Gantt Timeline",
    "author": "Acme GmbH",
    "description": "Issues on a time line, as a project view.",
    "repo": "https://gitlab.acme.example/plugins/gantt-timeline",
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

| Field | Required | Meaning |
| --- | --- | --- |
| `id`, `name`, `author`, `description` | yes | As in the [manifest](plugins-manifest.md); the release's manifest must have the same `id`. |
| `repo` | yes | Where the releases are: GitHub's `owner/name`, or the repository's address on any Git host or web server. |
| `provider` | no | `github`, `gitlab`, `gitea`, `bitbucket` or `https`, when the address doesn't tell. |
| `levels`, `kind` | yes | Must match the release's manifest. |
| `versions` | yes | Every version the directory vouches for, with its [release hash](#the-release-hash). |
| `categories` | no | Up to three of `development`, `planning`, `communication`, `reports`, `time`, `automation`, `support`. |
| `featured` | no | `true` for the store's "Featured" row. |
| `added` | no | Since when it's listed, `YYYY-MM-DD`, for "New in the directory". |
| `notes` | no | Release notes per version, up to 2000 characters each. Plain text; lines starting with `- ` become a list. |

The last four change how the store shows a plugin, never what it may do. An
entry with a mistake is left out and reported; the others still load.

## Getting listed

- **Your own directory**: any Git repository or web server. A platform admin
  adds it under **Admin → Plugins → Add source** — for a private repository
  with an access token, which Barynt keeps encrypted.
- **Someone else's**: ask its maintainers to add your entry. They vouch for
  the hashes they list.

## Screenshots

Up to six images for the store, listed in the manifest in the order shown:

```json
"previews": [
  { "file": "preview-1.webp", "title": "Timeline per project" },
  { "file": "preview-2.webp", "title": "Drag to reschedule" }
]
```

WebP or PNG, at most 512 KB each, named `preview-1` to `preview-6`; 16:10
looks best. They're part of the release and its hash, are checked to be real
images, and Barynt serves them itself.

## Updates

Release the new version, add it with its hash to `versions`, and the
platform admin sees **Update** in the store. If the new version asks for
**more capabilities**, it doesn't get them silently: wherever it's on, it
keeps running with only the capabilities confirmed before — a call that
needs a new one is refused with `capability_not_confirmed` — until someone
confirms again. Plan for that: a new feature that needs a new capability
should explain itself instead of breaking. A platform admin can roll back to
the version before.
