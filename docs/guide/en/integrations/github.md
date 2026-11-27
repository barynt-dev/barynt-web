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

That's it: pull requests, branches, commits and checks of those repositories come in on their own. A project can work with several repositories; **Create branch** then asks which one.

**A new repository** is quick to make from the settings: **Create new repository** at the bottom of the project's **Add repository** menu (it's added to the project right away), or the button beside the connection in the workspace. Pick the account, a name, a line about it and whether it's private; it starts with a README. In an organization the app creates it; in a personal account only its owner can, with their GitHub account connected on the **Personal** tab. Where the app only sees chosen repositories, Barynt shares the new one with it — if it can't, it says so. To give the app more or fewer repositories later, use **Change repositories on GitHub** beside the account.

> [!NOTE]
> GitHub has to reach Barynt for its reports, at `<your address>/api/github/webhook`. On an instance only reachable inside your network (or `localhost`), the app is created without a webhook: connecting and picking repositories work, but pull requests and checks don't arrive.

**Your GitHub account (optional):** under **Settings → Plugins → GitHub → Personal**, **Connect GitHub** signs you in through the instance's app — then the plugin acts as you, naming branches after your GitHub login, say. If you sign in to Barynt with GitHub, the plugin takes that account right away where its token reaches repositories (signing in through the app itself, or with the `repo` scope); otherwise one click connects it. The project's repositories it still reaches through the project's connection, so it works for everyone there. A fine-grained token of your own on the same tab (_Contents_ read and write, _Pull requests_ and _Checks_ read) goes first.

**Without the app:** as before, type the repositories (`owner/repo`, one per line), add the webhook from the card **Webhooks from other services** in GitHub's repository settings, and keep a token each. With a connection, that card isn't shown: GitHub reports through the app.

## Deployments

Where an issue's work runs shows in its **Development** panel as a line of **stages**, in the order a change goes out — by default Preview, Test, Staging and Production. Only stages something was deployed to show, plus the ones the repository deploys to that the issue hasn't reached yet (dashed, _Not yet_). Each says how it went — _Ready_, _Deploying_, _Waiting for approval_, _Failed_ — and when; the arrow in its corner opens the app there.

A stage gathers what belongs to it: several previews (one stop, with their number), regions (`prod-eu`, `prod-us` — _2/3 regions_, a bar split per region), services (`api-staging`, `web-staging`). With two services or more, **By service** shows a table instead: services down, stages across.

What needs someone gets a line under the stages: a deployment **waiting for approval** (**Approve…**) or one that **failed** (**Show log**). Otherwise, when a stage further along runs an older version than one before it, that line says so.

A click on a stage opens a window: state, environment, address, version, repository, and the workflow run that deployed it. Below come its **Jobs**, live from GitHub — grouped (a reusable workflow's, a matrix's), the done groups folded; a click on a job shows its **log by step**, as on GitHub: the job's name, state, workflow and environment on top, then each step with its state and duration, holding only its own lines — the failed one open. The terminal's colours are kept; errors, warnings and what passed are marked; the search covers every step and opens the one a hit is in; times can be shown. **Full log** opens it in a wide window; the **⋯** menu has **Raw log**, which opens GitHub's raw file, **Download** saves it, **Copy** copies it, and **All logs (zip)** in the deployment's window downloads the whole run's. While a job runs, its steps update; the log comes once it's done. **Re-run failed jobs**, **Re-run this job** and **Deploy again** start them again (they need _Actions_ write). Then the **History**: the deployments before, newest first.

**Approving from Barynt:** a deployment waiting for a reviewer shows **Approve** and **Reject**, with a comment and — when several environments wait — which ones. It's sent as you, so it needs your own GitHub account connected (**Settings → Plugins → GitHub → Personal**) and GitHub has to let you approve; otherwise the window says who may.

On a board card, a rocket and a bar per stage sit at the right of the pull request's row; _Approval_ shows when one waits.

### Stages, environments and workflows

The project's plugin settings have a **Deployments** section below the form, saved with **Save** at the top:

- **Stages** — rename, reorder, remove or add them; one is **Live**, the one that counts as shipped.
- **Recognize stage and service by name** (on by default) — `staging`, `qa`, `prod` and the service before or after (`api-staging`, `web/production`); off, only what's set by hand counts and the rest is _Other_.
- **Environments** — every environment the project's repositories deployed to lately, with its stage, service or region, and whether it shows. A new one is marked _New_; one not deployed to in 30 days shows its date in orange.
- **Workflows as deployments** — for shipping without a GitHub environment (an image, a release): each run of the workflow, on the branch given or any, counts as a deployment to the stage picked. It needs the app's _Workflow run_ event.
- **Patterns** — for environments that come with each pull request or get renamed: `pr-*` → Preview, `*-staging` → Staging with `-` as the service (the part `*` matched). A pattern goes before recognizing.

Changing the CI breaks nothing: jobs are read per run, so an old run shows its old jobs; a new environment or workflow appears as _New_; a renamed one is new to Barynt unless a pattern catches it.

## How issues are found

Barynt looks for the project's issue keys in a pull request's branch name, title and description, in commit messages and branch names: `WEB-42`, `web-42-fix-login` and `feature/WEB_42` all name WEB-42. Only the keys of the project the plugin is on in count.

## Rules

In the project's plugin settings, pick a status for each rule, or leave it off, and save with **Save** at the top. Under **Pull requests**, one per step: _Opened as a draft_, _Opened or ready for review_, _Review requested_, _Approved_, _Changes requested_, _Merged_, _Closed without merging_ — for example _In Review_ when a review is requested and _Done_ when merged. **Target branches** limits them to pull requests into these branches (`main, release/*`; empty: all), so a merge into `develop` doesn't mark an issue done. Under **Checks & Actions**, _Checks failed on the branch_ — any check, GitHub Actions too — say _Blocked_. Under **Deployments**, _Deployed to a test environment_ and _Deployed to production_ (as GitHub marks the environment) — say _On Staging_ and _Live_: a preview of the issue's branch counts, and for a deployment of `main` Barynt asks GitHub which commits came since the environment's deployment before and moves the issues they close. Barynt then sets the status as **GitHub (App)** and comments why. A rule only moves an issue the pull request works on: its key in the branch's name, or after _Fixes_, _Closes_ or _Resolves_ in the title or description. A key only mentioned elsewhere links the pull request and nothing more.

## Actions

In an issue's menu, a card's quick actions and the command palette:

- **Create branch** — in one of the project's repositories (with several, it asks which; the first is the default), from its default branch, named after the pattern in the settings (`{type}/{key}-{title}`, for example `feature/web-42-keep-the-cookie`). With your own token if you keep one, otherwise through the connection; as the project set it, the issue is then assigned to you and moved to a status.
- **Copy branch name** — the issue's branch, or the name it would get.
- **Open pull request** — its open pull request, or GitHub's page to open one, the title starting with the issue's key.
- **Run workflow** — the workflow named under **GitHub Actions** in the project's settings (a file in `.github/workflows` with `on: workflow_dispatch`), started on the issue's branch. The **Development** panel has the same button.

**Link the issues in the pull request:** a switch under **Pull requests**. Once a pull request works on issues, Barynt comments on it with a link to each — once, as the GitHub App.

## Filters

Once the plugin is on in the project, boards and lists filter by GitHub too. In the filter menu: **Pull request status** (draft, open without a review yet, approved, changes requested, merged, closed), **GitHub Actions status** (passed, failed, running) and **Pull request** (with one, with an open one, without — or a particular one). Under **Advanced filter settings** as well: **Branch** (with or without, or a particular one), **GitHub Action** (the workflows and checks that ran), **Repository** (with more than one) and **Deployed to** (an environment). Each takes "is" and "is not", shows as a chip once set, and saves with a view like any other filter.

## New permissions

Commenting on pull requests, running workflows and deployments need permissions an app created before doesn't have: _Pull requests_, _Actions_ and _Administration_ to write (the last for new repositories), _Deployments_ to read, and the events _Deployment status_ and _Workflow run_. **Admin → Plugins → GitHub** says so on the **GitHub App** card, with a link to the app's permissions on GitHub — set them there and save. Each installation's owner then accepts them once; the account's row in the plugin settings says so until they did, with a link.
