"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { CHOICE_COOKIE, openChoice } from "@/lib/github/state";
import { currentUserId } from "@/lib/permissions";
import { connectTarget, saveConnection } from "./connect";

// What the GitHub connection card does (BARY-238): connect one of the
// installations GitHub just listed for the person, or take a connection
// off. Neither touches the installation on GitHub — that's managed there.

type Result = { ok: true } | { error: string };

interface PlaceInput {
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
}

/** Connects an installation the person picked after signing in at GitHub
 *  — only one GitHub listed for them, for this plugin and place. */
export async function connectGitHubInstallation(
  input: PlaceInput & { installationId: string },
): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { error: "forbidden" };
  const target = await connectTarget(userId, input);
  if (!target) return { error: "forbidden" };
  const store = await cookies();
  const choice = openChoice(store.get(CHOICE_COOKIE)?.value);
  if (
    !choice ||
    choice.userId !== userId ||
    choice.pluginId !== target.pluginId ||
    choice.scopeKey !== target.scopeKey
  )
    return { error: "github_choice_expired" };
  const account = choice.installations.find(
    (i) => i.id === input.installationId,
  );
  if (!account) return { error: "github_choice_expired" };
  await saveConnection(target, account, userId);
  store.delete(CHOICE_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Forgets the choice without connecting anything. */
export async function dismissGitHubChoice(): Promise<Result> {
  (await cookies()).delete(CHOICE_COOKIE);
  return { ok: true };
}

/** Takes a connection of this place off. A workspace's is taken off in the
 *  workspace, never from one of its projects. */
export async function removePluginConnection(
  input: PlaceInput & { connectionId: string },
): Promise<Result> {
  const userId = await currentUserId();
  if (!userId) return { error: "forbidden" };
  const target = await connectTarget(userId, input);
  if (!target) return { error: "forbidden" };
  const row = await db.pluginConnection.findUnique({
    where: { id: input.connectionId },
  });
  if (
    !row ||
    row.pluginId !== target.pluginId ||
    row.scopeKey !== target.scopeKey
  )
    return { error: "not_found" };
  await db.pluginConnection.delete({ where: { id: row.id } });
  await recordAudit({
    action: "plugin.connection.removed",
    actorId: userId,
    target: { type: "plugin", id: target.pluginId, label: target.pluginName },
    workspaceId: target.workspaceId,
    ...(target.projectId && { projectId: target.projectId }),
    meta: { provider: "github", account: row.account },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
