---
title: "GitHub"
description: "Pull Requests, Branches, Commits und Checks an den Issues, die sie nennen, Regeln, die ein Issue mit seinem Pull Request weiterschieben, und Branches direkt aus dem Issue."
sidebar:
  order: 4
---

Das Plugin **GitHub** bringt die Arbeit in einem Repository an die Issues, um die es geht. Ein Pull Request, dessen Branch, Titel oder Beschreibung `WEB-42` nennt, erscheint an Issue WEB-42: auf seiner Karte im Board und im Panel **Development** des Issues. Barynt liest die Webhooks von GitHub selbst, es läuft kein zusätzlicher Server.

## Was es zeigt

- **Im Board** bekommt eine Karte eine Zeile für ihren Pull Request: Nummer, Stand (_Draft_, _Open_, _Changes requested_, _Approved_, _Merged_, _Closed_) und, solange er offen ist, seine Checks. Die Zeile ändert sich von selbst, wenn GitHub meldet, und ein Klick öffnet das Issue beim Panel.
- **Im Issue** zeigt das Panel **Development** in der Seitenleiste den Branch, die Pull Requests mit Checks und Größe, wer sie geprüft hat (mit deinem eigenen GitHub-Token) und die Commits, die das Issue nennen.

## Einrichten

1. Ein Plattform-Admin installiert **GitHub** unter **Admin → Plugins**, ein Workspace-Admin schaltet es im Plugin-Store des Workspaces frei.
2. Im Projekt unter **Projekteinstellungen → Plugins → GitHub** bestätigen, was es darf, und einschalten.
3. Die **Repositories** des Projekts eintragen (`owner/repo`, eins pro Zeile). Unter dem Formular prüft _Repositories on GitHub_ jedes mit deinem Token.
4. Die Karte **Webhooks anderer Dienste** zeigt **Adresse** und **Geheimnis**. In GitHub das Repository (oder die Organisation) öffnen → **Settings → Webhooks → Add webhook**: die Adresse als _Payload URL_, `application/json`, das Geheimnis eintragen und unter _Let me select individual events_ _Branch or tag creation_, _Branch or tag deletion_, _Check runs_, _Check suites_, _Pull requests_, _Pull request reviews_ und _Pushes_ wählen.
5. Wer Branches anlegen oder Reviews sehen will, hinterlegt unter **Persönliche Einstellungen → Plugins → GitHub** einen **Fine-grained Token**: _Contents_ lesen und schreiben, _Pull requests_ und _Checks_ lesen, für die Repositories des Teams. Barynt schickt ihn nur an `api.github.com`.

> [!NOTE]
> GitHub muss Barynt für den Webhook erreichen. Eine Instanz, die nur im eigenen Netz erreichbar ist, bekommt von github.com nichts.

## Wie Issues gefunden werden

Barynt sucht die Issue-Schlüssel des Projekts im Branch-Namen, Titel und in der Beschreibung eines Pull Requests, in Commit-Nachrichten und Branch-Namen: `WEB-42`, `web-42-fix-login` und `feature/WEB_42` nennen alle WEB-42. Es zählen nur die Schlüssel des Projekts, in dem das Plugin läuft.

## Regeln

Unter dem Webhook in den Einstellungen des Plugins wählst du je Regel einen Status — etwa _When a pull request is opened_ → _In Review_ und _When a pull request is merged_ → _Done_ — oder lässt sie aus. Barynt setzt den Status dann als **GitHub (App)** und kommentiert den Grund. Eine Regel bewegt nur ein Issue, an dem der Pull Request arbeitet: Schlüssel im Branch-Namen oder nach _Fixes_, _Closes_ oder _Resolves_ im Titel oder in der Beschreibung. Ein Schlüssel, der nur woanders erwähnt wird, verknüpft den Pull Request und sonst nichts.

## Aktionen

Im Menü eines Issues, in den Schnellaktionen einer Karte und in der Befehlspalette:

- **Create branch** — im ersten Repository des Projekts, ausgehend von dessen Standard-Branch, benannt nach dem Schema aus den Einstellungen (`{user}/{key}-{title}`, z. B. `ada/web-42-keep-the-cookie`). Angelegt mit deinem Token, auf GitHub bist also du der Autor; danach wird das Issue je nach Einstellung dir zugewiesen und auf einen Status gesetzt.
- **Copy branch name** — der Branch des Issues, oder der Name, den er bekäme.
- **Open pull request** — sein offener Pull Request, oder GitHubs Seite zum Öffnen eines neuen, der Titel beginnt mit dem Schlüssel des Issues.
