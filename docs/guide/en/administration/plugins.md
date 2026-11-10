---
title: Plugins
description: Install plugins from a directory on your server, and switch them on in workspaces and projects.
sidebar:
  order: 11
  badge: New
---

Plugins add to Barynt: a project view, a dashboard widget, a sync with another tool. They come from a **directory**, a list of plugins with the address of each one's code. Two steps keep it in your hands:

1. A **platform administrator** installs a plugin on the server. That switches nothing on.
2. A **workspace or project admin** switches it on where they want it, after confirming what it may do there.

> [!NOTE]
> A plugin never does more than the person using it may. What it asks for (its _capabilities_, such as "Read issues") is shown before anyone installs or switches it on, and it can't use anything that wasn't confirmed.

## Installing (platform administrators)

Open **Admin → Plugins**.

1. **Add source:** the Git address of a repository with a `plugins.json` in its root, on GitHub, GitLab, Gitea/Forgejo or Bitbucket, including self-hosted servers. Barynt recognizes the provider from the address; if it can't, pick it. Optionally name a branch or tag. On a plain web server, enter the address of the `plugins.json` itself and pick **Web server (HTTPS)**. **Check connection** reads the directory before you save.

   For a private repository, add credentials (an access token, or `user:password` for Bitbucket app passwords and web servers). They are stored encrypted and only sent to that source's server, never to plugins hosted elsewhere.

   > [!NOTE]
   > A Git server on your internal network is blocked unless your operator lists it in `PLUGIN_INTERNAL_HOSTS`.
2. Click **Browse** next to the source. You see its plugins, who made them and in which versions.
3. Click **Install** on a plugin. Barynt loads that version and checks it: the files must match what the directory lists, and the version must run on your Barynt. If anything doesn't match, it is not installed.
4. The dialog shows the plugin's screenshots, if it has any, then the author, where the code comes from, its kind, where it can be used, what it asks for and which other servers it may call. Tick the box and install.

| Action | What it does |
| --- | --- |
| **Update** | In **Browse**, a newer version shows **Update to …**. Workspaces and projects keep using it. If the update asks for more than before, they have to confirm again; until then it only does what was confirmed. |
| **Back to v…** | Returns to the version before. The newer one stays installed. |
| **Block** | Stops the plugin everywhere at once. Activations and data stay and apply again when you unblock it. |
| **Uninstall** | Removes every version. You choose whether its data in workspaces and projects is deleted too, or kept switched off. |

Every step is recorded in the [audit log](audit.md).

## Switching on (workspace and project admins)

Open **Settings → Plugins** in the workspace or in a project. You need the permission _Switch installed plugins on and off and configure them_, which owners, admins, managers and project admins have.

- Turn a plugin **on** and confirm what it may do in this workspace or project.
- **Confirm again** appears after an update that asks for more.
- Turning it **off** keeps its settings and data. **Delete data** (the bin) removes them.

### Plugins for projects

A project can only switch on what its workspace released. In the workspace's **Settings → Plugins**, the column **For projects** decides that per plugin. Taking it back switches the plugin off in every project of the workspace; their data stays.
