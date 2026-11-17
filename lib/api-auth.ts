import "server-only";
import { createHash } from "node:crypto";
import type { ApiScope } from "@/lib/api/scopes";
import { db } from "@/lib/db";
import { enterActing } from "@/lib/webhooks/source";

/** What a valid Bearer token resolves to — the token-auth analogue of a
 *  session's `{ userId }` (`lib/session.ts`). */
export interface ApiAuthResult {
  userId: string;
  keyId: string;
  /** Granular, Jira-style scopes (`lib/api/scopes.ts`) — a ceiling on top
   *  of the user's own RBAC permissions, never a grant beyond them. */
  scopes: ApiScope[];
  /** A plugin's token (`bpa_`/`bpt_`): its activation — where what it files
   *  under issues hangs off (BARY-216). */
  plugin?: {
    activationId: string;
    pluginId: string;
    workspaceId: string;
    projectId: string | null;
  };
}

/** Does this token carry the given scope? Routes gate on this before (and
 *  in addition to) the normal `can(userId, permission, ctx)` check. */
export function hasScope(auth: ApiAuthResult, scope: ApiScope): boolean {
  return auth.scopes.includes(scope);
}

const BEARER = /^Bearer\s+(\S+)$/i;

/** How often `lastUsedAt` may be written per key — an unthrottled write on
 *  every request write-amplifies badly for a polling integration, and the
 *  UI only needs "used recently", not "used this millisecond". */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** SHA-256 over the raw token — shared between lookup here and creation in
 *  `features/account/actions.ts`, so there's exactly one place that defines
 *  what gets stored. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Fire-and-forget, throttled — never awaited by the caller. */
function touchLastUsed(keyId: string): void {
  const staleBefore = new Date(Date.now() - TOUCH_INTERVAL_MS);
  db.apiKey
    .updateMany({
      where: {
        id: keyId,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }],
      },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});
}

/**
 * Resolves the `Authorization: Bearer <token>` header of a public-API
 * request to the user it belongs to, or `null` if the token is missing,
 * malformed, unknown, revoked, expired, or belongs to a deactivated
 * account.
 *
 * The result's `userId` is meant to flow straight into `can(userId,
 * permission, ctx)` (`lib/permissions.ts`) exactly as a session's would —
 * this function is the token-auth counterpart to `currentUserId()`, not a
 * parallel permission system.
 */
export async function resolveApiUser(
  req: Request,
): Promise<ApiAuthResult | null> {
  const match = req.headers.get("authorization")?.match(BEARER);
  if (!match) return null;
  const token = match[1];
  // `bry_` a person's key, `bpa_` a plugin's app token (BARY-213), `bpt_` a
  // plugin's server acting for a person (BARY-214) — same table. A bot's
  // rights come from its plugin; an acting token's are the person's, cut
  // down to the plugin's (`lib/permissions.ts`).
  const acting = token.startsWith("bpt_");
  if (!token.startsWith("bry_") && !token.startsWith("bpa_") && !acting)
    return null;
  // Before the first `await`: the route that awaits this carries it on.
  const fillActing = acting ? enterActing() : null;

  const key = await db.apiKey.findUnique({
    where: { tokenHash: hashApiToken(token) },
    select: {
      id: true,
      userId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { deactivatedAt: true } },
      activation: {
        select: {
          id: true,
          pluginId: true,
          workspaceId: true,
          projectId: true,
          capabilities: true,
          enabled: true,
        },
      },
    },
  });
  if (!key || key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt <= new Date()) return null;
  if (key.user.deactivatedAt) return null;
  if (fillActing) {
    const activation = key.activation;
    // An acting token without its plugin, or with the plugin off: nothing.
    if (!activation?.enabled) return null;
    fillActing(
      {
        id: activation.pluginId,
        name: await pluginName(activation.pluginId),
      },
      {
        workspaceId: activation.workspaceId,
        projectId: activation.projectId,
        capabilities: activation.capabilities,
      },
    );
  }

  touchLastUsed(key.id);

  return {
    userId: key.userId,
    keyId: key.id,
    scopes: key.scopes as ApiScope[],
    ...(key.activation && {
      plugin: {
        activationId: key.activation.id,
        pluginId: key.activation.pluginId,
        workspaceId: key.activation.workspaceId,
        projectId: key.activation.projectId,
      },
    }),
  };
}

/** A plugin's name, from its active version — for "Ada via GitLab". */
async function pluginName(pluginId: string): Promise<string> {
  const row = await db.plugin.findFirst({
    where: { pluginId, status: "active" },
    select: { manifest: true },
  });
  const name = (row?.manifest as { name?: unknown } | null)?.name;
  return typeof name === "string" ? name : pluginId;
}
