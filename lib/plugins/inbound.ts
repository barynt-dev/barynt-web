import { createHmac, timingSafeEqual } from "node:crypto";

// Webhooks another service sends a plugin through Barynt (BARY-215): how a
// call is checked, per provider, and what of it Barynt reads before it does
// anything. No database, no network — the route (`app/api/plugins/hooks`)
// and its work (`features/plugins/inbound.ts`) use this.

export type InboundProvider = "gitlab" | "github" | "generic";

/** A call's body, at most. GitLab's and GitHub's events stay well below. */
export const INBOUND_MAX_BYTES = 1024 * 1024;

/** Calls per hook and minute. */
export const INBOUND_RATE_LIMIT = 120;

/** How long a delivery id is remembered, to skip a provider's retry. */
export const INBOUND_DEDUPE_SECONDS = 24 * 60 * 60;

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** `sha256=<hex>` HMAC of the raw body, as GitHub signs. */
export function githubSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Whether a call comes from whoever knows the hook's secret, the way its
 * provider proves it:
 * - **GitHub** (and **generic**): `X-Hub-Signature-256`, an HMAC of the body;
 * - **GitLab**: `X-Gitlab-Token`, the secret itself — GitLab signs nothing,
 *   which is why the address is unguessable too.
 */
export function verifyInbound(
  provider: InboundProvider,
  secret: string,
  headers: Headers,
  body: string,
): boolean {
  if (provider === "gitlab") {
    const token = headers.get("x-gitlab-token");
    return token !== null && equal(token, secret);
  }
  const signature = headers.get("x-hub-signature-256");
  return signature !== null && equal(signature, githubSignature(secret, body));
}

/** The provider's name for what happened: `merge_request`, `pull_request`… */
export function inboundEvent(
  provider: InboundProvider,
  headers: Headers,
): string {
  const raw =
    provider === "gitlab"
      ? headers.get("x-gitlab-event")
      : provider === "github"
        ? headers.get("x-github-event")
        : headers.get("x-event");
  // GitLab says "Merge Request Hook"; the rest of Barynt says merge_request.
  return (raw ?? "unknown")
    .toLowerCase()
    .replace(/ hook$/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 60);
}

/** The provider's id for this delivery, to skip a retry — `null` when it
 *  sends none. */
export function inboundDeliveryId(
  provider: InboundProvider,
  headers: Headers,
): string | null {
  const id =
    provider === "gitlab"
      ? (headers.get("x-gitlab-event-uuid") ?? headers.get("idempotency-key"))
      : provider === "github"
        ? headers.get("x-github-delivery")
        : headers.get("x-delivery");
  return id && /^[A-Za-z0-9._:-]{1,100}$/.test(id) ? id : null;
}

/** The headers of the provider's call a plugin's server gets along. */
export function forwardedHeaders(headers: Headers): Record<string, string> {
  const keep: Record<string, string> = {};
  for (const name of [
    "x-gitlab-event",
    "x-gitlab-event-uuid",
    "x-gitlab-instance",
    "x-github-event",
    "x-github-delivery",
    "x-github-hook-id",
    "user-agent",
  ]) {
    const value = headers.get(name);
    if (value) keep[name] = value.slice(0, 200);
  }
  return keep;
}
