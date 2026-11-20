---
title: "GitHub"
description: "Pull requests, branches, commits and checks on the issues they name, rules that move an issue as its pull request does, and creating a branch from an issue."
sidebar:
  order: 4
---

The **GitHub** plugin brings a repository's work onto the issues it is about. A pull request whose branch, title or description says `WEB-42` shows on issue WEB-42: on its card on the board, and in the **Development** panel of the issue. Barynt reads GitHub's webhooks itself — there is no extra server to run.

## What it shows

- **On the board**, a card gets a row for its pull request: its number, where it stands (_Draft_, _Open_, _Changes requested_, _Approved_, _Merged_, _Closed_) and, while it's open, its checks. The row changes on its own when GitHub reports, and a click opens the issue at the panel.
- **In the issue**, the **Development** panel in the sidebar shows its branch, its pull requests with their checks and size, who reviewed them (with your own GitHub token), and the commits that name it.

## Setting it up

1. A platform admin installs **GitHub** under **Admin → Plugins**, and a workspace admin releases it in the workspace's plugin store.
2. In the project, **Project settings → Plugins → GitHub**: confirm what it may do and switch it on.
3. Enter the project's **repositories** (`owner/repo`, one per line). Below the form, _Repositories on GitHub_ checks each one with your token.
4. The card **Webhooks from other services** shows an **address** and a **secret**. In GitHub, open the repository (or the organization) → **Settings → Webhooks → Add webhook**: paste the address as _Payload URL_, choose `application/json`, paste the secret, and under _Let me select individual events_ choose _Branch or tag creation_, _Branch or tag deletion_, _Check runs_, _Check suites_, _Pull requests_, _Pull request reviews_ and _Pushes_.
5. Everyone who wants to create branches or see reviews keeps a **fine-grained GitHub token** under their **personal settings → Plugins → GitHub**: _Contents_ read and write, _Pull requests_ and _Checks_ read, for the team's repositories. Barynt only ever sends it to `api.github.com`.

> [!NOTE]
> GitHub has to reach Barynt for the webhook. An instance only reachable inside your network gets nothing from github.com.

## How issues are found

Barynt looks for the project's issue keys in a pull request's branch name, title and description, in commit messages and branch names: `WEB-42`, `web-42-fix-login` and `feature/WEB_42` all name WEB-42. Only the keys of the project the plugin is on in count.

## Rules

Under the webhook in the plugin's settings, pick a status for each rule — for example _When a pull request is opened_ → _In Review_ and _When a pull request is merged_ → _Done_ — or leave it off. Barynt then sets the status as **GitHub (App)** and comments why. A rule only moves an issue the pull request works on: its key in the branch's name, or after _Fixes_, _Closes_ or _Resolves_ in the title or description. A key only mentioned elsewhere links the pull request and nothing more.

## Actions

In an issue's menu, a card's quick actions and the command palette:

- **Create branch** — in the project's first repository, from its default branch, named after the pattern in the settings (`{user}/{key}-{title}`, for example `ada/web-42-keep-the-cookie`). It's created with your token, so you're its author on GitHub; as the project set it, the issue is then assigned to you and moved to a status.
- **Copy branch name** — the issue's branch, or the name it would get.
- **Open pull request** — its open pull request, or GitHub's page to open one, the title starting with the issue's key.
