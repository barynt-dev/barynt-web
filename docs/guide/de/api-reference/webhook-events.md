---
title: "Webhook-Ereignisse"
description: "Alle Ereignisse, die Barynt per Webhook meldet, jeweils mit einer Beispiel-Nachricht."
sidebar:
  order: 11
---

<!-- Aus den Referenzdaten der API erzeugt. Nicht von Hand ändern. (scripts/docs-api/generate.ts) -->

Jede Nachricht ist ein signierter `POST` mit JSON-Body, siehe [Webhooks](../integrations/webhooks.md). Alle haben dieselbe Hülle:

| Feld | Beschreibung |
| --- | --- |
| `event` | Der Name des Ereignisses. |
| `timestamp` | Wann sie gesendet wurde, Unix-Millisekunden. |
| `workspaceId` | Wo es passiert ist. |
| `projectId` | Das Projekt, oder null für etwas Workspace-weites (ein Workspace-Label, ein Workspace-Mitglied). |
| `actor` | Wer es getan hat — { id, name }, oder null, wenn niemand (jemand ist über die E-Mail-Domain beigetreten). |
| `via` | { plugin: { id, name } }, wenn die Änderung über ein Plugin kam, sonst null. |
| `data` | Die Ressource, in derselben Form wie in der REST-API. |
| `changes` | Nur bei Änderungen: was sich geändert hat, { feld: { from, to } }. Ein eigenes Feld heißt "customFields.<key>". |

## `issue.created`

Ein Issue wurde angelegt — in der App, über diese API, MCP oder ein Plugin.

```json
{
  "event": "issue.created",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "title": "Fix broken checkout flow",
    "status": "backlog",
    "statusCategory": "backlog",
    "priority": 2,
    "type": "bug",
    "labels": [
      {
        "id": "l_9f2a1b",
        "name": "frontend"
      }
    ],
    "assignee": {
      "id": "u_7h3j2k",
      "name": "Priya Shah"
    },
    "reporter": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "project": {
      "id": "proj_9f8e7d",
      "name": "Website Relaunch"
    },
    "description": "Checkout fails on Safari when …",
    "created": "2026-03-01T09:12:00.000Z",
    "updated": "2026-03-05T11:02:00.000Z",
    "closedAt": null,
    "dueDate": null,
    "storyPoints": 3,
    "customFields": {
      "branch": "priya/web-42-checkout"
    }
  }
}
```

## `issue.updated`

Irgendetwas an einem Issue hat sich geändert — das vollständige aktuelle Issue und in changes, was sich wovon worauf geändert hat.

```json
{
  "event": "issue.updated",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "title": "Fix broken checkout flow",
    "status": "done",
    "statusCategory": "completed",
    "priority": 2,
    "type": "bug",
    "labels": [
      {
        "id": "l_9f2a1b",
        "name": "frontend"
      }
    ],
    "assignee": {
      "id": "u_7h3j2k",
      "name": "Priya Shah"
    },
    "reporter": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "project": {
      "id": "proj_9f8e7d",
      "name": "Website Relaunch"
    },
    "description": "Checkout fails on Safari when …",
    "created": "2026-03-01T09:12:00.000Z",
    "updated": "2026-03-05T11:02:00.000Z",
    "closedAt": "2026-03-05T11:02:00.000Z",
    "dueDate": null,
    "storyPoints": 3,
    "customFields": {
      "branch": "priya/web-42-checkout"
    }
  },
  "changes": {
    "status": {
      "from": "in-progress",
      "to": "done"
    },
    "statusCategory": {
      "from": "started",
      "to": "completed"
    },
    "storyPoints": {
      "from": 2,
      "to": 3
    }
  }
}
```

## `issue.status_changed`

Der Status hat sich geändert — kommt auch als issue.updated; changes enthält nur status und statusCategory.

```json
{
  "event": "issue.status_changed",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "title": "Fix broken checkout flow",
    "status": "done",
    "statusCategory": "completed",
    "priority": 2,
    "type": "bug",
    "labels": [
      {
        "id": "l_9f2a1b",
        "name": "frontend"
      }
    ],
    "assignee": {
      "id": "u_7h3j2k",
      "name": "Priya Shah"
    },
    "reporter": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "project": {
      "id": "proj_9f8e7d",
      "name": "Website Relaunch"
    },
    "description": "Checkout fails on Safari when …",
    "created": "2026-03-01T09:12:00.000Z",
    "updated": "2026-03-05T11:02:00.000Z",
    "closedAt": "2026-03-05T11:02:00.000Z",
    "dueDate": null,
    "storyPoints": 3,
    "customFields": {
      "branch": "priya/web-42-checkout"
    }
  },
  "changes": {
    "status": {
      "from": "in-progress",
      "to": "done"
    },
    "statusCategory": {
      "from": "started",
      "to": "completed"
    }
  }
}
```

## `issue.assigned`

Jemand anderes (oder niemand) ist jetzt zugewiesen — kommt auch als issue.updated.

```json
{
  "event": "issue.assigned",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "title": "Fix broken checkout flow",
    "status": "done",
    "statusCategory": "completed",
    "priority": 2,
    "type": "bug",
    "labels": [
      {
        "id": "l_9f2a1b",
        "name": "frontend"
      }
    ],
    "assignee": {
      "id": "u_7h3j2k",
      "name": "Priya Shah"
    },
    "reporter": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "project": {
      "id": "proj_9f8e7d",
      "name": "Website Relaunch"
    },
    "description": "Checkout fails on Safari when …",
    "created": "2026-03-01T09:12:00.000Z",
    "updated": "2026-03-05T11:02:00.000Z",
    "closedAt": "2026-03-05T11:02:00.000Z",
    "dueDate": null,
    "storyPoints": 3,
    "customFields": {
      "branch": "priya/web-42-checkout"
    }
  },
  "changes": {
    "assignee": {
      "from": null,
      "to": {
        "id": "u_7h3j2k",
        "name": "Priya Shah"
      }
    }
  }
}
```

## `issue.fields_changed`

Ein oder mehrere eigene Felder haben sich geändert — kommt auch als issue.updated.

```json
{
  "event": "issue.fields_changed",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "title": "Fix broken checkout flow",
    "status": "done",
    "statusCategory": "completed",
    "priority": 2,
    "type": "bug",
    "labels": [
      {
        "id": "l_9f2a1b",
        "name": "frontend"
      }
    ],
    "assignee": {
      "id": "u_7h3j2k",
      "name": "Priya Shah"
    },
    "reporter": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "project": {
      "id": "proj_9f8e7d",
      "name": "Website Relaunch"
    },
    "description": "Checkout fails on Safari when …",
    "created": "2026-03-01T09:12:00.000Z",
    "updated": "2026-03-05T11:02:00.000Z",
    "closedAt": "2026-03-05T11:02:00.000Z",
    "dueDate": null,
    "storyPoints": 3,
    "customFields": {
      "branch": "priya/web-42-checkout"
    }
  },
  "changes": {
    "customFields.branch": {
      "from": null,
      "to": "priya/web-42-checkout"
    }
  }
}
```

## `issue.deleted`

Ein Issue wurde gelöscht — eine knappe Momentaufnahme statt des vollen Objekts, weil das Issue nicht mehr existiert.

```json
{
  "event": "issue.deleted",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "i_4k2n1x",
    "ref": "WEB-42",
    "projectId": "proj_9f8e7d",
    "title": "Fix broken checkout flow"
  }
}
```

## `comment.created`

Ein Kommentar wurde zu einem Issue hinzugefügt.

```json
{
  "event": "comment.created",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "c_5m9p3q",
    "issueId": "i_4k2n1x",
    "author": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "parentId": null,
    "body": "Confirmed on Safari 17.",
    "created": "2026-03-02T10:05:00.000Z",
    "updated": null
  }
}
```

## `comment.updated`

Ein Kommentar wurde bearbeitet — der Kommentar, wie er jetzt ist.

```json
{
  "event": "comment.updated",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "c_5m9p3q",
    "issueId": "i_4k2n1x",
    "author": {
      "id": "u_1a2b3c",
      "name": "Alex Kim"
    },
    "parentId": null,
    "body": "Confirmed on Safari 17 and 18.",
    "created": "2026-03-02T10:05:00.000Z",
    "updated": "2026-03-02T10:09:00.000Z"
  }
}
```

## `comment.deleted`

Ein Kommentar wurde gelöscht — seine Id und sein Issue.

```json
{
  "event": "comment.deleted",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "c_5m9p3q",
    "issueId": "i_4k2n1x"
  }
}
```

## `label.created`

Ein Label wurde angelegt. projectId ist null bei einem Workspace-Label.

```json
{
  "event": "label.created",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "l_9f2a1b",
    "name": "frontend",
    "slug": "frontend",
    "color": "#3b7bd5",
    "projectId": null
  }
}
```

## `label.updated`

Name oder Farbe eines Labels haben sich geändert.

```json
{
  "event": "label.updated",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "l_9f2a1b",
    "name": "frontend",
    "slug": "frontend",
    "color": "#d5713b",
    "projectId": null
  }
}
```

## `label.deleted`

Ein Label wurde gelöscht — es ist auch von allen Issues verschwunden.

```json
{
  "event": "label.deleted",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "l_9f2a1b",
    "name": "frontend",
    "slug": "frontend",
    "color": "#3b7bd5",
    "projectId": null
  }
}
```

## `project.created`

Ein Projekt wurde angelegt.

```json
{
  "event": "project.created",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "proj_9f8e7d",
    "name": "Website Relaunch",
    "slug": "website-relaunch",
    "prefix": "WEB",
    "color": "#5ab98a",
    "visibility": "public",
    "archived": false
  }
}
```

## `project.updated`

Name, Kürzel, Farbe oder Sichtbarkeit eines Projekts haben sich geändert.

```json
{
  "event": "project.updated",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "proj_9f8e7d",
    "name": "Website Relaunch",
    "slug": "website-relaunch",
    "prefix": "WEB",
    "color": "#5ab98a",
    "visibility": "private",
    "archived": false
  }
}
```

## `project.archived`

Ein Projekt wurde archiviert.

```json
{
  "event": "project.archived",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "proj_9f8e7d",
    "name": "Website Relaunch",
    "slug": "website-relaunch",
    "prefix": "WEB",
    "color": "#5ab98a",
    "visibility": "public",
    "archived": true
  }
}
```

## `project.unarchived`

Ein archiviertes Projekt wurde wiederhergestellt.

```json
{
  "event": "project.unarchived",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "proj_9f8e7d",
    "name": "Website Relaunch",
    "slug": "website-relaunch",
    "prefix": "WEB",
    "color": "#5ab98a",
    "visibility": "public",
    "archived": false
  }
}
```

## `project.deleted`

Ein Projekt wurde mit seinen Issues gelöscht — das Projekt, wie es war.

```json
{
  "event": "project.deleted",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "proj_9f8e7d",
    "name": "Website Relaunch",
    "slug": "website-relaunch",
    "prefix": "WEB",
    "color": "#5ab98a",
    "visibility": "public",
    "archived": false
  }
}
```

## `member.added`

Jemand ist dem Workspace (projectId null) oder einem Projekt beigetreten. Eine Einladung zählt, sobald sie angenommen ist. Ohne E-Mail-Adresse.

```json
{
  "event": "member.added",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "u_7h3j2k",
    "name": "Priya Shah",
    "handle": "priya",
    "role": "member",
    "projectId": null
  }
}
```

## `member.removed`

Jemand wurde aus dem Workspace oder einem Projekt entfernt — mit der Rolle, die die Person hatte.

```json
{
  "event": "member.removed",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "u_7h3j2k",
    "name": "Priya Shah",
    "handle": "priya",
    "role": "member",
    "projectId": null
  }
}
```

## `member.role_changed`

Die Rolle von jemandem hat sich geändert — role ist der Schlüssel der Rolle, changes sagt, von welcher.

```json
{
  "event": "member.role_changed",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": null,
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "u_7h3j2k",
    "name": "Priya Shah",
    "handle": "priya",
    "role": "admin",
    "projectId": null
  },
  "changes": {
    "role": {
      "from": "member",
      "to": "admin"
    }
  }
}
```

## `view.created`

Eine geteilte View (Projekt oder Workspace) wurde gespeichert. Private Views senden nie Events.

```json
{
  "event": "view.created",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "v_3c9d1e",
    "name": "Urgent bugs",
    "slug": "urgent-bugs",
    "workspaceId": "ws_1a2b3c",
    "projectId": "proj_9f8e7d",
    "ownerId": "u_7h3j2k",
    "visibility": "PROJECT",
    "layout": "list",
    "filter": {
      "op": "and",
      "rules": [
        {
          "field": "priority",
          "is": "gte",
          "value": 3
        }
      ]
    },
    "groupBy": "status",
    "sortBy": "priority",
    "sortDir": "desc",
    "updatedAt": "2026-10-12T14:20:00.000Z"
  }
}
```

## `view.updated`

Eine geteilte View hat sich geändert — die vollständige gespeicherte View. Kommt auch, wenn eine geteilte View privat wird; visibility ist dann PRIVATE.

```json
{
  "event": "view.updated",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "v_3c9d1e",
    "name": "Urgent bugs (P1+)",
    "slug": "urgent-bugs",
    "workspaceId": "ws_1a2b3c",
    "projectId": "proj_9f8e7d",
    "ownerId": "u_7h3j2k",
    "visibility": "PROJECT",
    "layout": "list",
    "filter": {
      "op": "and",
      "rules": [
        {
          "field": "priority",
          "is": "gte",
          "value": 3
        }
      ]
    },
    "groupBy": "status",
    "sortBy": "priority",
    "sortDir": "desc",
    "updatedAt": "2026-10-12T14:20:00.000Z"
  }
}
```

## `view.deleted`

Eine geteilte View wurde gelöscht — eine knappe Momentaufnahme.

```json
{
  "event": "view.deleted",
  "timestamp": 1772870400000,
  "workspaceId": "ws_1a2b3c",
  "projectId": "proj_9f8e7d",
  "actor": {
    "id": "u_1a2b3c",
    "name": "Alex Kim"
  },
  "via": null,
  "data": {
    "id": "v_3c9d1e",
    "name": "Urgent bugs",
    "workspaceId": "ws_1a2b3c",
    "projectId": "proj_9f8e7d"
  }
}
```
