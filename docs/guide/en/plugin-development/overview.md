---
title: Building plugins
description: What a Barynt plugin is, the three kinds, and how one gets from your repository to a project.
sidebar:
  order: 1
---

A plugin adds something to Barynt that Barynt doesn't do itself: a timeline
view, a sync with another tool, a field your team needs. Plugins are written
by anyone, live in their own Git repository, and are switched on by the
people who run a Barynt instance — never silently.

This section is for **plugin authors**. If you want to install or switch on
plugins, see [Plugins](../administration/plugins.md) in Administration.

## The three kinds

Every plugin declares its `kind` in its [manifest](manifest.md):

| Kind | What it is | Runs where |
| --- | --- | --- |
| `declarative` | Only a manifest, no code: custom fields, settings, badges. | Barynt does it itself. |
| `sandbox` | Browser code with a user interface: a project view, later widgets, panels and actions. | In a sandbox in the browser, see [Sandbox and limits](sandbox.md). |
| `service` | Your own server, called by Barynt and calling Barynt's API. | On your infrastructure. |

Most of this section is about **sandbox** plugins, written with the
[plugin SDK](sdk.md).

> [!NOTE]
> No third-party code ever runs inside the Barynt server. A sandboxed plugin
> runs in the person's browser, locked in; a service runs on its own server.

## From your repository to a project

1. **You** build the plugin and publish a **release** in your repository:
   `manifest.json`, `main.js`, optionally `styles.css` and screenshots.
2. **A directory** (`plugins.json`, in a Git repository or on a web server)
   lists the plugin with the hash of every version it vouches for. See
   [Publishing](publishing.md).
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
request against both, on the server. See [Host API](host-api.md).

## Where to start

- [Your first plugin](first-plugin.md): a project view in a few minutes, run
  against your local Barynt.
- [Plugin SDK](sdk.md): the `Plugin` class and everything on it.
- [Host API](host-api.md): every call, its capability and its limits.
