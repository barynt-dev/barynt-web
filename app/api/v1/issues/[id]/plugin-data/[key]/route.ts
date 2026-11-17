import { NextResponse } from "next/server";
import { deleteIssueData, writeIssueData } from "@/features/plugins/issue-data";
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

type Context = { params: Promise<{ id: string; key: string }> };

/** The calling plugin's entry under an issue, written by its server
 *  (BARY-216): `{ "value": … }`, at most 16 KB. */
export async function PUT(req: Request, { params }: Context) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorized();

  const { ok, info } = await checkRateLimit(auth.keyId);
  if (!ok) return rateLimited(info);

  if (!hasScope(auth, "issues:read")) return insufficientScope();
  const plugin = auth.plugin;
  if (!plugin) return withRateLimitHeaders(forbiddenJson(), info);

  const { id, key } = await params;
  const issue = await pluginIssue(auth.userId, plugin, id);
  if (!issue) return withRateLimitHeaders(notFoundJson(), info);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("value" in body))
    return withRateLimitHeaders(
      NextResponse.json({ error: { code: "invalid_body" } }, { status: 422 }),
      info,
    );
  const result = await writeIssueData(
    plugin.activationId,
    issue.id,
    key,
    body.value,
  );
  if (result !== "ok")
    return withRateLimitHeaders(
      NextResponse.json({ error: { code: result } }, { status: 422 }),
      info,
    );
  return withRateLimitHeaders(
    NextResponse.json({ data: { key, value: body.value } }),
    info,
  );
}

export async function DELETE(req: Request, { params }: Context) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorized();

  const { ok, info } = await checkRateLimit(auth.keyId);
  if (!ok) return rateLimited(info);

  if (!hasScope(auth, "issues:read")) return insufficientScope();
  const plugin = auth.plugin;
  if (!plugin) return withRateLimitHeaders(forbiddenJson(), info);

  const { id, key } = await params;
  const issue = await pluginIssue(auth.userId, plugin, id);
  if (!issue) return withRateLimitHeaders(notFoundJson(), info);

  await deleteIssueData(plugin.activationId, issue.id, key);
  return withRateLimitHeaders(new NextResponse(null, { status: 204 }), info);
}
