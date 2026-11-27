import "server-only";
import { recordAudit } from "@/lib/audit";
import { asInstallation, asUser, forgetRepositories } from "./app";
import { connectTarget } from "./connect";
import { placeConnections } from "./connections";
import { userGitHubToken } from "./user-link";

// A new repository from the settings (BARY-238): in one of the accounts the
// place is connected to — an organization's as the app (Administration:
// write), a person's own account as that person (their linked GitHub
// account; GitHub lets nobody else create one there). Where the
// installation only sees chosen repositories, Barynt adds the new one to it
// with the person's token, so it shows up right away.

/** GitHub's rule for a repository's name. */
export const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export interface CreateRepoInput {
  pluginId: string;
  workspaceId: string;
  projectId: string | null;
  /** The installation — the account it's created in. */
  installationId: string;
  name: string;
  description?: string;
  private: boolean;
}

export type CreateRepoResult =
  | {
      ok: true;
      fullName: string;
      /** The app doesn't see it yet: add it on GitHub (`manageUrl`). */
      notShared?: boolean;
    }
  | { error: string };

export async function createRepository(
  userId: string,
  input: CreateRepoInput,
): Promise<CreateRepoResult> {
  const target = await connectTarget(userId, input);
  if (!target) return { error: "forbidden" };
  const name = input.name.trim();
  if (!REPO_NAME.test(name) || name === "." || name === "..")
    return { error: "github_repo_name" };
  const connection = (await placeConnections(input.pluginId, input)).find(
    (c) => c.id === input.installationId,
  );
  if (!connection) return { error: "forbidden" };

  const body = {
    name,
    private: input.private,
    auto_init: true,
    ...(input.description?.trim() && {
      description: input.description.trim().slice(0, 350),
    }),
  };
  const userToken = await userGitHubToken(userId);
  let made: { status: number; data: RepoAnswer | null } | null;
  if (connection.accountType === "Organization") {
    made = await asInstallation<RepoAnswer>(
      input.installationId,
      `/orgs/${encodeURIComponent(connection.account)}/repos`,
      { method: "POST", body },
    );
    // The app may not (yet) — the person may, with their own account.
    if (made && (made.status === 403 || made.status === 404) && userToken)
      made = await asUser<RepoAnswer>(
        userToken,
        `/orgs/${encodeURIComponent(connection.account)}/repos`,
        { method: "POST", body },
      );
  } else {
    // Someone's own account: only they can, as themselves.
    if (!userToken) return { error: "github_link_needed" };
    const me = await asUser<{ login?: string }>(userToken, "/user");
    if (me.data?.login?.toLowerCase() !== connection.account.toLowerCase())
      return { error: "github_not_your_account" };
    made = await asUser<RepoAnswer>(userToken, "/user/repos", {
      method: "POST",
      body,
    });
  }
  if (!made) return { error: "github_failed" };
  if (made.status === 422) return { error: "github_repo_exists" };
  if (made.status === 403 || made.status === 404)
    return { error: "github_repo_no_right" };
  if (made.status !== 201 || !made.data?.full_name || !made.data.id)
    return { error: "github_failed" };
  const fullName = made.data.full_name;

  // Does the installation see it? Else add it — as the person, who owns it.
  const seen = await asInstallation(
    input.installationId,
    `/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`,
  );
  let notShared = seen?.status !== 200;
  if (notShared && userToken) {
    const added = await asUser(
      userToken,
      `/user/installations/${encodeURIComponent(input.installationId)}/repositories/${made.data.id}`,
      { method: "PUT" },
    );
    notShared = added.status !== 204;
  }
  forgetRepositories(input.installationId);
  await recordAudit({
    action: "plugin.repository.created",
    actorId: userId,
    target: { type: "plugin", id: input.pluginId, label: target.pluginName },
    workspaceId: input.workspaceId,
    ...(input.projectId && { projectId: input.projectId }),
    meta: { repository: fullName, private: input.private },
  });
  return { ok: true, fullName, ...(notShared && { notShared: true }) };
}

interface RepoAnswer {
  id?: number;
  full_name?: string;
}
