import type { PluginActionEntry } from "@/lib/plugins/plugin-actions";

// The actions running right now (BARY-152), outside React so a menu, a
// sheet in a modal or the palette can start one the same way;
// `PluginActionRunner` in the app shell draws a hidden frame per job.

export interface ActionJob {
  key: number;
  entry: PluginActionEntry;
  issueId: string | null;
  workspaceId: string;
  projectId: string;
}

let jobs: ActionJob[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of listeners) listener();
};

/** Starts an action. Its answer shows as a toast. */
export function startPluginAction(job: Omit<ActionJob, "key">): void {
  jobs = [...jobs, { ...job, key: next++ }];
  emit();
}

export function finishPluginAction(key: number): void {
  jobs = jobs.filter((j) => j.key !== key);
  emit();
}

export const actionJobs = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => jobs,
  /** None on the server. */
  server: (): ActionJob[] => [],
};
