import "server-only";
import { after } from "next/server";

/**
 * Runs a side effect (notification, email) after the response has gone out,
 * so the action that caused it doesn't wait for SMTP or extra queries — a
 * role change answers as soon as the role is changed.
 *
 * Outside a request (tests, seed, scripts) `after` has no response to wait
 * for and throws; the task then simply runs right away, and the returned
 * promise settles when it's done.
 */
export function afterResponse(task: () => Promise<unknown>): Promise<void> {
  try {
    after(task);
    return Promise.resolve();
  } catch {
    return task().then(() => undefined);
  }
}
