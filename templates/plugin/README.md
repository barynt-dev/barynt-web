# Barynt plugin template

A starting point for a [Barynt](https://github.com/barynt-dev/barynt-web)
plugin: a sandboxed project view that lists the project's open issues,
with tests, a build, a release script and CI. Start a repository from it
(**Use this template** on
[barynt-dev/barynt-plugin-template](https://github.com/barynt-dev/barynt-plugin-template)),
rename the plugin, and change what it does.

> [!NOTE]
> This repository is published from `templates/plugin/` in barynt-web —
> changes to the template go there.

```text
manifest.json        who the plugin is, where it runs, what it may do
src/main.ts          the plugin: one class, registered in onload()
src/open.ts          its logic, kept apart so tests need no DOM
styles.css           its styles, with Barynt's tokens
tests/main.test.ts   against the SDK's test host
server/index.ts      its own server (optional), with createService
scripts/build.ts     dist/: main.js, manifest.json, styles.css
scripts/release.ts   release/<version>/, its hash, release/plugins.json
.github/workflows/   test and build on every push, a release on a tag
```

## Set up

The SDK isn't on npm yet. Put this folder next to a checkout of Barynt —
`package.json` points to `../barynt/packages/plugin-sdk` — and build the SDK
once:

```bash
git clone https://github.com/barynt-dev/barynt-web barynt
git clone https://github.com/you/open-issues    # your copy of the template
(cd barynt/packages/plugin-sdk && bun install && bun run build)
cd open-issues && bun install
```

Then make it yours: `id`, `name`, `author` and `description` in
`manifest.json` (and `name` in `package.json`). The id is lower-case
letters, digits and `-`, and never changes once the plugin is out.

## Work on it

```bash
bun run dev        # builds dist/ on every change
bun run test       # the tests
bun run typecheck
```

In your local Barynt's `.env`, point to this folder and restart Barynt:

```bash
PLUGIN_DEV_DIRS="/path/to/open-issues"
```

**Admin → Plugins → Sources → Local plugins**: install it. Release it for a
workspace, switch it on in a project, and open _Open issues_ under the
project's views. Barynt loads it from `dist/` on every load; after a build,
open frames reload by themselves.

## Release it

```bash
PLUGIN_REPO="https://github.com/you/open-issues" bun run release
```

This builds, copies the files to `release/<version>/`, prints the release
hash and adds the version to `release/plugins.json`. Attach the files to a
release tagged with the version (`0.1.0`, no `v`) and list the entry in a
directory Barynt reads. A release is fixed: for a change, bump `version` in
`manifest.json` first.

With the CI workflow, pushing a tag does it: it checks the tag is the
manifest's version, tests, builds and creates the GitHub release with the
files. The hash is in the release's notes.

## Its own server

`server/index.ts` is a server built with `createService`: it gets the
events the manifest subscribes to, signed, and answers through Barynt's
API. Give the manifest a `service` and the matching `events:*` capability
(see the comment at the top), then run it with `bun run server`.

## More

Barynt's developer docs: `docs/dev/plugins-*.md` — the manifest, the SDK,
the host API, testing and publishing.
