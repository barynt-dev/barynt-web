import { NextResponse } from "next/server";
import {
  accessibleProjectIds,
  currentUserCanEnterWorkspace,
  currentUserId,
} from "@/lib/permissions";
import { pluginDataChangesSince } from "@/lib/realtime/store";

// What plugins' servers changed on issues since `?since=` (BARY-225),
// polled by `usePluginDataChanges` next to `updates` — see there. Without
// `since` it only answers the time to start from. `at` is this server's
// clock, so the next poll doesn't depend on the browser's.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return new Response(null, { status: 401 });

  const { id: workspaceId } = await params;
  if (!(await currentUserCanEnterWorkspace(workspaceId))) {
    return new Response(null, { status: 404 });
  }

  const at = Date.now();
  const since = Number(new URL(req.url).searchParams.get("since"));
  const found =
    Number.isFinite(since) && since > 0
      ? pluginDataChangesSince(workspaceId, since)
      : [];
  // Only issues this person may see.
  const visible =
    found.length > 0 ? await accessibleProjectIds(userId, workspaceId) : null;
  const changes = found
    .filter((c) => visible?.has(c.projectId))
    .map(({ pluginId, issueId }) => ({ pluginId, issueId }));
  return NextResponse.json(
    { at, changes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
