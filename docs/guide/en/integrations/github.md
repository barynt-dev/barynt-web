---
title: "GitHub"
description: "Pull requests, branches, commits and checks on the issues they name, rules that move an issue as its pull request does, and creating a branch from an issue."
sidebar:
  order: 4
---

The **GitHub** plugin brings a repository's work onto the issues it is about. A pull request whose branch, title or description says `WEB-42` shows on issue WEB-42: on its card on the board, and in the **Development** panel of the issue. Barynt connects to GitHub through its own GitHub App and reads what GitHub reports — there is no extra server to run.

## What it shows

- **On the board**, a card gets a row for its pull request: its number, where it stands (_Draft_, _Open_, _Changes requested_, _Approved_, _Merged_, _Closed_) and, while it's open, its checks. The row changes on its own when GitHub reports, and a click opens the issue at the panel.
- **In the issue**, the **Development** panel in the sidebar shows its branch, its pull requests with their checks and size, who reviewed them (with your own GitHub token), and the commits that name it.

## Setting it up

Barynt connects to GitHub through a **GitHub App** of its own, the way Linear or Plane do: it's installed once on your organization, where you choose which repositories it may see, and GitHub then reports to Barynt by itself. Nobody adds a webhook per repository or keeps a token for the team.

1. **Once per Barynt (platform admin):** install **GitHub** under **Admin → Plugins**. In its page, the card **GitHub App** creates the app: optionally name the organization to create it under, click **Create on GitHub**, check what it asks for and confirm. GitHub hands Barynt the app's keys; nothing to copy. (Or set `GITHUB_APP_*` in the environment for an app you created yourself.)
2. **Release it:** a workspace admin releases GitHub in the **Store**, in the settings.
3. **Connect:** under **Settings → Plugins → GitHub → Workspace**, click **Connect GitHub**. GitHub asks you to sign in, then to install the app on an account and pick its repositories — or, if it's installed already, Barynt lists the accounts you can reach. A connection in the workspace counts for **every project** in it. A project can also connect an account of its own on the **Project** tab there.
4. **In the project:** under **Settings → Plugins → GitHub → Project**, pick the project at the right, confirm what it may do and switch it on. **Repositories** now lists everything the connected accounts share: tick the ones this project works with and save.

That's it: pull requests, branches, commits and checks of those repositories come in on their own. To give the app more or fewer repositories later, use **Change repositories on GitHub** beside the account.

> [!NOTE]
> GitHub has to reach Barynt for its reports, at `<your address>/api/github/webhook`. On an instance only reachable inside your network (or `localhost`), the app is created without a webhook: connecting and picking repositories work, but pull requests and checks don't arrive.

**Your own token (optional):** keep a fine-grained GitHub token under **Settings → Plugins → GitHub → Personal** (_Contents_ read and write, _Pull requests_ and _Checks_ read) to have branches named after your GitHub login and to see who reviewed. Without one, the plugin works through the connection — and then only on the repositories the project ticked.

**Without the app:** as before, type the repositories (`owner/repo`, one per line), add the webhook from the card **Webhooks from other services** in GitHub's repository settings, and keep a token each. With a connection, that card isn't shown: GitHub reports through the app.

## How issues are found

Barynt looks for the project's issue keys in a pull request's branch name, title and description, in commit messages and branch names: `WEB-42`, `web-42-fix-login` and `feature/WEB_42` all name WEB-42. Only the keys of the project the plugin is on in count.

## Rules

In the project's plugin settings, pick a status for each rule, or leave it off, and save with **Save** at the top. Under **Pull requests**, one per step: _Opened as a draft_, _Opened or ready for review_, _Review requested_, _Approved_, _Changes requested_, _Merged_, _Closed without merging_ — for example _In Review_ when a review is requested and _Done_ when merged. **Target branches** limits them to pull requests into these branches (`main, release/*`; empty: all), so a merge into `develop` doesn't mark an issue done. Under **Checks & Actions**, _Checks failed on the branch_ — any check, GitHub Actions too — say _Blocked_. Under **Deployments**, _Deployed to a test environment_ and _Deployed to production_ (as GitHub marks the environment) — say _On Staging_ and _Live_: a preview of the issue's branch counts, and for a deployment of `main` Barynt asks GitHub which commits came since the environment's deployment before and moves the issues they close. Barynt then sets the status as **GitHub (App)** and comments why. A rule only moves an issue the pull request works on: its key in the branch's name, or after _Fixes_, _Closes_ or _Resolves_ in the title or description. A key only mentioned elsewhere links the pull request and nothing more.

## Actions

In an issue's menu, a card's quick actions and the command palette:

- **Create branch** — in the project's first repository, from its default branch, named after the pattern in the settings (`{type}/{key}-{title}`, for example `feature/web-42-keep-the-cookie`). With your own token if you keep one, otherwise through the connection; as the project set it, the issue is then assigned to you and moved to a status.
- **Copy branch name** — the issue's branch, or the name it would get.
- **Open pull request** — its open pull request, or GitHub's page to open one, the title starting with the issue's key.
- **Run workflow** — the workflow named under **GitHub Actions** in the project's settings (a file in `.github/workflows` with `on: workflow_dispatch`), started on the issue's branch. The **Development** panel has the same button.

**Link the issues in the pull request:** a switch under **Pull requests**. Once a pull request works on issues, Barynt comments on it with a link to each — once, as the GitHub App.

## New permissions

Commenting on pull requests, running workflows and deployments need permissions an app created before doesn't have: _Pull requests_ and _Actions_ to write, _Deployments_ to read, and the event _Deployment status_. **Admin → Plugins → GitHub** says so on the **GitHub App** card, with a link to the app's permissions on GitHub — set them there and save. Each installation's owner then accepts them once; the account's row in the plugin settings says so until they did, with a link.
