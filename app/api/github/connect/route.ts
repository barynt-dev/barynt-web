import { NextResponse } from "next/server";
import { getGitHubApp } from "@/features/github/app";
import { connectTarget } from "@/features/github/connect";
import { appUrl } from "@/lib/app-url";
import { authorizeUrl, GITHUB_PATHS, installUrl } from "@/lib/github/app";
import { sealState } from "@/lib/github/state";
import { currentUserId } from "@/lib/permissions";

// "Connect GitHub" in a plugin's settings (BARY-238): off to GitHub, with a
// sealed state that says who, for which plugin and place. By default the
// person signs in first, so Barynt sees which installations they already
// have; `mode=install` installs the app on another account.

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(appUrl("/login"));
  const params = new URL(req.url).searchParams;
  const target = await connectTarget(userId, {
    pluginId: params.get("plugin") ?? "",
    workspaceId: params.get("workspace") ?? "",
    projectId: params.get("project") || null,
  });
  if (!target) return new Response("Not found", { status: 404 });
  const app = await getGitHubApp();
  if (!app)
    return NextResponse.redirect(appUrl(`${target.back}?github=no_app`));
  const state = sealState({
    kind: "connect",
    userId,
    pluginId: target.pluginId,
    workspaceId: target.workspaceId,
    projectId: target.projectId,
    back: target.back,
  });
  return NextResponse.redirect(
    params.get("mode") === "install"
      ? installUrl(app.slug, state)
      : authorizeUrl(app.clientId, state, appUrl(GITHUB_PATHS.callback)),
  );
}
