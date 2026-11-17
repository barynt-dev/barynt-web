import { NextResponse } from "next/server";
import { readIssueData } from "@/features/plugins/issue-data";
import { pluginIssue } from "@/features/plugins/issue-data-api";
import { checkRateLimit } from "@/lib/api/rateLimit";
import {
  forbiddenJson,
  insufficientScope,
  notFoundJson,
  rateLimited,
  unauthorized,
  withRateLimitHeaders,
} from "@/lib/api/respond";
import { hasScope, resolveApiUser } from "@/lib/api-auth";

/** What the calling plugin filed under an issue (BARY-216) — a plugin's
 *  token only; a person's key has no plugin to read for. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorized();

  const { ok, info } = await checkRateLimit(auth.keyId);
  if (!ok) return rateLimited(info);

  if (!hasScope(auth, "issues:read")) return insufficientScope();
  const plugin = auth.plugin;
  if (!plugin) return withRateLimitHeaders(forbiddenJson(), info);

  const { id } = await params;
  const issue = await pluginIssue(auth.userId, plugin, id);
  if (!issue) return withRateLimitHeaders(notFoundJson(), info);

  const data = await readIssueData(
    auth.userId,
    plugin.pluginId,
    plugin.workspaceId,
    [issue.id],
    plugin.projectId,
  );
  return withRateLimitHeaders(
    NextResponse.json({ data: data[issue.id] ?? [] }),
    info,
  );
}
