import { createService } from "@barynt/plugin-sdk/service";

// The plugin's own server — optional. It only gets events once the
// manifest has a `service` (its address, and which events) and the
// matching `events:*` capability, e.g.:
//
//   "capabilities": ["issues:read", "comments:write", "events:issue", …],
//   "service": { "url": "https://open-issues.example.com/barynt",
//                "events": ["issue.created"] }
//
// `createService` checks every message's signature, keeps each
// installation's secret and tokens (in memory here — give it a `store` to
// keep them across restarts), and hands each event to its handler.

const service = createService();

service.on("issue.created", async (event, { app }) => {
  const issue = event.data as { id: string; ref: string };
  // As the plugin's own app: "Open Issues (App)" in the issue's history.
  await app.comments.create(issue.id, `Thanks — ${issue.ref} is on the list.`);
});

const port = Number(process.env.PORT ?? 8787);
Bun.serve({ port, fetch: service.fetch });
console.log(`Plugin server on http://localhost:${port}`);
