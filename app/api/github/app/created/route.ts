import { NextResponse } from "next/server";
import { createAppFromCode } from "@/features/github/app";
import { appUrl } from "@/lib/app-url";
import { recordAudit } from "@/lib/audit";
import { openState } from "@/lib/github/state";
import { currentUserId, hasPermission, PLATFORM } from "@/lib/permissions";

// Back from GitHub after creating the instance's app from its manifest
// (BARY-238): the code becomes the app's keys, kept sealed. Only the
// platform admin who started it, within half an hour.

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(appUrl("/login"));
  const params = new URL(req.url).searchParams;
  const state = openState(params.get("state"), "app", userId);
  if (!state || !(await hasPermission("plugin.manage", PLATFORM)))
    return new Response("Not found", { status: 404 });
  const code = params.get("code");
  const result = code
    ? await createAppFromCode(code, userId)
    : { error: "github_app_failed" };
  if ("error" in result)
    return NextResponse.redirect(appUrl(`${state.back}&github=app_failed`));
  await recordAudit({
    action: "github.app.created",
    actorId: userId,
    target: { type: "plugin", id: "github", label: result.name },
  });
  return NextResponse.redirect(appUrl(`${state.back}&github=app_created`));
}
