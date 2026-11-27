import { NextResponse } from "next/server";
import { getGitHubApp } from "@/features/github/app";
import { appUrl } from "@/lib/app-url";
import { authorizeUrl, GITHUB_PATHS } from "@/lib/github/app";
import { sealState } from "@/lib/github/state";
import { currentUserId } from "@/lib/permissions";

// "Connect GitHub" on a plugin's Personal tab (BARY-238): off to GitHub to
// sign in through the instance's app, and back to `back` — a path of this
// app — with the account linked.

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(appUrl("/login"));
  const requested = new URL(req.url).searchParams.get("back") ?? "/";
  // Only a path of this app — never somewhere else.
  const back = /^\/(?!\/)/.test(requested) ? requested : "/";
  const app = await getGitHubApp();
  if (!app) return NextResponse.redirect(appUrl(`${back}?github=no_app`));
  return NextResponse.redirect(
    authorizeUrl(
      app.clientId,
      sealState({ kind: "link", userId, back }),
      appUrl(GITHUB_PATHS.callback),
    ),
  );
}
