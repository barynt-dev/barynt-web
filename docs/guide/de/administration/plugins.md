---
title: Plugins
description: Plugins aus einem Verzeichnis auf dem Server installieren und in Workspaces und Projekten einschalten.
sidebar:
  order: 11
  badge: Neu
---

Plugins erweitern Barynt: eine Projektansicht, ein Dashboard-Widget, ein Abgleich mit einem anderen Werkzeug. Sie kommen aus einem **Verzeichnis**, einer Liste von Plugins mit der Adresse ihres Codes. Zwei Schritte halten es in deiner Hand:

1. Ein **Plattform-Admin** installiert ein Plugin auf dem Server. Damit ist noch nichts eingeschaltet.
2. Ein **Workspace- oder Projekt-Admin** schaltet es dort ein, wo er es haben will, nachdem er bestätigt hat, was es dort darf.

> [!NOTE]
> Ein Plugin kann nie mehr als die Person, die es nutzt. Was es verlangt (seine _Fähigkeiten_, etwa „Issues lesen“), wird angezeigt, bevor jemand es installiert oder einschaltet, und es kann nichts nutzen, was nicht bestätigt wurde.

## Installieren (Plattform-Admins)

Öffne **Admin → Plugins**. Links stehen alle Plugins: was **Aufmerksamkeit braucht** (ein Update, ein gesperrtes Plugin), was **installiert** ist und was deine Quellen **im Verzeichnis** anbieten, mit Suche und Filtern. Rechts steht das Plugin, das du gewählt hast.

![Der Plugin-Store: links die Liste, rechts ein Plugin mit seinen Screenshots](../../assets/de/plugins-store.webp)

1. **Quelle hinzufügen:** die Git-Adresse eines Repositorys mit einer `plugins.json` im Hauptverzeichnis, auf GitHub, GitLab, Gitea/Forgejo oder Bitbucket, auch auf selbst gehosteten Servern. Barynt erkennt den Anbieter an der Adresse; wenn nicht, wähl ihn aus. Optional gibst du einen Branch oder Tag an. Bei einem einfachen Webserver trägst du die Adresse der `plugins.json` selbst ein und wählst **Webserver (HTTPS)**. **Verbindung prüfen** liest das Verzeichnis, bevor du speicherst.

   Für ein privates Repository gib Zugangsdaten an (ein Access Token, oder `Benutzer:Passwort` für Bitbucket-App-Passwörter und Webserver). Sie werden verschlüsselt gespeichert und nur an den Server dieser Quelle geschickt, nie an Plugins, die woanders liegen.

   > [!NOTE]
   > Ein Git-Server in eurem internen Netz ist gesperrt, solange er nicht in `PLUGIN_INTERNAL_HOSTS` steht.
2. Wähl ein Plugin unter **Im Verzeichnis**. Seine Seite zeigt die Screenshots, was es verlangt und woher der Code kommt. Wähl eine Version, wenn du nicht die neueste willst.
3. Klicke auf **Installieren**. Barynt lädt diese Version und prüft sie: Die Dateien müssen zu dem passen, was das Verzeichnis angibt, und die Version muss auf deinem Barynt laufen. Passt etwas nicht, wird es nicht installiert.
4. Der Dialog zeigt die Screenshots des Plugins, falls es welche hat, dann Autor, Herkunft des Codes, Art, wo es nutzbar ist, was es verlangt und welche anderen Server es aufrufen darf. Setz den Haken und installiere.

| Aktion | Was sie tut |
| --- | --- |
| **Aktualisieren** | Ein Plugin mit neuerer Version steht unter **Braucht Aufmerksamkeit** und zeigt **Auf … aktualisieren**. Workspaces und Projekte nutzen es weiter. Verlangt das Update mehr als vorher, müssen sie erneut bestätigen; bis dahin tut es nur, was bestätigt war. |
| **Zurück zu v…** | Geht zur vorigen Version zurück. Die neuere bleibt installiert. |
| **Sperren** | Stoppt das Plugin sofort überall. Aktivierungen und Daten bleiben und gelten wieder, sobald du es entsperrst. |
| **Deinstallieren** | Entfernt alle Versionen. Du wählst, ob seine Daten in Workspaces und Projekten mit gelöscht werden oder ausgeschaltet erhalten bleiben. |

Die Seite eines Plugins hat vier Tabs:

- **Übersicht:** Screenshots, Beschreibung, was es verlangt und woher es kommt.
- **Fähigkeiten:** alles, was es darf, nach Daten, Oberfläche und Ereignissen, und welche anderen Server es aufruft. Wartet ein Update, schaltest du zwischen **Jetzt** und **Nach dem Update** um und siehst vorher, was dazukommt (+) und was wegfällt (−).
- **Versionen:** verfügbare, aktive und frühere Versionen, mit **Aktualisieren**, **Zurück zu v…** und älteren Releases zum Installieren.
- **Wo aktiv:** jeder Workspace, der es eingeschaltet oder für Projekte freigegeben hat, und seine Projekte.

![Fähigkeiten vor einem Update vergleichen](../../assets/de/plugins-capabilities.webp)

**Quellen** unten in der Liste zeigt jede Quelle mit Anbieter, wann sie zuletzt gelesen wurde und ob es einen Fehler gab. Ein Verzeichnis wird höchstens alle paar Minuten gelesen; **Jetzt abrufen** liest es sofort neu.

Jeder Schritt steht im [Protokoll](audit.md).

## Einschalten (Workspace- und Projekt-Admins)

Öffne **Einstellungen → Plugins** im Workspace oder in einem Projekt. Du brauchst die Berechtigung _Switch installed plugins on and off and configure them_; Owner, Admins, Manager und Projekt-Admins haben sie.

- Schalte ein Plugin **ein** und bestätige, was es in diesem Workspace oder Projekt darf.
- **Erneut bestätigen** erscheint nach einem Update, das mehr verlangt.
- **Ausschalten** behält seine Einstellungen und Daten. **Daten löschen** (der Papierkorb) entfernt sie.

### Plugins für Projekte

Ein Projekt kann nur einschalten, was sein Workspace freigegeben hat. In den **Einstellungen → Plugins** des Workspaces legt die Spalte **Für Projekte** das je Plugin fest. Zurücknehmen schaltet das Plugin in allen Projekten des Workspaces aus; ihre Daten bleiben.
