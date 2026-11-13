# Your first plugin

This walks you through a small sandbox plugin: a project view that lists the
project's open issues. At the end it runs in your local Barynt, installed
like any other plugin.

You need [Bun](https://bun.sh), a local Barynt (see the
[developer docs](getting-started.md)) and its repository, because
the SDK isn't on npm yet.

## 1. The project

```text
open-issues/
  package.json
  manifest.json
  src/main.ts
  styles.css
```

Build the SDK once in your Barynt checkout, then point to it:

```bash
cd barynt/packages/plugin-sdk && bun run build
```

```json
{
  "name": "open-issues",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "bun build src/main.ts --outfile dist/main.js --format esm --target browser"
  },
  "devDependencies": {
    "@barynt/plugin-sdk": "file:../barynt/packages/plugin-sdk"
  }
}
```

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
  "description": "The project's open issues at a glance.",
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

## 3. The code

`src/main.ts` exports one class. Barynt creates it and calls `onload()`.

```ts
import { Plugin } from "@barynt/plugin-sdk";

export default class OpenIssues extends Plugin {
  async onload() {
    this.registerProjectView({
      id: "open", // the id from contributes.projectViews
      render: async (el) => {
        const { issues } = await this.api.issues.list({ take: 100 });
        const open = issues.filter(
          (issue) =>
            issue.statusCategory !== "completed" &&
            issue.statusCategory !== "canceled",
        );

        const list = document.createElement("ul");
        list.className = "open-issues";
        for (const issue of open) {
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

Build it:

```bash
bun install && bun run build
```

## 4. A local release

Barynt installs releases, never a folder. For local work, a directory on a
plain web server is enough. Make this folder next to your plugin:

```text
plugin-dev/
  plugins.json
  open-issues/0.1.0/manifest.json
  open-issues/0.1.0/main.js
  open-issues/0.1.0/styles.css
```

Copy the three files in, then compute the release hash (see
[Publishing](plugins-publishing.md#the-release-hash)):

```bash
cd plugin-dev/open-issues/0.1.0
sha256sum main.js manifest.json styles.css | sort -k2 | sha256sum
```

`plugins.json` lists the plugin with that hash:

```json
[
  {
    "id": "open-issues",
    "name": "Open Issues",
    "author": "You",
    "description": "The project's open issues at a glance.",
    "repo": "http://localhost:4555/open-issues",
    "provider": "https",
    "levels": ["project"],
    "kind": "sandbox",
    "versions": { "0.1.0": "<the hash>" }
  }
]
```

Serve the folder and let your local Barynt read from it:

```bash
cd plugin-dev && bunx serve -l 4555
# in Barynt's .env, then restart Barynt:
PLUGIN_DEV_BASE="http://localhost:4555"
```

> [!NOTE]
> `PLUGIN_DEV_BASE` only works for `localhost` and never in production. It
> lets Barynt read plain `http` from there.

## 5. Install and switch it on

1. **Admin → Plugins → Add source**: `http://localhost:4555/plugins.json`,
   provider *Web server*. Your plugin shows up; install it.
2. **Settings → Plugin store**: open it and **Release** it for the workspace.
3. **Project settings → Plugins → Open Issues**: confirm what it may do and
   **Switch on**. Under **Views**, open *Open issues*.

## Changing it

A version's files are fixed by their hash. For a change, build, copy the
files into a new version folder (`0.1.1`, or a prerelease like
`0.1.0-dev.2`), add that version and its hash to `plugins.json`, and update
in **Admin → Plugins**.

Next: everything the SDK offers is in [Plugin SDK](plugins-sdk.md); test it without
Barynt with [Testing](plugins-testing.md).
