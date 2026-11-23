import "server-only";
import { countRequest } from "@/lib/api/rateLimit";
import { db } from "@/lib/db";
import { routeTargets } from "@/lib/github/route";
import {
  INBOUND_DEDUPE_SECONDS,
  INBOUND_MAX_BYTES,
  verifyInbound,
} from "@/lib/plugins/inbound";
import { validateManifest } from "@/lib/plugins/manifest";
import { redisClient } from "@/lib/redis";
import { handleLink } from "../plugins/link";
import { forgetInstallation, getGitHubApp } from "./app";
import { chosenRepositories } from "./connections";

// The GitHub App's webhook (BARY-238): one address for the whole instance,
// signed with the app's secret. Each call names its installation and
// repository; it's filed — like a repository's own webhook to the plugin
// (`handle: "link"`, `features/plugins/inbound.ts`) — in every project the
// plugin is on that chose the repository and is connected to the
// installation. Nobody has to add a webhook per repository.

/** Calls a minute for the whole instance. */
const RATE_LIMIT = 1200;

const answer = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

interface Payload {
  action?: string;
  installation?: { id?: number };
  repository?: { full_name?: string };
}

export async function receiveGitHubApp(req: Request): Promise<Response> {
  const app = await getGitHubApp();
  if (!app) return answer(404, "no GitHub App here");
  if (Number(req.headers.get("content-length") ?? 0) > INBOUND_MAX_BYTES)
    return answer(413, "too large");
  const budget = await countRequest("ratelimit:github-app", RATE_LIMIT);
  if (!budget.ok) return answer(429, "too many requests");
  const body = await req.text();
  if (Buffer.byteLength(body) > INBOUND_MAX_BYTES)
    return answer(413, "too large");
  if (!verifyInbound("github", app.webhookSecret, req.headers, body))
    return answer(401, "not signed with the app's secret");

  const event = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery");
  let data: Payload;
  try {
    data = JSON.parse(body) as Payload;
  } catch {
    return answer(400, "expected JSON");
  }
  const installationId = data.installation?.id
    ? String(data.installation.id)
    : null;
  if (!installationId) return answer(202, "nothing to file");

  // Uninstalled on GitHub: its connections go too.
  if (event === "installation" && data.action === "deleted") {
    forgetInstallation(installationId);
    await db.pluginConnection.deleteMany({ where: { installationId } });
    return answer(202, "forgotten");
  }
  if (event === "installation_repositories") {
    forgetInstallation(installationId);
    return answer(202, "noted");
  }

  const repo = data.repository?.full_name;
  if (!repo) return answer(202, "nothing to file");

  void fileCall(installationId, repo, event, deliveryId, data).catch((error) =>
    console.error("[github app]", error),
  );
  return answer(202, "accepted");
}

/** Files one call in each project it's for, as its `link` hook would. */
async function fileCall(
  installationId: string,
  repo: string,
  event: string,
  deliveryId: string | null,
  data: unknown,
) {
  const connections = await db.pluginConnection.findMany({
    where: { installationId },
    select: { pluginId: true, scopeKey: true, workspaceId: true },
  });
  const byPlugin = new Map<string, typeof connections>();
  for (const c of connections)
    byPlugin.set(c.pluginId, [...(byPlugin.get(c.pluginId) ?? []), c]);

  for (const [pluginId, rows] of byPlugin) {
    const installed = await db.plugin.findFirst({
      where: { pluginId, status: "active" },
      select: { manifest: true },
    });
    const parsed = installed ? validateManifest(installed.manifest) : null;
    if (!parsed?.ok) continue;
    const hook = parsed.manifest.contributes.inboundHooks?.find(
      (h) => h.provider === "github" && h.handle === "link",
    );
    if (!hook) continue;

    const activations = await db.pluginActivation.findMany({
      where: {
        pluginId,
        enabled: true,
        projectId: { not: null },
        workspaceId: { in: [...new Set(rows.map((r) => r.workspaceId))] },
      },
      select: {
        id: true,
        pluginId: true,
        workspaceId: true,
        projectId: true,
        botUserId: true,
        capabilities: true,
        settings: { select: { values: true } },
        inboundHooks: {
          where: { hookId: hook.id },
          select: { id: true, rules: true },
        },
      },
    });
    const targets = routeTargets(
      repo,
      rows.map((r) => r.scopeKey),
      activations.map((a) => ({
        ...a,
        chosen: chosenRepositories(parsed.manifest, a.settings?.values),
      })),
    );
    for (const activation of targets) {
      const row = activation.inboundHooks[0];
      if (!row) continue;
      if (deliveryId) {
        const first = await redisClient
          .set(
            `github-app:${activation.id}:${deliveryId}`,
            "1",
            "EX",
            INBOUND_DEDUPE_SECONDS,
            "NX",
          )
          .catch(() => "OK");
        if (first !== "OK") continue;
      }
      const record = (status: number, error: string | null) =>
        db.pluginInboundHook
          .update({
            where: { id: row.id },
            data: {
              lastReceivedAt: new Date(),
              lastEvent: event,
              lastStatus: status,
              lastError: error,
            },
          })
          .catch(() => {});
      await handleLink(
        activation,
        { id: pluginId, name: parsed.manifest.name },
        hook,
        row.rules,
        event,
        data,
      ).then(
        () => record(202, null),
        (error) => {
          console.error("[github app link]", error);
          return record(500, "Couldn't file this call");
        },
      );
    }
  }
}
