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

Ein Projekt kann mit mehreren Repositories arbeiten; **Branch erstellen** fragt dann, in welchem.

**Ein neues Repository** legst du direkt in den Einstellungen an: **Neues Repository erstellen** unten im Menü **Repository hinzufügen** eines Projekts (es kommt gleich ins Projekt) oder der Button neben der Verbindung im Workspace. Konto, Name, eine Zeile dazu und privat oder öffentlich wählen; es startet mit einer README. In einer Organisation legt die App es an, in einem persönlichen Konto nur sein Besitzer – mit seinem im Tab **Persönlich** verbundenen GitHub-Konto. Sieht die App nur ausgewählte Repositories, gibt Barynt ihr das neue frei; geht das nicht, sagt es das.

> [!NOTE]
> GitHub muss Barynt für seine Meldungen unter `<deine Adresse>/api/github/webhook` erreichen. Ist eine Instanz nur im eigenen Netz (oder unter `localhost`) erreichbar, wird die App ohne Webhook angelegt. Verbinden und Repositories auswählen funktioniert dann, Pull Requests und Checks kommen aber nicht an.

**Dein GitHub-Konto (optional):** Unter **Einstellungen → Plugins → GitHub → Persönlich** meldet dich **Mit GitHub verbinden** über die App dieser Instanz an – dann arbeitet das Plugin in deinem Namen und benennt Branches zum Beispiel nach deinem GitHub-Login. Meldest du dich bei Barynt mit GitHub an, übernimmt das Plugin dieses Konto direkt, wenn sein Token Repositories erreicht (Anmeldung über die App selbst oder mit dem Scope `repo`); sonst verbindet es ein Klick. Die Repositories des Projekts erreicht es weiter über die Verbindung des Projekts, damit es für alle dort funktioniert. Ein eigenes Fine-grained-Token im selben Tab (_Contents_ lesen und schreiben, _Pull requests_ und _Checks_ lesen) geht vor.

**Ohne App:** Wie bisher die Repositories eintragen (`owner/repo`, eins pro Zeile), den Webhook aus der Karte **Webhooks anderer Dienste** in den Repository-Einstellungen auf GitHub anlegen und jeder ein eigenes Token hinterlegen. Mit einer Verbindung wird diese Karte nicht gezeigt: GitHub meldet über die App.

## Deployments

Wo die Arbeit eines Issues läuft, zeigt das Panel **Development** als Strecke von **Stufen**, in der Reihenfolge, in der eine Änderung ausgeliefert wird — standardmäßig Preview, Test, Staging und Produktion. Es erscheinen nur Stufen, in die etwas deployt wurde, und die, in die das Repository deployt, die das Issue aber noch nicht erreicht hat (gestrichelt, _Noch nicht_). Jede sagt, wie es lief — _Bereit_, _Läuft_, _Wartet auf Freigabe_, _Fehlgeschlagen_ — und wann; der Pfeil in der Ecke öffnet die App dort.

Eine Stufe fasst zusammen, was zu ihr gehört: mehrere Previews (eine Station mit ihrer Zahl), Regionen (`prod-eu`, `prod-us` — _2/3 Regionen_, ein Balken je Region), Dienste (`api-staging`, `web-staging`). Ab zwei Diensten zeigt **Nach Diensten anzeigen** eine Tabelle: Dienste untereinander, Stufen nebeneinander.

Was jemanden braucht, bekommt eine Zeile unter den Stufen: ein Deployment, das **auf Freigabe wartet** (**Freigeben…**), oder eines, das **fehlgeschlagen** ist (**Log ansehen**). Sonst sagt diese Zeile, wenn eine Stufe weiter hinten eine ältere Version hat als eine davor.

Ein Klick auf eine Stufe öffnet ein Fenster: Status, Umgebung, Adresse, Version, Repository und der Workflow-Lauf, der deployt hat. Darunter die **Jobs**, live von GitHub — gruppiert (die eines wiederverwendeten Workflows, einer Matrix), fertige Gruppen eingeklappt; ein Klick auf einen Job zeigt seine Schritte und sein **Log**: mit den Farben des Terminals, jeder Schritt eingeklappt (der fehlgeschlagene offen), Fehler, Warnungen und Bestandenes markiert, durchsuchbar und mit Zeiten. **Vollständiges Log** öffnet alles in einem breiten Fenster; **Raw-Log** öffnet GitHubs Rohdatei, **Herunterladen** speichert es, **Kopieren** kopiert es, und **Alle Logs (zip)** im Fenster des Deployments lädt die des ganzen Laufs. Läuft ein Job noch, aktualisieren sich seine Schritte; das Log kommt, wenn er fertig ist. **Fehlgeschlagene erneut**, **Diesen Job erneut** und **Erneut deployen** starten sie neu (braucht _Actions_ schreiben). Danach der **Verlauf**: die Deployments davor, das neueste zuerst.

**Freigeben aus Barynt:** Wartet ein Deployment auf eine Prüfung, gibt es **Freigeben** und **Ablehnen**, mit Kommentar und — warten mehrere Umgebungen — der Auswahl, welche. Es wird in deinem Namen gesendet; dafür muss dein eigenes GitHub-Konto verbunden sein (**Einstellungen → Plugins → GitHub → Persönlich**) und GitHub dich freigeben lassen. Sonst sagt das Fenster, wer darf.

Auf einer Board-Karte stehen rechts in der Zeile des Pull Requests eine Rakete und ein Balken je Stufe; wartet eine Freigabe, steht dort _Freigabe_.

### Stufen, Umgebungen und Workflows

Die Plugin-Einstellungen des Projekts haben unter dem Formular einen Abschnitt **Deployments**, gespeichert mit **Speichern** oben:

- **Stufen** — umbenennen, umsortieren, entfernen oder hinzufügen; eine ist **Live**, die zählt als ausgeliefert.
- **Stufe und Dienst am Namen erkennen** (standardmäßig an) — `staging`, `qa`, `prod` und der Dienst davor oder dahinter (`api-staging`, `web/production`); aus zählt nur, was von Hand gesetzt ist, der Rest ist _Sonstige_.
- **Umgebungen** — jede Umgebung, in die die Repositories des Projekts zuletzt deployt haben, mit Stufe, Dienst oder Region und ob sie erscheint. Eine neue ist mit _Neu_ markiert; eine, in die 30 Tage nicht deployt wurde, zeigt ihr Datum in Orange.
- **Workflows als Deployment** — für Auslieferungen ohne GitHub-Environment (ein Image, ein Release): jeder Lauf des Workflows, auf dem angegebenen Branch oder jedem, zählt als Deployment in die gewählte Stufe. Braucht das Ereignis _Workflow run_ der App.
- **Muster** — für Umgebungen, die mit jedem Pull Request entstehen oder umbenannt werden: `pr-*` → Preview, `*-staging` → Staging mit `-` als Dienst (der Teil, den `*` trifft). Ein Muster gilt vor der Erkennung.

Ändert sich die CI, geht nichts kaputt: Jobs werden pro Lauf gelesen, ein alter Lauf zeigt seine alten Jobs; eine neue Umgebung oder ein neuer Workflow erscheint als _Neu_; eine umbenannte ist für Barynt neu, außer ein Muster fängt sie.

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

## Filter

Sobald das Plugin im Projekt an ist, filtern Boards und Listen auch nach GitHub. Im Filter-Menü: **PR-Status** (Entwurf, offen ohne Review, freigegeben, Änderungen gewünscht, gemergt, geschlossen), **GitHub-Actions-Status** (bestanden, fehlgeschlagen, läuft) und **Pull Request** (mit einem, mit einem offenen, ohne — oder ein bestimmter). Unter **Erweiterte Filtereinstellungen** dazu: **Branch** (mit oder ohne, oder ein bestimmter), **GitHub Action** (die Workflows und Checks, die gelaufen sind), **Repository** (bei mehreren) und **Deployt auf** (eine Umgebung). Jeder kennt „ist“ und „ist nicht“, erscheint gesetzt als Chip und wird mit einer View gespeichert wie jeder andere Filter.

## Neue Rechte

Kommentare im Pull Request, Workflows und Deployments brauchen Rechte, die eine früher erstellte App nicht hat: _Pull requests_, _Actions_ und _Administration_ schreiben (Letzteres für neue Repositories), _Deployments_ lesen, und die Ereignisse _Deployment status_ und _Workflow run_. **Admin → Plugins → GitHub** zeigt das auf der Karte **GitHub App**, mit Link zu den Rechten der App auf GitHub — dort setzen und speichern. Danach bestätigt jeder Besitzer einer Installation sie einmal; bis dahin steht das in den Plugin-Einstellungen beim Konto, mit Link.
