"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import {
  SettingsBody,
  SettingsList,
  type SettingsRow,
} from "@/components/ui/layout/SettingsList/SettingsList";
import { addEmail, removePasskey } from "@/features/account/actions";
import type { AccountSecurityView } from "@/features/account/types";
import { Link } from "@/i18n/navigation";
import { passkeySignIn } from "@/lib/webauthn/client";
import styles from "./accountSecurity.module.scss";

interface Props extends AccountSecurityView {
  /** Path to the connected accounts — the route knows the workspace, this
   *  component doesn't. */
  connectionsHref: string;
  /** At least one OAuth provider is set up in `auth.config.ts`. Otherwise
   *  the page behind it doesn't exist at all (see `connections/page.tsx`)
   *  — then the row linking to it is also missing. */
  hasOAuthProviders: boolean;
  /** `AUTH_PASSKEY_LOGIN_ENABLED` (`auth.config.ts`). Off — then the "Add
   *  passkey" button is missing, while already-registered passkeys remain
   *  visible and removable. */
  passkeyLoginEnabled: boolean;
}

/**
 * What you get in with.
 *
 * No more password — passkeys and connected providers are the only ways in.
 * The ceremony (browser prompt) is handled entirely by `passkeySignIn`
 * (`lib/webauthn/client`), the last-way-in protection lives on the server (`removePasskey`);
 * the UI only makes the rule visible.
 *
 * What's missing here is missing deliberately: *changing* an existing
 * address couldn't be verified without mail sending (see `addEmail`), and
 * "sign out everywhere" would be a button with no effect — the session lives
 * in a signed token that the server can't recall. *Adding* a brand-new
 * address (passkey account with no address), on the other hand, works — for
 * that there's nothing yet to confirm that could break.
 */
export function AccountSecurity({
  email,
  emailVerified,
  connectedProviders,
  connectionsHref,
  hasOAuthProviders,
  passkeyLoginEnabled,
  passkeys,
}: Props) {
  const t = useTranslations();
  const format = useFormatter();

  const [passkeyError, setPasskeyError] = useState("");
  const [isPasskeyPending, startPasskeyTransition] = useTransition();

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isEmailPending, startEmailTransition] = useTransition();

  const submitEmail = () => {
    setEmailError("");
    startEmailTransition(async () => {
      const result = await addEmail(newEmail);
      if ("error" in result) {
        setEmailError(result.error);
        return;
      }
      setNewEmail("");
    });
  };

  const addPasskey = () => {
    setPasskeyError("");
    startPasskeyTransition(async () => {
      try {
        await passkeySignIn({ action: "register" });
      } catch {
        setPasskeyError(t("account.passkeyAddFailed"));
      }
    });
  };

  const removePasskeyRow = (credentialID: string) =>
    startPasskeyTransition(async () => {
      const result = await removePasskey(credentialID);
      if ("error" in result) {
        setPasskeyError(result.error);
        return;
      }
      setPasskeyError("");
    });

  const passkeyRows: SettingsRow[] = [
    ...passkeys.map((passkey) => ({
      id: passkey.credentialID,
      label:
        passkey.deviceType === "multiDevice"
          ? t("account.passkeySynced")
          : t("account.passkeyDevice"),
      desc: t("account.passkeyAddedOn", {
        date: format.dateTime(passkey.createdAt, { dateStyle: "medium" }),
      }),
      control: (
        <Button
          variant="text"
          disabled={isPasskeyPending}
          onClick={() => removePasskeyRow(passkey.credentialID)}
        >
          {t("actions.remove")}
        </Button>
      ),
    })),
    // Off (`AUTH_PASSKEY_LOGIN_ENABLED=false`) → the server hasn't
    // registered the WebAuthn provider at all, so `addPasskey` would just
    // fail. Already-registered passkeys stay visible and removable anyway
    // — pure account management, not a sign-in attempt.
    ...(passkeyLoginEnabled
      ? [
          {
            id: "add-passkey",
            label: t("account.addPasskey"),
            desc: t("account.addPasskeyDesc"),
            control: (
              <Button
                variant="outline"
                disabled={isPasskeyPending}
                icon={<Icon icon="lucide:fingerprint" width={14} />}
                onClick={addPasskey}
              >
                {t("account.addPasskey")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  const login: SettingsRow[] = [
    {
      id: "email",
      label: t("fields.email"),
      desc: email ? t("account.emailLoginDesc") : t("account.addEmailDesc"),
      control: email ? (
        <span className={styles.status}>
          <span className={styles.value}>{email}</span>
          {emailVerified ? (
            <span className={styles.verified}>
              <Icon icon="lucide:badge-check" width={14} />
              {t("account.emailVerified")}
            </span>
          ) : (
            <span className={styles.unverified}>
              <Icon icon="lucide:clock" width={14} />
              {t("account.emailUnverified")}
            </span>
          )}
        </span>
      ) : (
        <span className={styles.addEmail}>
          <Input
            aria-label={t("fields.email")}
            inputMode="email"
            placeholder="you@example.com"
            value={newEmail}
            disabled={isEmailPending}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitEmail()}
          />
          <Button
            variant="outline"
            disabled={isEmailPending || !newEmail.trim()}
            onClick={submitEmail}
          >
            {t("account.addEmail")}
          </Button>
        </span>
      ),
    },
    ...(hasOAuthProviders
      ? [
          {
            id: "providers",
            label: t("nav.connections"),
            desc: t("account.providersDesc"),
            control: (
              <Link href={connectionsHref} className={styles.link}>
                {connectedProviders.length === 0
                  ? t("account.noProviders")
                  : t("account.providerCount", {
                      count: connectedProviders.length,
                    })}
                <Icon icon="lucide:arrow-right" width={14} />
              </Link>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.security")}
        description={t("account.securityDesc")}
      />

      <SettingsBody>
        {passkeyRows.length > 0 && (
          <SettingsList title={t("account.passkeys")} rows={passkeyRows} />
        )}
        {passkeyError && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {passkeyError}
          </p>
        )}

        <SettingsList title={t("account.signIn")} rows={login} />
        {emailError && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {emailError}
          </p>
        )}
      </SettingsBody>
    </>
  );
}
