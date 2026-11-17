import "server-only";
import { getIssueForUser } from "@/features/api-v1/queries";
import { db } from "@/lib/db";

/** An issue a plugin's token may file under: visible to whoever the token
 *  is (its app, or the person it acts for), and in the plugin's place — its
 *  project, or its workspace (BARY-216). */
export async function pluginIssue(
  userId: string,
  plugin: { workspaceId: string; projectId: string | null },
  idOrRef: string,
) {
  const issue = await getIssueForUser(userId, idOrRef);
  if (!issue) return null;
  if (plugin.projectId)
    return issue.project.id === plugin.projectId ? issue : null;
  const project = await db.project.findUnique({
    where: { id: issue.project.id },
    select: { workspaceId: true },
  });
  return project?.workspaceId === plugin.workspaceId ? issue : null;
}
