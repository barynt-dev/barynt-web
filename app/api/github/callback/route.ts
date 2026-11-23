import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  exchangeUserCode,
  getGitHubApp,
  userInstallations,
} from "@/features/github/app";
import { connectTarget, saveConnection } from "@/features/github/connect";
import { appUrl } from "@/lib/app-url";
import { installUrl } from "@/lib/github/app";
import {
  CHOICE_COOKIE,
  CHOICE_TTL_SECONDS,
  openState,
  sealChoice,
  sealState,
} from "@/lib/github/state";
import { currentUserId } from "@/lib/permissions";

// Back from GitHub (BARY-238) — after signing in, or after installing the
// app (which signs in too, `request_oauth_on_install`). Barynt never takes
// an installation's id on trust: it asks GitHub, with the person's token,
// which installations they can reach, and connects only one of those.

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(appUrl("/login"));
  const params = new URL(req.url).searchParams;
  const state = openState(params.get("state"), "connect", userId);
  if (!state)
    return new Response(
      "This link has expired. Start again from the plugin's settings.",
      { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  const target = await connectTarget(userId, state);
  if (!target) return new Response("Not found", { status: 404 });
  const back = (outcome: string) =>
    NextResponse.redirect(appUrl(`${target.back}?github=${outcome}`));

  // A member asked the organization's owner to install it: nothing yet.
  if (params.get("setup_action") === "request") return back("requested");
  const code = params.get("code");
  if (!code) return back("failed");
  const token = await exchangeUserCode(code);
  if (!token) return back("failed");
  const installations = await userInstallations(token);

  const installationId = params.get("installation_id");
  if (installationId) {
    const account = installations.find((i) => i.id === installationId);
    if (!account) return back("not_yours");
    await saveConnection(target, account, userId);
    return back("connected");
  }
  if (installations.length === 0) {
    // Not installed anywhere they can see: install it first.
    const app = await getGitHubApp();
    if (!app) return back("no_app");
    return NextResponse.redirect(installUrl(app.slug, sealState(state)));
  }
  // One or more: the settings page lets them pick.
  (await cookies()).set(
    CHOICE_COOKIE,
    sealChoice({
      userId,
      pluginId: target.pluginId,
      scopeKey: target.scopeKey,
      installations,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl("/").startsWith("https:"),
      path: "/",
      maxAge: CHOICE_TTL_SECONDS,
    },
  );
  return back("choose");
}
