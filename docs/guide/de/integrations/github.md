---
title: "GitHub"
description: "Pull Requests, Branches, Commits und Checks an den Issues, die sie nennen, Regeln, die ein Issue mit seinem Pull Request weiterschieben, und Branches direkt aus dem Issue."
sidebar:
  order: 4
---

Das Plugin **GitHub** bringt die Arbeit in einem Repository an die Issues, um die es geht. Ein Pull Request, dessen Branch, Titel oder Beschreibung `WEB-42` nennt, erscheint an Issue WEB-42: auf seiner Karte im Board und im Panel **Development** des Issues. Barynt verbindet sich über eine eigene GitHub App mit GitHub und liest selbst, was GitHub meldet. Es läuft kein zusätzlicher Server.

## Was es zeigt

- **Im Board** bekommt eine Karte eine Zeile für ihren Pull Request: Nummer, Stand (_Draft_, _Open_, _Changes requested_, _Approved_, _Merged_, _Closed_) und, solange er offen ist, seine Checks. Die Zeile ändert sich von selbst, wenn GitHub meldet, und ein Klick öffnet das Issue beim Panel.
- **Im Issue** zeigt das Panel **Development** in der Seitenleiste den Branch, die Pull Requests mit Checks und Größe, wer sie geprüft hat (mit deinem eigenen GitHub-Token) und die Commits, die das Issue nennen.

## Einrichten

Barynt verbindet sich über eine eigene **GitHub App** mit GitHub, so wie Linear oder Plane. Die App wird einmal auf deiner Organisation installiert. Dabei wählst du, welche Repositories sie sehen darf. Danach meldet GitHub sich von selbst bei Barynt. Niemand muss pro Repository einen Webhook anlegen oder für das Team ein Token hinterlegen.

1. **Einmal pro Barynt (Plattform-Admin):** **GitHub** unter **Admin → Plugins** installieren. Auf seiner Seite erstellt die Karte **GitHub App** die App: Optional die Organisation angeben, unter der sie entstehen soll. Dann **Auf GitHub erstellen** klicken, prüfen, was sie verlangt, und bestätigen. GitHub übergibt Barynt die Schlüssel der App, du musst nichts kopieren. Alternativ `GITHUB_APP_*` in der Umgebung setzen, wenn du die App selbst erstellt hast.
2. **Freischalten:** Ein Workspace-Admin schaltet GitHub in den Einstellungen im **Store** frei.
3. **Verbinden:** Unter **Einstellungen → Plugins → GitHub → Workspace** auf **Mit GitHub verbinden** klicken. GitHub bittet dich, dich anzumelden, und dann, die App auf einem Konto zu installieren und Repositories auszuwählen. Ist sie dort schon installiert, listet Barynt die Konten auf, die du erreichst. Eine Verbindung im Workspace gilt für **jedes Projekt** darin. Ein Projekt kann im Tab **Projekt** dort auch ein eigenes Konto verbinden.
4. **Im Projekt:** Unter **Einstellungen → Plugins → GitHub → Projekt** rechts das Projekt wählen, bestätigen, was das Plugin darf, und einschalten. Unter **Repositories** steht jetzt alles, was die verbundenen Konten freigeben. Die Repositories anhaken, mit denen dieses Projekt arbeitet, und speichern.

Das war's: Pull Requests, Branches, Commits und Checks dieser Repositories kommen von selbst. Wenn die App später mehr oder weniger Repositories sehen soll, geht das über **Repositories auf GitHub ändern** neben dem Konto.

> [!NOTE]
> GitHub muss Barynt für seine Meldungen unter `<deine Adresse>/api/github/webhook` erreichen. Ist eine Instanz nur im eigenen Netz (oder unter `localhost`) erreichbar, wird die App ohne Webhook angelegt. Verbinden und Repositories auswählen funktioniert dann, Pull Requests und Checks kommen aber nicht an.

**Dein GitHub-Konto (optional):** Unter **Einstellungen → Plugins → GitHub → Persönlich** meldet dich **Mit GitHub verbinden** über die App dieser Instanz an – dann arbeitet das Plugin in deinem Namen und benennt Branches zum Beispiel nach deinem GitHub-Login. Meldest du dich bei Barynt mit GitHub an, übernimmt das Plugin dieses Konto direkt, wenn sein Token Repositories erreicht (Anmeldung über die App selbst oder mit dem Scope `repo`); sonst verbindet es ein Klick. Die Repositories des Projekts erreicht es weiter über die Verbindung des Projekts, damit es für alle dort funktioniert. Ein eigenes Fine-grained-Token im selben Tab (_Contents_ lesen und schreiben, _Pull requests_ und _Checks_ lesen) geht vor.

**Ohne App:** Wie bisher die Repositories eintragen (`owner/repo`, eins pro Zeile), den Webhook aus der Karte **Webhooks anderer Dienste** in den Repository-Einstellungen auf GitHub anlegen und jeder ein eigenes Token hinterlegen. Mit einer Verbindung wird diese Karte nicht gezeigt: GitHub meldet über die App.

## Wie Issues gefunden werden

Barynt sucht die Issue-Schlüssel des Projekts im Branch-Namen, Titel und in der Beschreibung eines Pull Requests, in Commit-Nachrichten und Branch-Namen: `WEB-42`, `web-42-fix-login` und `feature/WEB_42` nennen alle WEB-42. Es zählen nur die Schlüssel des Projekts, in dem das Plugin läuft.

## Regeln

In den Plugin-Einstellungen des Projekts wählst du je Regel einen Status oder lässt sie aus, und speicherst oben mit **Speichern**. Unter **Pull Requests** gibt es eine Regel je Schritt: _Als Entwurf geöffnet_, _Geöffnet oder bereit für Review_, _Review angefragt_, _Freigegeben_, _Änderungen gewünscht_, _Gemergt_, _Ohne Merge geschlossen_ — etwa _In Review_, wenn ein Review angefragt wird, und _Done_ beim Merge. **Ziel-Branches** beschränkt sie auf Pull Requests in diese Branches (`main, release/*`; leer: alle), damit ein Merge in `develop` ein Issue nicht abschließt. Unter **Checks & Actions**: _Checks auf dem Branch fehlgeschlagen_ — jeder Check, auch GitHub Actions — etwa _Blockiert_. Unter **Deployments**: _Auf eine Testumgebung deployt_ und _In Produktion deployt_ (wie GitHub die Umgebung kennzeichnet) — etwa _Auf Staging_ und _Live_. Ein Preview des Branches eines Issues zählt; bei einem Deploy von `main` fragt Barynt GitHub, welche Commits seit dem letzten Deploy dieser Umgebung dazukamen, und bewegt die Issues, die sie schließen. Barynt setzt den Status dann als **GitHub (App)** und kommentiert den Grund. Eine Regel bewegt nur ein Issue, an dem der Pull Request arbeitet: Schlüssel im Branch-Namen oder nach _Fixes_, _Closes_ oder _Resolves_ im Titel oder in der Beschreibung. Ein Schlüssel, der nur woanders erwähnt wird, verknüpft den Pull Request und sonst nichts.

## Aktionen

Im Menü eines Issues, in den Schnellaktionen einer Karte und in der Befehlspalette:

- **Branch erstellen** — in einem Repository des Projekts (bei mehreren fragt es, in welchem; das erste ist Standard), ausgehend von dessen Standard-Branch, benannt nach dem Schema aus den Einstellungen (`{type}/{key}-{title}`, z. B. `feature/web-42-session-cookie-behalten`). Angelegt mit deinem Token, falls du eins hinterlegt hast, sonst über die Verbindung. Danach wird das Issue je nach Einstellung dir zugewiesen und auf einen Status gesetzt.
- **Branch-Namen kopieren** — der Branch des Issues, oder der Name, den er bekäme.
- **Pull Request öffnen** — sein offener Pull Request, oder GitHubs Seite zum Öffnen eines neuen, der Titel beginnt mit dem Schlüssel des Issues.
- **Workflow starten** — der Workflow, der in den Projekteinstellungen unter **GitHub Actions** eingetragen ist (eine Datei in `.github/workflows` mit `on: workflow_dispatch`), gestartet auf dem Branch des Issues. Das Panel **Entwicklung** hat denselben Button.

**Issues im Pull Request verlinken:** ein Schalter unter **Pull Requests**. Sobald ein Pull Request an Issues arbeitet, kommentiert Barynt ihn mit einem Link zu jedem — einmal, als GitHub App.

## Neue Rechte

Kommentare im Pull Request, Workflows und Deployments brauchen Rechte, die eine früher erstellte App nicht hat: _Pull requests_ und _Actions_ schreiben, _Deployments_ lesen, und das Ereignis _Deployment status_. **Admin → Plugins → GitHub** zeigt das auf der Karte **GitHub App**, mit Link zu den Rechten der App auf GitHub — dort setzen und speichern. Danach bestätigt jeder Besitzer einer Installation sie einmal; bis dahin steht das in den Plugin-Einstellungen beim Konto, mit Link.
