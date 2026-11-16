---
title: "Webhook events"
description: "Every event Barynt sends to a webhook, each with an example message."
sidebar:
  order: 11
---

<!-- Generated from the API's reference data. Do not edit by hand. (scripts/docs-api/generate.ts) -->

Every message is a signed `POST` with a JSON body, as described in [Webhooks](../integrations/webhooks.md). All of them share one envelope:

| Field | Description |
| --- | --- |
| `event` | The event's name. |
| `timestamp` | When it was sent, Unix milliseconds. |
| `workspaceId` | Where it happened. |
| `projectId` | The project, or null for something workspace-wide (a workspace label, a workspace member). |
| `actor` | Who did it — { id, name }, or null when nobody did (someone joined by their email domain). |
| `via` | { plugin: { id, name } } when the change came through a plugin, else null. |
| `data` | The resource, in the same shape the REST API returns it. |
| `changes` | Only on updates: what changed, { field: { from, to } }. A custom field is "customFields.<key>". |

## `issue.created`

An issue was created — in the app, through this API, MCP or a plugin.

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

Anything on an issue changed — the full current issue, and in changes what changed from what to what.

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

The status changed — also sent as issue.updated; changes holds only status and statusCategory.

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

Someone else (or nobody) is assigned now — also sent as issue.updated.

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

One or more custom fields changed — also sent as issue.updated.

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

An issue was deleted — a minimal snapshot, not the full shape, since the issue no longer exists to look up.

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

A comment was added to an issue.

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

A comment was edited — the comment as it is now.

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

A comment was deleted — its id and issue.

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

A label was created. projectId is null for a workspace label.

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

A label's name or color changed.

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

A label was deleted — it's gone from every issue too.

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

A project was created.

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

A project's name, identifier, color or visibility changed.

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

A project was archived.

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

An archived project was restored.

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

A project was deleted, with its issues — the project as it was.

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

Someone joined the workspace (projectId null) or a project. An invitation counts once it's accepted. No email address.

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

Someone was removed from the workspace or a project — with the role they had.

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

Someone's role changed — role is the role's key, changes says from which.

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

A shared view (project or workspace) was saved. Private views never send events.

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

A shared view changed — the full stored view. Also sent when a shared view goes private; visibility then says PRIVATE.

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

A shared view was deleted — a minimal snapshot.

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
