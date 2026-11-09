import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { __NEXTAUTH, getCsrfToken } from "next-auth/react";

interface PasskeyOptions {
  /** `"register"` adds a passkey to the signed-in account; omitted, the
   *  server decides (sign-in, or a new account when `email` is unknown). */
  action?: "register";
  email?: string;
  /** Where to land afterwards — the current page by default. */
  redirectTo?: string;
}

/**
 * Passkey ceremony against Auth.js' WebAuthn provider — the same three steps
 * as `next-auth/webauthn`'s `signIn` (fetch options, browser prompt, post the
 * answer to the callback), but calling `@simplewebauthn/browser` the v14 way
 * (`{ optionsJSON }`). `next-auth/webauthn` still passes the options
 * positionally (v9), which v14 only tolerates with a console warning on
 * every ceremony.
 *
 * Always redirects on completion, like every caller did. Unlike
 * `next-auth/webauthn`, a failed options request throws instead of
 * returning silently, so the caller's error message shows. A cancelled
 * browser prompt throws too (from `@simplewebauthn/browser`).
 */
export async function passkeySignIn({
  redirectTo = window.location.href,
  ...params
}: PasskeyOptions = {}): Promise<void> {
  const base = __NEXTAUTH.basePath;
  const optionsRes = await fetch(
    `${base}/webauthn-options/webauthn?${new URLSearchParams(params)}`,
  );
  if (!optionsRes.ok) throw new Error(await optionsRes.text());
  const { action, options: optionsJSON } = await optionsRes.json();

  const data =
    action === "authenticate"
      ? await startAuthentication({ optionsJSON })
      : await startRegistration({ optionsJSON });

  const res = await fetch(`${base}/callback/webauthn`, {
    method: "post",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({
      ...params,
      action,
      data: JSON.stringify(data),
      csrfToken: await getCsrfToken(),
      callbackUrl: redirectTo,
    }),
  });
  const { url } = await res.json();
  window.location.href = url ?? redirectTo;
  // Same-page hash changes don't reload by themselves.
  if (url?.includes("#")) window.location.reload();
}
