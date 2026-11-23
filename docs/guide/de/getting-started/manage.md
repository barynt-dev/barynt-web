---
title: "Der barynt-Befehl"
description: "Der Installer legt sich als barynt auf deinen Server. Er erledigt Upgrades, Backups und Prüfungen."
sidebar:
  order: 5
  badge: Neu
---

## Befehle

| Befehl | Was sie macht |
| --- | --- |
| `barynt status` | Container, Version und Zustand |
| `barynt upgrade` | Die neueste Version (oder `--version`), vorher mit Backup |
| `barynt backup` | Datenbank, hochgeladene Dateien und `.env` in einem Archiv |
| `barynt restore <archive>` | Die Daten durch ein Backup ersetzen |
| `barynt logs [service]` | Den Logs von app, postgres, caddy … folgen |
| `barynt config [K=V …]` | Domain oder SMTP ändern; ohne Argumente interaktiv |
| `barynt doctor` | Prüft Docker, Speicher, Platte, DNS und Zustand |
| `barynt start \| stop \| restart` | Was draufsteht |
| `barynt uninstall` | Entfernt die Container; `--purge` löscht zusätzlich alle Daten |

## Upgrades

```bash
barynt upgrade                   # Backup, dann neueste Version
barynt upgrade --version {{version}}  # eine bestimmte
```

Die App spielt Datenbank-Migrationen beim Start selbst ein. Mit `--no-backup` überspringst du das Backup, mit `--force` installierst du dieselbe Version neu oder gehst auf eine ältere zurück.

## Eine Beta testen

Eine Beta ist eine Version vor ihrem Release, zum Ausprobieren, was kommt. Sie ist ein eigenes Image, `ghcr.io/barynt-dev/barynt-beta` — mit ihrer Version als Tag (`1.1.0-beta.1`) und `beta` für die neueste —, und mischt sich so nie mit Releases oder `latest`.

```bash
barynt backup
barynt config BARYNT_IMAGE=ghcr.io/barynt-dev/barynt-beta BARYNT_VERSION=1.1.0-beta.1
```

`barynt config` lädt das Image und startet neu. Für die nächste Beta setzt du ihre Version genauso.

> [!WARNING]
> Teste eine Beta auf einer Kopie, nicht auf der Installation, mit der dein Team arbeitet. Datenbank-Migrationen gehen nur vorwärts: Zurück von einer Beta heißt, das Backup von vorher wiederherzustellen.

Zurück zu den Releases:

```bash
barynt config BARYNT_IMAGE=ghcr.io/barynt-dev/barynt BARYNT_VERSION={{version}}
barynt restore <das Backup von vor der Beta>
```

`barynt upgrade` verlässt eine Beta nicht von selbst: Solange `BARYNT_IMAGE` auf das Beta-Image zeigt, stell zuerst das Image zurück.

Mit Helm setzt du `image.repository` auf `ghcr.io/barynt-dev/barynt-beta` und `image.tag` auf die Version der Beta.

## Backups

```bash
barynt backup --output /mnt/backups
barynt restore /mnt/backups/barynt-{{version}}-20261028-0300.tar.gz
```

<!-- TODO Screenshot: barynt status und barynt doctor (Terminal-Ausgabe · 1280 × 720) -->
