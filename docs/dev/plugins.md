# Building plugins

A plugin adds something to Barynt that Barynt doesn't do itself: a timeline
view, a sync with another tool, a field your team needs. Plugins are written
by anyone, live in their own Git repository, and are switched on by the
people who run a Barynt instance — never silently.

These pages are for **plugin authors**: people who build on Barynt rather
than change Barynt itself. To install or switch on plugins, see
[Plugins](../guide/en/administration/plugins.md) in the user guide.

## The three kinds

Every plugin declares its `kind` in its [manifest](plugins-manifest.md):

| Kind | What it is | Runs where |
| --- | --- | --- |
| `declarative` | Only a manifest, no code: custom fields, settings, badges, [widget templates](plugins-manifest.md#widget-templates). | Barynt does it itself. |
| `sandbox` | Browser code with a user interface: project views, pages, dashboard widgets, later panels and actions. | In a sandbox in the browser, see [Sandbox and limits](plugins-sandbox.md). |
| `service` | Your own server, called by Barynt and calling Barynt's API. | On your infrastructure. |

Most of this section is about **sandbox** plugins, written with the
[plugin SDK](plugins-sdk.md).

> [!NOTE]
> No third-party code ever runs inside the Barynt server. A sandboxed plugin
> runs in the person's browser, locked in; a service runs on its own server.

## From your repository to a project

1. **You** build the plugin and publish a **release** in your repository:
   `manifest.json`, `main.js`, optionally `styles.css` and screenshots.
2. **A directory** (`plugins.json`, in a Git repository or on a web server)
   lists the plugin with the hash of every version it vouches for. See
   [Publishing](plugins-publishing.md).
3. **A platform admin** adds the directory as a source and installs the
   plugin. Barynt downloads the release, checks the hash and the manifest,
   and keeps the files itself — nothing is loaded from your repository at
   runtime.
4. **A workspace manager** releases the plugin for the workspace in the
   plugin store, after reading what it may do.
5. **A project admin** switches it on in the project's settings and confirms
   its capabilities for that project. From then on it runs there.

An update that asks for more capabilities waits until it's confirmed again,
everywhere it runs.

## What a plugin may do

A plugin asks for **capabilities** in its manifest — `issues:read`,
`comments:write`, `ui:project-view` and so on. People see them in plain
words before they switch a plugin on. On top of that, a plugin can never do
more than the **person** whose session it runs in: Barynt checks every
request against both, on the server. See [Host API](plugins-host-api.md).

## The pages

| Page | What you get |
| --- | --- |
| [Your first plugin](plugins-first-plugin.md) | A project view in a few minutes, released locally and run in your own Barynt. Start here. |
| [Manifest](plugins-manifest.md) | Every field of `manifest.json`, every capability, the rules Barynt checks. |
| [Plugin SDK](plugins-sdk.md) | `@barynt/plugin-sdk`: the `Plugin` class, its lifecycle, the register methods, the typed API, errors. |
| [Host API](plugins-host-api.md) | Every call a plugin can make, its capability, params, result and errors. |
| [Sandbox and limits](plugins-sandbox.md) | What the sandbox takes away, how to look like Barynt, all limits. |
| [Testing](plugins-testing.md) | The SDK's test host: test a plugin without Barynt. |
| [Publishing](plugins-publishing.md) | Releases, the release hash, directory entries, screenshots, updates. |

How it works on Barynt's side — the frame, the bridge, the checks — is in
[Backend services](backend-services.md#plugin-directory).
