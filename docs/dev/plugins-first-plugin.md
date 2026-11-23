# Your first plugin

This walks you through a small sandbox plugin: a project view that lists the
project's open issues. At the end it runs in your local Barynt, installed
like any other plugin.

You need [Bun](https://bun.sh), a local Barynt (see the
[developer docs](getting-started.md)) and its repository, because
the SDK and the plugin template live there.

## 1. The project

Start from the template: **Use this template** on
[barynt-dev/barynt-plugin-template](https://github.com/barynt-dev/barynt-plugin-template),
or copy `templates/plugin/` from Barynt's repository, where it's kept. It is
this plugin, with its tests, a build, a release script and CI. Put your copy
next to your Barynt checkout — its `package.json` takes the SDK from
`../barynt/packages/plugin-sdk` — and build the SDK once:

```bash
cp -r barynt/templates/plugin open-issues
(cd barynt/packages/plugin-sdk && bun install && bun run build)
cd open-issues && bun install
```

```text
open-issues/
  manifest.json        who the plugin is, where it runs, what it may do
  src/main.ts          the plugin
  src/open.ts          its logic, testable without a DOM
  styles.css
  tests/main.test.ts   against the SDK's test host
  server/index.ts      its own server, optional
  scripts/build.ts     builds dist/
  scripts/release.ts   a release, its hash and its plugins.json entry
  .github/workflows/   tests on every push, a GitHub release on a tag
```

For another plugin, change `id`, `name`, `author` and `description` in
`manifest.json` first. The id never changes once the plugin is out.

## 2. The manifest

`manifest.json` says who the plugin is, where it can run, what it asks for
and what it adds. Every field is explained in [Manifest](plugins-manifest.md).

```json
{
  "id": "open-issues",
  "name": "Open Issues",
  "version": "0.1.0",
  "minBaryntVersion": "1.0.0",
  "author": "You",
  "description": {
    "short": "The project's open issues at a glance.",
    "about": "about.md"
  },
  "license": "MIT",
  "kind": "sandbox",
  "levels": ["project"],
  "capabilities": ["issues:read", "ui:project-view"],
  "network": [],
  "contributes": {
    "projectViews": [{ "id": "open", "title": "Open issues" }]
  }
}
```

`about.md`, next to it, is the plugin's page in the store — see
[Page text and links](plugins-manifest.md#page-text-and-links).

## 3. The code

`src/main.ts` exports one class. Barynt creates it and calls `onload()`.

```ts
import { Plugin } from "@barynt/plugin-sdk";
import { openIssues } from "./open";

export default class OpenIssues extends Plugin {
  async onload() {
    this.registerProjectView({
      id: "open", // the id from contributes.projectViews
      render: async (el) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        const list = document.createElement("ul");
        list.className = "open-issues";
        for (const issue of openIssues(issues)) {
          const item = document.createElement("li");
          item.textContent = `${issue.ref} · ${issue.title}`;
          list.append(item);
        }
        el.replaceChildren(list);
      },
    });
  }
}
```

`openIssues` in `src/open.ts` leaves out completed and canceled issues. It
sits in its own file so a test checks it without a DOM.

> [!TIP]
> Use `textContent`, never `innerHTML`, for anything that came from Barynt.
> An issue title is text someone typed.

`styles.css` styles it with Barynt's own tokens, so it fits light and dark
mode:

```css
.open-issues {
  margin: 0;
  padding: 1.25rem 1.5rem;
  list-style: none;
}
.open-issues li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--outline-variant);
}
```

Test and build it:

```bash
bun run test
bun run dev     # builds dist/ now and on every change
```

`dist/` then holds what Barynt loads: `main.js` (one ES module, the SDK
bundled in), `manifest.json` and `styles.css`.

## 4. Load it from its folder

While you work on it, Barynt loads the plugin straight from your project,
with no release and no hash. In Barynt's `.env`, then restart Barynt:

```bash
PLUGIN_DEV_DIRS="/home/you/open-issues"
```

Barynt reads `manifest.json`, `main.js` and `styles.css` from that folder,
or from its `dist/` — where the template's build puts them. Several plugins are separated by commas,
and an address like `http://localhost:5173` works too, for a dev server
that serves the three files.

> [!NOTE]
> `PLUGIN_DEV_DIRS` only works in development. In production it is ignored.

## 5. Install and switch it on

1. **Admin → Plugins → Sources**: your plugin is listed under *Local
   plugins*, with anything wrong in its manifest. **Install** it.
2. **Settings → Plugin store**: open it and **Release** it for the workspace.
3. **Project settings → Plugins → Open Issues**: confirm what it may do and
   **Switch on**. Under **Views**, open *Open issues*.

## Changing it

Keep `bun run dev` running. Barynt reads
the folder again whenever a frame loads, and open frames check it every
two seconds: after a build they load again on their own. The manifest is
checked every time. If it asks for more capabilities than a place
confirmed, that place confirms again, as after an update.

## Trying a release

Before you publish, try the plugin the way an admin gets it: as a release
from a directory.

```bash
PLUGIN_REPO="http://localhost:4555" bun run release
```

It builds, copies the files to `release/<version>/`, prints the release
hash (see [Publishing](plugins-publishing.md#the-release-hash)) and adds the
version to `release/plugins.json` — a directory on its own. Serve it and let
your local Barynt read from it:

```bash
cd release && bunx serve -l 4555
# in Barynt's .env, then restart Barynt:
PLUGIN_DEV_BASE="http://localhost:4555"
```

> [!NOTE]
> `PLUGIN_DEV_BASE` only works for `localhost` and never in production. It
> lets Barynt read plain `http` from there.

In **Admin → Plugins → Add source**, add `http://localhost:4555/plugins.json`
with provider *Web server* and install the release from there; it replaces
the local install.

A version's files are fixed by their hash. For a change, raise `version` in
`manifest.json` (`0.1.1`, or a prerelease like `0.1.0-dev.2`) and run
`bun run release` again; it refuses a version that is already out with
other files. In the template's CI, pushing a tag with the version does the
release on GitHub.

Next: everything the SDK offers is in [Plugin SDK](plugins-sdk.md); test it without
Barynt with [Testing](plugins-testing.md).
