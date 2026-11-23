import { isChosen } from "./app";

// Where a call of the GitHub App goes (BARY-238). Pure, so it can be
// tested without a database: every project the plugin is on that chose the
// repository and is connected to the installation it came from — by its
// own connection or its workspace's.

export interface RouteActivation {
  id: string;
  workspaceId: string;
  projectId: string | null;
  /** What the project chose (`repositories` settings). */
  chosen: string[];
}

export function routeTargets<A extends RouteActivation>(
  repo: string,
  /** The scope keys (`ws:…`, `pr:…`) connected to the installation. */
  connectedScopes: readonly string[],
  activations: readonly A[],
): A[] {
  const scopes = new Set(connectedScopes);
  return activations.filter(
    (a) =>
      a.projectId !== null &&
      (scopes.has(`pr:${a.projectId}`) || scopes.has(`ws:${a.workspaceId}`)) &&
      isChosen(repo, a.chosen),
  );
}
