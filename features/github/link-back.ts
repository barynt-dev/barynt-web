import "server-only";
import { NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { exchangeUserCodeTokens, gitHubUser } from "./app";
import { saveUserLink } from "./user-link";

/** Back from linking their own account: keeps it, and returns them to the
 *  page they started from with how it went (`?github=`). */
export async function linkBack(
  userId: string,
  back: string,
  code: string | null,
): Promise<NextResponse> {
  const to = (outcome: string) =>
    NextResponse.redirect(appUrl(`${back}?github=${outcome}`));
  if (!code) return to("failed");
  const tokens = await exchangeUserCodeTokens(code);
  const user = tokens && (await gitHubUser(tokens.access));
  if (!tokens || !user) return to("failed");
  await saveUserLink(userId, tokens, user);
  return to("linked");
}
