import "server-only";
import { randomBytes } from "node:crypto";
import { fileLink } from "@/features/plugins/issue-data";
import { countRequest } from "@/lib/api/rateLimit";
import { db } from "@/lib/db";
import {
  forwardedHeaders,
  INBOUND_DEDUPE_SECONDS,
  INBOUND_MAX_BYTES,
  INBOUND_RATE_LIMIT,
  inboundDeliveryId,
  inboundEvent,
  verifyInbound,
} from "@/lib/plugins/inbound";
import { type PluginManifest, validateManifest } from "@/lib/plugins/manifest";
import { redisClient } from "@/lib/redis";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { sendToPlugin } from "@/lib/webhooks/deliver";

// Webhooks another service sends a plugin through Barynt (BARY-215): the
// hooks a switched-on plugin gets, and what happens to a call. The checks
// themselves are `lib/plugins/inbound.ts`.

const SECRET_PURPOSE = "plugin-inbound-hook";

/** Makes the hooks the manifest asks for, once each — keeps the ones there
 *  are, so an address given to GitLab stays valid. */
export async function ensureInboundHooks(
  activationId: string,
  manifest: PluginManifest,
): Promise<void> {
  for (const hook of manifest.contributes.inboundHooks ?? []) {
    const exists = await db.pluginInboundHook.findUnique({
      where: { activationId_hookId: { activationId, hookId: hook.id } },
      select: { id: true },
    });
    if (exists) continue;
    await db.pluginInboundHook.create({
      data: {
        activationId,
        hookId: hook.id,
        token: randomBytes(24).toString("base64url"),
        secret: sealSecret(
          randomBytes(24).toString("base64url"),
          SECRET_PURPOSE,
        ),
      },
    });
  }
}

/** A hook's secret in the clear — for the settings, to paste into GitLab. */
export function openInboundSecret(sealed: string): string | null {
  return openSecret(sealed, SECRET_PURPOSE);
}

const answer = (status: number, text: string) =>
  new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

/**
 * A call to `/api/plugins/hooks/<token>`. Checked before anything is read
 * (size, rate), then the provider's proof, then a retry it already sent.
 * Answers 202 at once; what follows — forwarding to the plugin's server —
 * runs on, retried like any delivery.
 */
export async function receiveInbound(
  token: string,
  req: Request,
): Promise<Response> {
  const hook = await db.pluginInboundHook.findUnique({
    where: { token },
    select: {
      id: true,
      hookId: true,
      secret: true,
      activation: {
        select: {
          id: true,
          pluginId: true,
          enabled: true,
          workspaceId: true,
          projectId: true,
          botUserId: true,
        },
      },
      rules: true,
    },
  });
  if (!hook) return answer(404, "unknown hook");
  const activation = hook.activation;
  const plugin = await db.plugin.findFirst({
    where: { pluginId: activation.pluginId, status: "active" },
    select: { manifest: true },
  });
  const parsed = plugin ? validateManifest(plugin.manifest) : null;
  const entry = parsed?.ok
    ? parsed.manifest.contributes.inboundHooks?.find(
        (h) => h.id === hook.hookId,
      )
    : undefined;
  // Switched off, blocked, or the hook gone from its version: gone.
  if (!activation.enabled || !parsed?.ok || !entry)
    return answer(410, "this hook is off");

  const record = (status: number, event: string | null, error: string | null) =>
    db.pluginInboundHook
      .update({
        where: { id: hook.id },
        data: {
          lastReceivedAt: new Date(),
          lastEvent: event,
          lastStatus: status,
          lastError: error,
        },
      })
      .catch(() => {});

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > INBOUND_MAX_BYTES) {
    await record(413, null, "Too large");
    return answer(413, "too large");
  }
  const budget = await countRequest(
    `ratelimit:inbound:${hook.id}`,
    INBOUND_RATE_LIMIT,
  );
  if (!budget.ok) return answer(429, "too many requests");

  const body = await req.text();
  if (Buffer.byteLength(body) > INBOUND_MAX_BYTES) {
    await record(413, null, "Too large");
    return answer(413, "too large");
  }
  const secret = openInboundSecret(hook.secret);
  const event = inboundEvent(entry.provider, req.headers);
  if (!secret || !verifyInbound(entry.provider, secret, req.headers, body)) {
    await record(401, event, "The signature or token doesn't match");
    return answer(401, "not signed with this hook's secret");
  }

  // A provider's retry of what arrived already: fine, and nothing again.
  const deliveryId = inboundDeliveryId(entry.provider, req.headers);
  if (deliveryId) {
    const first = await redisClient
      .set(
        `inbound:${hook.id}:${deliveryId}`,
        "1",
        "EX",
        INBOUND_DEDUPE_SECONDS,
        "NX",
      )
      .catch(() => "OK");
    if (first !== "OK") return answer(200, "already received");
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    await record(400, event, "Not JSON");
    return answer(400, "expected JSON");
  }

  if (entry.handle === "forward") {
    void sendToPlugin(activation.id, {
      workspaceId: activation.workspaceId,
      event: `inbound.${hook.hookId}`,
      payload: JSON.stringify({
        event: `inbound.${hook.hookId}`,
        timestamp: Date.now(),
        workspaceId: activation.workspaceId,
        projectId: activation.projectId,
        actor: null,
        via: null,
        data: {
          hook: hook.hookId,
          provider: entry.provider,
          providerEvent: event,
          deliveryId,
          headers: forwardedHeaders(req.headers),
          body: data,
        },
      }),
    });
  }
  // Filed under the issues it names, and the hook's rules run (BARY-216).
  if (entry.handle === "link")
    void fileLink(
      activation,
      { provider: entry.provider, rules: hook.rules },
      event,
      data,
    ).catch((error) => {
      console.error("[inbound] filing failed", error);
      void record(500, event, "Filing it under issues failed");
    });
  await record(202, event, null);
  return answer(202, "accepted");
}
