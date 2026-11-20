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
| `preview-1.webp` … `preview-6.png` | optional, see [Logo and screenshots](#logo-and-screenshots) |
| `logo.png` or `logo.webp` | optional, the one the manifest names |

On a plain web server, the files of version `1.2.0` of the entry's `repo`
`https://plugins.acme.example/timeline` are at
`https://plugins.acme.example/timeline/1.2.0/<file>`.

A release is fixed: once a version is listed, its files must never change.
For a fix, release a new version.

## The release hash

The directory names, for each version, the SHA-256 of its files — all of
them, previews and logo included. It's the hash of the list of each file's own hash
and name, sorted by name, exactly what this prints:

```bash
sha256sum manifest.json main.js styles.css preview-*.* logo.* | sort -k2 | sha256sum
```

Leave out files the release doesn't have. If a single byte differs from
what the directory says, Barynt refuses the install with "hash mismatch".

A plugin started from the template (`templates/plugin/`, see
[Your first plugin](plugins-first-plugin.md#1-the-project)) doesn't need
this by hand: `bun run release` copies the files to `release/<version>/`,
prints the hash and adds the version to `release/plugins.json`, and its CI
creates the GitHub release when you push a tag with the version.

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
    "locales": {
      "de": { "description": "Issues auf einer Zeitleiste, als Projektansicht." }
    },
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
| `locales` | no | The description in Barynt's other languages, as in the [manifest](plugins-manifest.md#fields) — what the store shows before the plugin is installed. |

The last five change how the store shows a plugin, never what it may do. An
entry with a mistake is left out and reported; the others still load.

## Getting listed

- **Your own directory**: any Git repository or web server. A platform admin
  adds it under **Admin → Plugins → Add source** — for a private repository
  with an access token, which Barynt keeps encrypted.
- **Someone else's**: ask its maintainers to add your entry. They vouch for
  the hashes they list.

## Logo and screenshots

A **logo** stands for the plugin wherever Barynt shows it — the store, the
sidebar, its settings, its panels. Name it in the manifest and put the file
in the release:

```json
"logo": "logo.png"
```

Square, WebP or PNG, at most 128 KB; 256 × 256 pixels is plenty. Without
one, Barynt shows the plugin's first letter.

Up to six **screenshots** for the store, listed in the manifest in the order
shown:

```json
"previews": [
  { "file": "preview-1.webp", "title": "Timeline per project" },
  { "file": "preview-2.webp", "title": "Drag to reschedule" }
]
```

WebP or PNG, at most 512 KB each, named `preview-1` to `preview-6`; 16:10
looks best. Logo and screenshots are part of the release and its hash, are
checked to be real images, and Barynt serves them itself — never from the
plugin's Git host.

## Updates

Release the new version, add it with its hash to `versions`, and the
platform admin sees **Update** in the store. If the new version asks for
**more capabilities**, it doesn't get them silently: wherever it's on, it
keeps running with only the capabilities confirmed before — a call that
needs a new one is refused with `capability_not_confirmed` — until someone
confirms again. Plan for that: a new feature that needs a new capability
should explain itself instead of breaking. A platform admin can roll back to
the version before.
