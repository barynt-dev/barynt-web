---
title: "The barynt command"
description: "The installer puts itself on your server as barynt. It runs your upgrades, backups and checks."
sidebar:
  order: 5
  badge: New
---

## Commands

| Command | What it does |
| --- | --- |
| `barynt status` | Containers, version and health |
| `barynt upgrade` | The newest version (or `--version`), with a backup first |
| `barynt backup` | Database, uploaded files and `.env` in one archive |
| `barynt restore <archive>` | Replace the data with a backup |
| `barynt logs [service]` | Follow the logs of app, postgres, caddy … |
| `barynt config [K=V …]` | Change the domain or SMTP; interactive without arguments |
| `barynt doctor` | Checks Docker, memory, disk, DNS and health |
| `barynt start \| stop \| restart` | What it says |
| `barynt uninstall` | Removes the containers; `--purge` also deletes all data |

## Upgrading

```bash
barynt upgrade                   # backup, then the newest release
barynt upgrade --version {{version}}  # a specific one
```

The app applies database migrations itself when it starts. Use `--no-backup` to skip the backup and `--force` to reinstall the same version or go back to an older one.

## Testing a beta

A beta is a version before its release, for trying what's coming. It's an image of its own, `ghcr.io/barynt-dev/barynt-beta` — tagged with its version (`1.1.0-beta.1`) and `beta` for the newest one — so it never mixes with releases or `latest`.

```bash
barynt backup
barynt config BARYNT_IMAGE=ghcr.io/barynt-dev/barynt-beta BARYNT_VERSION=1.1.0-beta.1
```

`barynt config` pulls the image and restarts. For the next beta, set its version the same way.

> [!WARNING]
> Test a beta on a copy, not on the installation your team works in. Database migrations only go forward: back from a beta means restoring the backup from before it.

Back to releases:

```bash
barynt config BARYNT_IMAGE=ghcr.io/barynt-dev/barynt BARYNT_VERSION={{version}}
barynt restore <the backup from before the beta>
```

`barynt upgrade` doesn't leave a beta on its own: while `BARYNT_IMAGE` points at the beta image, set the image back first.

With Helm, set `image.repository` to `ghcr.io/barynt-dev/barynt-beta` and `image.tag` to the beta's version.

## Backups

```bash
barynt backup --output /mnt/backups
barynt restore /mnt/backups/barynt-{{version}}-20261028-0300.tar.gz
```

<!-- TODO Screenshot: barynt status and barynt doctor (terminal output · 1280 × 720) -->
