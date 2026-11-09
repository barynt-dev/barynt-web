"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { OptionButton } from "@/components/ui/atoms/OptionButton/OptionButton";
import { passkeySignIn } from "@/lib/webauthn/client";

interface Props {
  callbackUrl?: string;
  onError: (message: string) => void;
}

/**
 * Sign in via passkey — no email field. Without an `email` parameter,
 * next-auth's `getUserInfo` falls back to `undefined`, which resolves to
 * "authenticate" with no predetermined user: the browser shows all passkeys
 * registered for this site by itself (discoverable credentials) — the same
 * "userless" ceremony as 1Password, GitHub, and others.
 *
 * The ceremony (browser prompt, verification) is handled entirely by
 * `passkeySignIn` (`lib/webauthn/client`) — it fetches the options from the
 * server, calls `@simplewebauthn/browser`, and posts the response back.
 *
 * If the person cancels the browser prompt (no passkey selected, timeout),
 * `startAuthentication` throws before any server contact — only this
 * try/catch catches that.
 */
export function PasskeyLoginButton({ callbackUrl, onError }: Props) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    onError("");
    startTransition(async () => {
      try {
        await passkeySignIn({ redirectTo: callbackUrl || "/" });
      } catch {
        onError(t("login.passkeyFailed"));
      }
    });
  };

  return (
    <OptionButton
      variant="primary"
      disabled={isPending}
      icon={<Icon icon="lucide:fingerprint" width={18} />}
      title={t("login.withPasskey")}
      onClick={submit}
    />
  );
}
